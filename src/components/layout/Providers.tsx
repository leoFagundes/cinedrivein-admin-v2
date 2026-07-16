"use client";

import dynamic from "next/dynamic";
import { useKonamiCode } from "@/hooks/useKonamiCode";

const AuthProvider = dynamic(
  () =>
    import("@/contexts/AuthContext").then((m) => ({ default: m.AuthProvider })),
  { ssr: false, loading: () => null },
);

export default function Providers({ children }: { children: React.ReactNode }) {
  useKonamiCode();
  return <AuthProvider>{children}</AuthProvider>;
}
