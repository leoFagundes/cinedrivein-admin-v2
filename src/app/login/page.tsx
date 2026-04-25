"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiUser, FiLock, FiEye, FiEyeOff, FiMail, FiArrowLeft } from "react-icons/fi";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
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
  "auth/invalid-credential":     "Usuário ou senha incorretos.",
  "auth/invalid-email":          "E-mail inválido.",
  "auth/user-disabled":          "Esta conta foi desativada.",
  "auth/user-not-found":         "Usuário não encontrado.",
  "auth/wrong-password":         "Senha incorreta.",
  "auth/too-many-requests":      "Muitas tentativas. Aguarde alguns minutos.",
  "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  "permission-denied":           "Permissão negada. Verifique as regras do Firestore.",
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

type View = "login" | "reset";

function LoginForm() {
  const [view, setView] = useState<View>("login");

  // ── Login state ──
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ identifier?: string; password?: string }>({});

  // ── Reset state ──
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { success, error, warning } = useToast();
  const { signIn } = useAuth();

  useEffect(() => {
    if (localStorage.getItem(SESSION_EXPIRED_KEY)) {
      localStorage.removeItem(SESSION_EXPIRED_KEY);
      warning("Sessão expirada", "Sua sessão de 24h expirou. Faça login novamente.");
    }
  }, []);

  // ── Login ──
  function validateLogin() {
    const e: typeof loginErrors = {};
    if (!identifier.trim()) e.identifier = "Usuário ou e-mail obrigatório";
    if (!password) e.password = "Senha obrigatória";
    setLoginErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoginLoading(true);
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
      setLoginLoading(false);
    }
  }

  // ── Reset password ──
  function switchToReset() {
    // Pre-fill email if the identifier looks like one
    if (identifier.includes("@")) setResetEmail(identifier.trim());
    setResetSent(false);
    setResetEmailError("");
    setView("reset");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) { setResetEmailError("E-mail obrigatório"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) { setResetEmailError("E-mail inválido"); return; }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
      success("E-mail enviado!", "Verifique sua caixa de entrada para redefinir a senha.");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      // Firebase doesn't reveal if email exists — show generic success for security
      if (code === "auth/user-not-found") {
        setResetSent(true);
        success("E-mail enviado!", "Se este e-mail estiver cadastrado, você receberá as instruções.");
      } else {
        const msg = FIREBASE_ERRORS[code] ?? "Erro ao enviar e-mail. Tente novamente.";
        error("Erro", msg);
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center relative px-4"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <FilmStrip />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/logo-drivein.svg" alt="Cine Drive-in" width={140} height={140} priority className="mb-3" />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Painel Administrativo
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[var(--radius-xl)] p-8"
          style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
        >
          {/* ── LOGIN VIEW ── */}
          {view === "login" && (
            <>
              <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--color-text-primary)" }}>
                Entrar na conta
              </h2>

              <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
                <Input
                  label="Usuário ou e-mail"
                  type="text"
                  placeholder="Seu usuário ou e-mail"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (loginErrors.identifier) setLoginErrors((p) => ({ ...p, identifier: undefined }));
                  }}
                  icon={<FiUser size={16} />}
                  error={loginErrors.identifier}
                  autoComplete="username"
                />

                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (loginErrors.password) setLoginErrors((p) => ({ ...p, password: undefined }));
                    }}
                    icon={<FiLock size={16} />}
                    rightIcon={showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    onRightIconClick={() => setShowPassword((v) => !v)}
                    error={loginErrors.password}
                    autoComplete="current-password"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={switchToReset}
                      className="text-xs cursor-pointer transition-opacity hover:opacity-70"
                      style={{ color: "var(--color-primary)" }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </div>

                <Button type="submit" fullWidth loading={loginLoading} className="mt-1">
                  Entrar
                </Button>
              </form>
            </>
          )}

          {/* ── RESET VIEW ── */}
          {view === "reset" && (
            <>
              <button
                onClick={() => setView("login")}
                className="flex items-center gap-1.5 text-xs mb-5 cursor-pointer transition-opacity hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiArrowLeft size={13} />
                Voltar ao login
              </button>

              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                Recuperar senha
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              {resetSent ? (
                <div
                  className="flex flex-col items-center gap-3 py-6 text-center"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "var(--color-success)" }}
                  >
                    <FiMail size={22} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    E-mail enviado!
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    Verifique sua caixa de entrada em <strong style={{ color: "var(--color-text-secondary)" }}>{resetEmail}</strong> e siga as instruções para redefinir sua senha.
                  </p>
                  <button
                    onClick={() => setView("login")}
                    className="mt-2 text-sm font-medium cursor-pointer"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="flex flex-col gap-4" noValidate>
                  <Input
                    label="E-mail"
                    type="email"
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      setResetEmailError("");
                    }}
                    icon={<FiMail size={16} />}
                    error={resetEmailError}
                    autoComplete="email"
                    autoFocus
                  />
                  <Button type="submit" fullWidth loading={resetLoading}>
                    Enviar link de recuperação
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {view === "login" && (
          <p className="text-center text-sm mt-6" style={{ color: "var(--color-text-muted)" }}>
            Não tem conta?{" "}
            <Link href="/signup" className="font-medium" style={{ color: "var(--color-primary)" }}>
              Criar conta
            </Link>
          </p>
        )}
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
