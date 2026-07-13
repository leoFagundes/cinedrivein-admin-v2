"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { DevModeFlags, getDevMode } from "@/lib/devMode";

const DevModeContext = createContext<DevModeFlags>(getDevMode());

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<DevModeFlags>(getDevMode);

  useEffect(() => {
    function sync() {
      setFlags(getDevMode());
    }
    window.addEventListener("devmode:change", sync);
    return () => window.removeEventListener("devmode:change", sync);
  }, []);

  return (
    <DevModeContext.Provider value={flags}>{children}</DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeFlags {
  return useContext(DevModeContext);
}
