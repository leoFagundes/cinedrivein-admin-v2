"use client";

import dynamic from "next/dynamic";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { useAdminPresence } from "@/hooks/useAdminPresence";

const AuthProvider = dynamic(
  () =>
    import("@/contexts/AuthContext").then((m) => ({ default: m.AuthProvider })),
  { ssr: false, loading: () => null },
);

// Precisa estar dentro do AuthProvider pra usar useAuth().
function GlobalPresence() {
  useAdminPresence();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useKonamiCode();
  return (
    <AuthProvider>
      <GlobalPresence />
      {children}
    </AuthProvider>
  );
}
