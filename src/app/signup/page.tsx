"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
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
  "auth/email-already-in-use": "Este e-mail já está em uso.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
  "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
};

function parseError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "USERNAME_TAKEN") return "Este nome de usuário já está em uso.";
    const code = (err as { code?: string }).code ?? "";
    return FIREBASE_ERRORS[code] ?? "Ocorreu um erro inesperado.";
  }
  return "Ocorreu um erro inesperado.";
}

type Step = "form" | "pending";

function SignUpForm() {
  const [step, setStep] = useState<Step>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<typeof fields>>({});
  const { success, error } = useToast();
  const { signUp } = useAuth();

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const e: Partial<typeof fields> = {};
    if (!fields.username.trim()) e.username = "Usuário obrigatório";
    else if (fields.username.includes(" ")) e.username = "Sem espaços no usuário";
    if (!fields.email.trim()) e.email = "E-mail obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) e.email = "E-mail inválido";
    if (!fields.password) e.password = "Senha obrigatória";
    else if (fields.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (!fields.confirm) e.confirm = "Confirme a senha";
    else if (fields.confirm !== fields.password) e.confirm = "As senhas não coincidem";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp({ username: fields.username.trim(), email: fields.email.trim(), password: fields.password });
      success("Conta criada!", "Aguarde a aprovação de um administrador.");
      setStep("pending");
    } catch (err) {
      error("Erro ao criar conta", parseError(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "pending") {
    return (
      <main
        className="min-h-screen flex items-center justify-center relative px-4"
        style={{ backgroundColor: "var(--color-bg-base)" }}
      >
        <FilmStrip />
        <div className="w-full max-w-sm relative z-10 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: "var(--color-primary-light)", border: "1px solid var(--color-primary)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
            Conta criada!
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--color-text-secondary)" }}>
            Sua conta foi criada com sucesso e está{" "}
            <strong style={{ color: "var(--color-warning)" }}>aguardando aprovação</strong> de um administrador.
            Você receberá acesso assim que for aprovado.
          </p>
          <Link href="/login" className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
            Voltar para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center relative px-4 py-8"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <FilmStrip />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/logo-drivein.svg" alt="Cine Drive-in" width={120} height={120} priority className="mb-3" />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Painel Administrativo
          </p>
        </div>

        <div
          className="rounded-[var(--radius-xl)] p-8"
          style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            Criar conta
          </h2>
          <p className="text-xs mb-6" style={{ color: "var(--color-text-muted)" }}>
            Após o cadastro, um administrador precisará aprovar seu acesso.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label="Usuário"
              type="text"
              placeholder="Nome de usuário"
              value={fields.username}
              onChange={(e) => set("username", e.target.value)}
              icon={<FiUser size={16} />}
              error={errors.username}
              autoComplete="username"
            />
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={fields.email}
              onChange={(e) => set("email", e.target.value)}
              icon={<FiMail size={16} />}
              error={errors.email}
              autoComplete="email"
            />
            <Input
              label="Senha"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={fields.password}
              onChange={(e) => set("password", e.target.value)}
              icon={<FiLock size={16} />}
              rightIcon={showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              onRightIconClick={() => setShowPassword((v) => !v)}
              error={errors.password}
              autoComplete="new-password"
            />
            <Input
              label="Confirmar senha"
              type={showConfirm ? "text" : "password"}
              placeholder="Repita a senha"
              value={fields.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              icon={<FiLock size={16} />}
              rightIcon={showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              onRightIconClick={() => setShowConfirm((v) => !v)}
              error={errors.confirm}
              autoComplete="new-password"
            />

            <Button type="submit" fullWidth loading={loading} className="mt-2">
              Criar conta
            </Button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: "var(--color-text-muted)" }}>
          Já tem conta?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--color-primary)" }}>
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <GuestGuard>
      <SignUpForm />
    </GuestGuard>
  );
}
