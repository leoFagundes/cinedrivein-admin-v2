"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiUser, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth, SESSION_EXPIRED_KEY } from "@/contexts/AuthContext";
import { GuestGuard } from "@/components/layout/AuthGuard";

function FilmStrip() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
      <div
        className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-around items-center py-4 opacity-10"
        style={{ borderRight: "2px solid var(--color-text-muted)" }}
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="w-5 h-4 rounded-sm" style={{ backgroundColor: "var(--color-text-muted)" }} />
        ))}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-12 flex flex-col justify-around items-center py-4 opacity-10"
        style={{ borderLeft: "2px solid var(--color-text-muted)" }}
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="w-5 h-4 rounded-sm" style={{ backgroundColor: "var(--color-text-muted)" }} />
        ))}
      </div>
    </div>
  );
}

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-credential":      "Usuário ou senha incorretos.",
  "auth/invalid-email":           "E-mail inválido.",
  "auth/user-disabled":           "Esta conta foi desativada.",
  "auth/user-not-found":          "Usuário não encontrado.",
  "auth/wrong-password":          "Senha incorreta.",
  "auth/too-many-requests":       "Muitas tentativas. Aguarde alguns minutos.",
  "auth/network-request-failed":  "Sem conexão. Verifique sua internet.",
  "permission-denied":            "Permissão negada. Verifique as regras do Firestore.",
};

function parseError(err: unknown): string {
  console.error("[Login error]", err);
  if (err instanceof Error) {
    if (err.message === "USER_NOT_FOUND") return "Usuário não encontrado.";
    if (err.message === "PENDING")  return "Sua conta ainda não foi aprovada por um administrador.";
    if (err.message === "REJECTED") return "Sua conta foi rejeitada. Entre em contato com o suporte.";
    const code = (err as { code?: string }).code ?? "";
    return FIREBASE_ERRORS[code] ?? `Erro inesperado (${code || err.message}).`;
  }
  return "Ocorreu um erro inesperado.";
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const { success, error, warning } = useToast();
  const { signIn } = useAuth();

  // Exibe toast se a sessão expirou
  useEffect(() => {
    if (localStorage.getItem(SESSION_EXPIRED_KEY)) {
      localStorage.removeItem(SESSION_EXPIRED_KEY);
      warning("Sessão expirada", "Sua sessão de 24h expirou. Faça login novamente.");
    }
  }, []);

  function validate() {
    const e: typeof errors = {};
    if (!identifier.trim()) e.identifier = "Usuário ou e-mail obrigatório";
    if (!password) e.password = "Senha obrigatória";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
      success("Bem-vindo!", "Você entrou com sucesso.");
    } catch (err) {
      const msg = parseError(err);
      if (msg.includes("aprovada") || msg.includes("rejeitada")) {
        warning("Acesso negado", msg);
      } else {
        error("Erro ao entrar", msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center relative px-4"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <FilmStrip />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/logo-drivein.svg" alt="Cine Drive-in" width={140} height={140} priority className="mb-3" />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Painel Administrativo
          </p>
        </div>

        <div
          className="rounded-[var(--radius-xl)] p-8"
          style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Entrar na conta
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label="Usuário ou e-mail"
              type="text"
              placeholder="Seu usuário ou e-mail"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
              }}
              icon={<FiUser size={16} />}
              error={errors.identifier}
              autoComplete="username"
            />

            <Input
              label="Senha"
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              icon={<FiLock size={16} />}
              rightIcon={showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              onRightIconClick={() => setShowPassword((v) => !v)}
              error={errors.password}
              autoComplete="current-password"
            />

            <Button type="submit" fullWidth loading={loading} className="mt-2">
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: "var(--color-text-muted)" }}>
          Não tem conta?{" "}
          <Link href="/signup" className="font-medium" style={{ color: "var(--color-primary)" }}>
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <GuestGuard>
      <LoginForm />
    </GuestGuard>
  );
}
