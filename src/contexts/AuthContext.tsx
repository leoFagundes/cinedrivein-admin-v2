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
import { log } from "@/lib/logger";
import { recordFirestoreRead, recordFirestoreWrite } from "@/lib/firestoreDevTracker";

const SESSION_KEY = "cdi_session_start";
const SESSION_EXPIRED_KEY = "cdi_session_expired";
const SESSION_DURATION = 15 * 60 * 60 * 1000;
const CHECK_INTERVAL = 5 * 60 * 1000;
const LAST_LOGIN_MARK_KEY = "cdi_last_login_marked";

/**
 * Marca `lastLoginAt` no doc do usuário — no máximo 1x por dia local (via
 * localStorage, sem precisar ler o doc antes). Chamado tanto no login
 * explícito quanto toda vez que uma sessão já autenticada é restaurada
 * (reabrir o navegador, recarregar a página) — diferente do log de auditoria
 * de "login" (que só registra a digitação de senha), isso reflete de verdade
 * a última vez que a pessoa usou o sistema, mesmo sem precisar logar de novo.
 */
async function markLastLogin(uid: string) {
  try {
    const today = new Date().toDateString();
    const marker = `${uid}:${today}`;
    if (localStorage.getItem(LAST_LOGIN_MARK_KEY) === marker) return;
    await setDoc(doc(db, "users", uid), { lastLoginAt: serverTimestamp() }, { merge: true });
    recordFirestoreWrite(1);
    localStorage.setItem(LAST_LOGIN_MARK_KEY, marker);
  } catch {
    // silencioso — não é crítico, só afeta a exibição de "último login"
  }
}

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
  /** Início da sessão atual (ms desde epoch), ou null se não houver sessão. */
  sessionStartedAt: number | null;
  /** Duração máxima da sessão, em ms, antes do logout automático. */
  sessionDurationMs: number;
  /** Renova a sessão manualmente (reinicia a contagem das 15h a partir de agora). */
  renewSession: () => void;
  /**
   * Só para teste (Dev Mode) — ajusta o horário de início da sessão pra
   * simular o relógio avançando, sem precisar esperar horas de verdade.
   */
  debugSetSessionStart: (timestamp: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  recordFirestoreRead(1);
  if (!snap.exists()) return null;
  const data = snap.data();

  let permissions: Permission[] = [];
  if (data.profileId) {
    const profileSnap = await getDoc(
      doc(db, "permissionProfiles", data.profileId),
    );
    recordFirestoreRead(1);
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
    notifyReviewsInSidebar: data.notifyReviewsInSidebar ?? false,
    lastLoginAt: data.lastLoginAt?.toDate(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(
    null,
  );
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
          setSessionStartedAt(null);
          setLoading(false);
          return;
        }
        setFirebaseUser(fbUser);
        setSessionStartedAt(sessionStart ? parseInt(sessionStart) : null);
        const user = await loadAppUser(fbUser.uid);
        setAppUser(user);
        void markLastLogin(fbUser.uid);
      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setSessionStartedAt(null);
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
        setSessionStartedAt(null);
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
        recordFirestoreRead(1);
        if (!snap.exists()) throw new Error("USER_NOT_FOUND");
        email = snap.data().email as string;
      }
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const userSnap = await getDoc(doc(db, "users", credential.user.uid));
      recordFirestoreRead(1);
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
      const loginTimestamp = Date.now();
      localStorage.setItem(SESSION_KEY, loginTimestamp.toString());
      setSessionStartedAt(loginTimestamp);

      // Carrega o appUser manualmente após login bem-sucedido
      const appUserData = await loadAppUser(credential.user.uid);
      setFirebaseUser(credential.user);
      setAppUser(appUserData);
      if (appUserData) {
        log({
          action: "login",
          category: "auth",
          description: `@${appUserData.username} fez login`,
          performedBy: { uid: appUserData.uid, username: appUserData.username },
        });
        void markLastLogin(appUserData.uid);
      }
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
    setSessionStartedAt(null);
    await signOut(auth);
  }

  async function refreshUser() {
    if (!auth.currentUser) return;
    const user = await loadAppUser(auth.currentUser.uid);
    setAppUser(user);
  }

  /** Renovação manual — reinicia a contagem das 15h a partir de agora. */
  function renewSession() {
    if (!auth.currentUser) return;
    const now = Date.now();
    localStorage.setItem(SESSION_KEY, now.toString());
    setSessionStartedAt(now);
  }

  /**
   * Só para teste (Dev Mode) — define diretamente o horário de início da
   * sessão. Se o novo horário já ultrapassar as 15h, força a expiração na
   * hora (não espera o próximo tick do intervalo de 5min), pra dar pra ver o
   * fluxo de logout automático sem esperar de verdade.
   */
  function debugSetSessionStart(timestamp: number) {
    if (!auth.currentUser) return;

    if (Date.now() - timestamp > SESSION_DURATION) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.setItem(SESSION_EXPIRED_KEY, "1");
      signOut(auth);
      setFirebaseUser(null);
      setAppUser(null);
      setSessionStartedAt(null);
      return;
    }

    localStorage.setItem(SESSION_KEY, timestamp.toString());
    setSessionStartedAt(timestamp);
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
        sessionStartedAt,
        sessionDurationMs: SESSION_DURATION,
        renewSession,
        debugSetSessionStart,
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
