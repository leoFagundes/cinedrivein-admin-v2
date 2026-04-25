"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser } from "@/types";

const SESSION_KEY = "cdi_session_start";
const SESSION_EXPIRED_KEY = "cdi_session_expired";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24h em ms

interface SignUpData {
  username: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Só verifica expiração se já havia sessão registrada (restauração de sessão).
        // Durante login/signup ativo o SESSION_KEY ainda não existe — não forçar logout.
        const sessionStart = localStorage.getItem(SESSION_KEY);
        if (sessionStart) {
          const elapsed = Date.now() - parseInt(sessionStart);
          if (elapsed > SESSION_DURATION) {
            localStorage.removeItem(SESSION_KEY);
            localStorage.setItem(SESSION_EXPIRED_KEY, "1");
            await signOut(auth);
            setFirebaseUser(null);
            setAppUser(null);
            setLoading(false);
            return;
          }
        }

        setFirebaseUser(fbUser);
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setAppUser({
            uid: fbUser.uid,
            username: data.username,
            email: data.email,
            status: data.status,
            isOwner: data.isOwner ?? false,
            profileId: data.profileId,
            profileName: data.profileName,
            createdAt: data.createdAt?.toDate(),
          });
        }
      } else {
        setFirebaseUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(identifier: string, password: string) {
    let email = identifier;

    if (!identifier.includes("@")) {
      const snap = await getDoc(doc(db, "usernames", identifier));
      if (!snap.exists()) throw new Error("USER_NOT_FOUND");
      email = snap.data().email as string;
    }

    const credential = await signInWithEmailAndPassword(auth, email, password);

    const userSnap = await getDoc(doc(db, "users", credential.user.uid));
    if (!userSnap.exists()) {
      await signOut(auth);
      throw new Error("USER_NOT_FOUND");
    }

    const status = userSnap.data().status;
    if (status === "pending") {
      await signOut(auth);
      throw new Error("PENDING");
    }
    if (status === "rejected") {
      await signOut(auth);
      throw new Error("REJECTED");
    }

    // Sessão válida — registra o início
    localStorage.setItem(SESSION_KEY, Date.now().toString());
  }

  async function signUp({ username, email, password }: SignUpData) {
    const usernameSnap = await getDoc(doc(db, "usernames", username));
    if (usernameSnap.exists()) throw new Error("USERNAME_TAKEN");

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await Promise.all([
      setDoc(doc(db, "users", credential.user.uid), {
        username,
        email,
        status: "pending",
        isOwner: false,
        createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, "usernames", username), {
        uid: credential.user.uid,
        email,
      }),
    ]);

    await signOut(auth);
  }

  async function logOut() {
    localStorage.removeItem(SESSION_KEY);
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, signIn, signUp, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { SESSION_EXPIRED_KEY };
