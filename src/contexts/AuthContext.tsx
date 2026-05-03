"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser, Permission } from "@/types";

const SESSION_KEY = "cdi_session_start";
const SESSION_EXPIRED_KEY = "cdi_session_expired";
const SESSION_DURATION = 15 * 60 * 60 * 1000;
const CHECK_INTERVAL = 5 * 60 * 1000;

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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();

  let permissions: Permission[] = [];
  if (data.profileId) {
    const profileSnap = await getDoc(
      doc(db, "permissionProfiles", data.profileId),
    );
    if (profileSnap.exists())
      permissions = profileSnap.data().permissions ?? [];
  }

  return {
    uid,
    username: data.username,
    email: data.email,
    status: data.status,
    isOwner: data.isOwner ?? false,
    profileId: data.profileId,
    profileName: data.profileName,
    permissions,
    avatarStyle: data.avatarStyle,
    avatarSeed: data.avatarSeed,
    createdAt: data.createdAt?.toDate(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const signingInRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (signingInRef.current) return;

      if (fbUser) {
        const sessionStart = localStorage.getItem(SESSION_KEY);
        if (
          sessionStart &&
          Date.now() - parseInt(sessionStart) > SESSION_DURATION
        ) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.setItem(SESSION_EXPIRED_KEY, "1");
          await signOut(auth);
          setFirebaseUser(null);
          setAppUser(null);
          setLoading(false);
          return;
        }
        setFirebaseUser(fbUser);
        const user = await loadAppUser(fbUser.uid);
        setAppUser(user);
      } else {
        setFirebaseUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const sessionStart = localStorage.getItem(SESSION_KEY);

      if (!sessionStart || !auth.currentUser) {
        console.log("[Sessão] Sem sessão ativa ou usuário deslogado");
        return;
      }

      const elapsed = Date.now() - parseInt(sessionStart);
      const remaining = SESSION_DURATION - elapsed;

      const expiresAt = new Date(parseInt(sessionStart) + SESSION_DURATION);
      const startedAt = new Date(parseInt(sessionStart));

      const fmt = (d: Date) =>
        d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

      console.log(
        `[Sessão] Tempo decorrido: ${(elapsed / 1000).toFixed(0)}s | ` +
          `Restante: ${(remaining / 1000).toFixed(0)}s | ` +
          `Iniciou em: ${fmt(startedAt)} | ` +
          `Expira em: ${fmt(expiresAt)}`,
      );
      if (remaining <= 0) {
        console.log("[Sessão] ⚠️ Sessão expirada — deslogando...");
        localStorage.removeItem(SESSION_KEY);
        localStorage.setItem(SESSION_EXPIRED_KEY, "1");
        await signOut(auth);
        setFirebaseUser(null);
        setAppUser(null);
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  async function signIn(identifier: string, password: string) {
    signingInRef.current = true;
    try {
      let email = identifier;
      if (!identifier.includes("@")) {
        const snap = await getDoc(doc(db, "usernames", identifier));
        if (!snap.exists()) throw new Error("USER_NOT_FOUND");
        email = snap.data().email as string;
      }
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
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
      localStorage.setItem(SESSION_KEY, Date.now().toString());

      // Carrega o appUser manualmente após login bem-sucedido
      const appUserData = await loadAppUser(credential.user.uid);
      setFirebaseUser(credential.user);
      setAppUser(appUserData);
    } finally {
      signingInRef.current = false;
    }
  }

  async function signUp({ username, email, password }: SignUpData) {
    const usernameSnap = await getDoc(doc(db, "usernames", username));
    if (usernameSnap.exists()) throw new Error("USERNAME_TAKEN");
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
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

  async function refreshUser() {
    if (!auth.currentUser) return;
    const user = await loadAppUser(auth.currentUser.uid);
    setAppUser(user);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        loading,
        signIn,
        signUp,
        logOut,
        refreshUser,
      }}
    >
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
