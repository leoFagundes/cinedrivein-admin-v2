"use client";

import dynamic from "next/dynamic";

// Impede o Firebase Client SDK de inicializar no servidor durante prerender.
// O Firebase Auth é browser-only — SSR causaria "auth/invalid-api-key".
const AuthProvider = dynamic(
  () => import("@/contexts/AuthContext").then((m) => ({ default: m.AuthProvider })),
  { ssr: false, loading: () => null }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
