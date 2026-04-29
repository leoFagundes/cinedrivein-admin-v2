"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/access";

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <svg
          className="animate-spin w-8 h-8"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="var(--color-primary)" strokeWidth="3" />
          <path
            className="opacity-80"
            fill="var(--color-primary)"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Carregando...
        </p>
      </div>
    </div>
  );
}

/** Protege rotas do admin: redireciona para /login se não autenticado ou não aprovado */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (appUser && appUser.status !== "approved") {
      router.replace("/login");
    }
  }, [loading, firebaseUser, appUser, router]);

  if (loading || !firebaseUser || !appUser || appUser.status !== "approved") {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

/** Protege rotas públicas: redireciona para /admin/dashboard (ou /admin/profile) se já autenticado e aprovado */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && appUser?.status === "approved") {
      const target =
        appUser.isOwner || can(appUser, "view_dashboard")
          ? "/admin/dashboard"
          : "/admin/profile";
      router.replace(target);
    }
  }, [loading, firebaseUser, appUser, router]);

  if (loading) return <LoadingScreen />;
  if (firebaseUser && appUser?.status === "approved") return null;

  return <>{children}</>;
}
