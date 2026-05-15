"use client";

import { useState, useEffect, useRef } from "react";
import { FiLock, FiEye, FiEyeOff, FiLogOut } from "react-icons/fi";
import { useLock } from "@/contexts/LockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import DiceBearAvatar from "@/components/ui/DiceBearAvatar";

export default function LockScreen() {
  const { locked, unlock } = useLock();
  const { appUser, logOut } = useAuth();
  const { error: toastError } = useToast();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (locked) {
      setPassword("");
      setErrorMsg("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [locked]);

  if (!locked) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await unlock(password);
    } catch {
      setErrorMsg("Senha incorreta. Tente novamente.");
      setPassword("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await logOut();
    } catch {
      toastError("Erro ao sair", "Tente novamente.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8 flex flex-col items-center gap-5"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Ícone de cadeado */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--color-bg-elevated)" }}
        >
          <FiLock size={22} style={{ color: "var(--color-primary)" }} />
        </div>

        {/* Avatar + nome */}
        <div className="flex flex-col items-center gap-2">
          {appUser?.avatarStyle && appUser?.avatarSeed ? (
            <DiceBearAvatar style={appUser.avatarStyle} seed={appUser.avatarSeed} size={56} />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: "var(--color-primary)", color: "white" }}
            >
              {appUser?.username?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
              {appUser?.username ?? "Usuário"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Tela bloqueada
            </p>
          </div>
        </div>

        {/* Form de senha */}
        <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }}
              className="w-full px-4 py-2.5 pr-10 rounded-[var(--radius-md)] text-sm outline-none"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: `1px solid ${errorMsg ? "var(--color-error)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.removeAttribute("readonly");
                if (!errorMsg) e.currentTarget.style.borderColor = "var(--color-border-focus)";
              }}
              onBlur={(e) => {
                if (!errorMsg) e.currentTarget.style.borderColor = "var(--color-border)";
              }}
              autoComplete="off"
              readOnly
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>

          {errorMsg && (
            <p className="text-xs text-center" style={{ color: "var(--color-error)" }}>
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full py-2.5 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-primary)", color: "white" }}
          >
            {loading ? "Verificando..." : "Desbloquear"}
          </button>
        </form>

        {/* Sair */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
        >
          <FiLogOut size={13} />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
