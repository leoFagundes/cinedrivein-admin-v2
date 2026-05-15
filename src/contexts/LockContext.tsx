"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface LockContextValue {
  locked: boolean;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
}

const LockContext = createContext<LockContextValue | null>(null);

const LOCK_KEY = "cdi_screen_locked";

export function LockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(LOCK_KEY) === "1";
  });

  const lock = useCallback(() => {
    sessionStorage.setItem(LOCK_KEY, "1");
    setLocked(true);
  }, []);

  const unlock = useCallback(async (password: string) => {
    const user = auth.currentUser;
    if (!user?.email) throw new Error("Usuário não autenticado.");
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    sessionStorage.removeItem(LOCK_KEY);
    setLocked(false);
  }, []);

  return (
    <LockContext.Provider value={{ locked, lock, unlock }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error("useLock must be used inside <LockProvider>");
  return ctx;
}
