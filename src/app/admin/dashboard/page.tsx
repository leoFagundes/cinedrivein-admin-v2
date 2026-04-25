"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiGrid } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  // Usuário sem nenhuma permissão e não owner → redireciona para pedidos
  useEffect(() => {
    if (loading) return;
    if (appUser && !appUser.isOwner && appUser.permissions.length === 0) {
      router.replace("/admin/orders");
    }
  }, [loading, appUser, router]);

  if (loading) return null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Visão geral do sistema.
        </p>
      </div>

      <div
        className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] py-32 gap-4"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center"
          style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
        >
          <FiGrid size={24} />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
          Em construção
        </p>
      </div>
    </div>
  );
}
