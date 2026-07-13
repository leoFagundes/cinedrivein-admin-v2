"use client";

import { useEffect, useState } from "react";
import {
  FiX,
  FiZap,
  FiSlash,
  FiBell,
  FiBellOff,
  FiTerminal,
  FiShield,
  FiHash,
  FiSkipForward,
  FiRotateCcw,
  FiUsers,
} from "react-icons/fi";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PermissionProfile } from "@/types";
import {
  DevModeFlags,
  dispatchDevModeChange,
  getDevMode,
  isDevModeActive,
  resetDevMode,
  setDevMode,
} from "@/lib/devMode";

const FLAGS: {
  key: Exclude<keyof DevModeFlags, "simulateRole">;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "disableLogs",
    label: "Desativar logs",
    description: "Ignora todas as chamadas de log (nada é gravado no Firestore)",
    icon: <FiSlash size={14} />,
  },
  {
    key: "logToConsole",
    label: "Logs no console",
    description: "Redireciona logs para console.log em vez do Firestore",
    icon: <FiTerminal size={14} />,
  },
  {
    key: "disableToasts",
    label: "Desativar toasts",
    description:
      "Suprime notificações de sucesso/info/warning (erros continuam aparecendo)",
    icon: <FiBellOff size={14} />,
  },
  {
    key: "bypassPermissions",
    label: "Bypass de permissões",
    description:
      "Ignora checagens de can() — simula acesso total independente da role",
    icon: <FiShield size={14} />,
  },
  {
    key: "showDocIds",
    label: "Mostrar IDs do Firestore",
    description:
      "Exibe os IDs de documentos em cards de itens, subitens, pedidos e usuários",
    icon: <FiHash size={14} />,
  },
  {
    key: "skipConfirmations",
    label: "Pular confirmações",
    description:
      "Executa ações destrutivas (excluir, cancelar, fechar expediente) sem modal de confirmação",
    icon: <FiSkipForward size={14} />,
  },
];

export default function DevModePanel() {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<DevModeFlags>(getDevMode);
  const [active, setActive] = useState(() => isDevModeActive());
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Sync badge when flags change (from this panel or any other source)
  useEffect(() => {
    function sync() {
      setActive(isDevModeActive());
      setFlags(getDevMode());
    }
    window.addEventListener("devmode:change", sync);
    return () => window.removeEventListener("devmode:change", sync);
  }, []);

  // Fetch profiles when panel opens
  useEffect(() => {
    if (!open || profiles.length > 0) return;
    setLoadingProfiles(true);
    getDocs(query(collection(db, "permissionProfiles"), orderBy("createdAt", "asc")))
      .then((snap) =>
        setProfiles(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PermissionProfile, "id">),
          })),
        ),
      )
      .finally(() => setLoadingProfiles(false));
  }, [open, profiles.length]);

  function selectRole(profile: PermissionProfile | null) {
    const next = profile
      ? { name: profile.name, permissions: profile.permissions }
      : null;
    setDevMode({ simulateRole: next });
    setFlags(getDevMode());
    dispatchDevModeChange();
  }

  // Listener Ctrl+Shift+D
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setFlags(getDevMode());
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function toggle(key: Exclude<keyof DevModeFlags, "simulateRole">) {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    setDevMode({ [key]: next[key] });
    dispatchDevModeChange();
  }

  function reset() {
    resetDevMode();
    const cleared = getDevMode();
    setFlags(cleared);
    dispatchDevModeChange();
  }

  if (!open && !active) return null;

  return (
    <>
      {/* Badge DEV — visível quando qualquer flag estiver ativa e o modal estiver fechado */}
      {active && !open && (
        <button
          onClick={() => {
            setFlags(getDevMode());
            setOpen(true);
          }}
          className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer select-none"
          style={{
            backgroundColor: "rgba(234,179,8,0.15)",
            border: "1px solid rgba(234,179,8,0.4)",
            color: "rgb(234,179,8)",
            boxShadow: "0 0 12px rgba(234,179,8,0.15)",
          }}
          title="Dev Mode ativo — Ctrl+Shift+D para abrir"
        >
          <FiZap size={11} />
          DEV
          {flags.simulateRole && (
            <span style={{ opacity: 0.8 }}>· {flags.simulateRole.name}</span>
          )}
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          />
          <div
            className="relative w-full max-w-md rounded-xl flex flex-col max-h-[90vh]"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid rgba(234,179,8,0.35)",
              boxShadow: "0 0 40px rgba(234,179,8,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-2">
                <FiZap size={15} style={{ color: "rgb(234,179,8)" }} />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Dev Mode
                </h2>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{
                    backgroundColor: "rgba(234,179,8,0.12)",
                    color: "rgb(234,179,8)",
                    border: "1px solid rgba(234,179,8,0.3)",
                  }}
                >
                  localStorage
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded cursor-pointer hover:opacity-60"
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiX size={15} />
              </button>
            </div>

            {/* Flags */}
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              <p
                className="text-xs mb-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                Flags persistem no localStorage deste navegador e afetam apenas
                esta sessão. Ctrl+Shift+D para abrir/fechar.
              </p>

              {FLAGS.map(({ key, label, description, icon }) => {
                const enabled = flags[key];
                return (
                  <div
                    key={key}
                    onClick={() => toggle(key)}
                    className="flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer"
                    style={{
                      backgroundColor: enabled
                        ? "rgba(234,179,8,0.07)"
                        : "var(--color-bg-elevated)",
                      border: `1px solid ${enabled ? "rgba(234,179,8,0.3)" : "var(--color-border)"}`,
                    }}
                  >
                    {/* Toggle */}
                    <div
                      className="w-8 h-5 rounded-full shrink-0 mt-0.5 relative transition-colors"
                      style={{
                        backgroundColor: enabled
                          ? "rgb(234,179,8)"
                          : "var(--color-border)",
                      }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                        style={{
                          backgroundColor: "white",
                          transform: enabled
                            ? "translateX(14px)"
                            : "translateX(2px)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          style={{
                            color: enabled
                              ? "rgb(234,179,8)"
                              : "var(--color-text-muted)",
                          }}
                        >
                          {icon}
                        </span>
                        <p
                          className="text-sm font-medium"
                          style={{
                            color: enabled
                              ? "rgb(234,179,8)"
                              : "var(--color-text-primary)",
                          }}
                        >
                          {label}
                        </p>
                      </div>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {description}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Role simulator */}
              <div
                className="mt-2 pt-3"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <FiUsers size={12} style={{ color: "var(--color-text-muted)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    Simular perfil
                  </p>
                </div>

                {loadingProfiles ? (
                  <p className="text-xs py-1" style={{ color: "var(--color-text-muted)" }}>
                    Carregando perfis...
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {/* Nenhum */}
                    <button
                      onClick={() => selectRole(null)}
                      className="text-xs px-2.5 py-1 rounded-md cursor-pointer transition-all"
                      style={
                        flags.simulateRole === null
                          ? {
                              backgroundColor: "rgba(234,179,8,0.12)",
                              border: "1px solid rgba(234,179,8,0.4)",
                              color: "rgb(234,179,8)",
                              fontWeight: 600,
                            }
                          : {
                              backgroundColor: "var(--color-bg-elevated)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-text-secondary)",
                            }
                      }
                    >
                      Nenhum (real)
                    </button>

                    {profiles.length === 0 ? (
                      <p className="text-xs py-1" style={{ color: "var(--color-text-muted)" }}>
                        Nenhum perfil encontrado.
                      </p>
                    ) : (
                      profiles.map((p) => {
                        const active = flags.simulateRole?.name === p.name;
                        return (
                          <button
                            key={p.id}
                            onClick={() => selectRole(p)}
                            className="text-xs px-2.5 py-1 rounded-md cursor-pointer transition-all"
                            style={
                              active
                                ? {
                                    backgroundColor: "rgba(234,179,8,0.12)",
                                    border: "1px solid rgba(234,179,8,0.4)",
                                    color: "rgb(234,179,8)",
                                    fontWeight: 600,
                                  }
                                : {
                                    backgroundColor: "var(--color-bg-elevated)",
                                    border: "1px solid var(--color-border)",
                                    color: "var(--color-text-secondary)",
                                  }
                            }
                          >
                            {p.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {flags.simulateRole && (
                  <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                    {flags.simulateRole.permissions.length} permissão(ões) ativa(s) —{" "}
                    <span style={{ color: "rgb(234,179,8)" }}>isOwner ignorado</span>
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-4 py-3 shrink-0 flex items-center justify-between"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiBell size={10} className="inline mr-1" />
                Erros continuam aparecendo mesmo com toasts desativados
              </p>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded cursor-pointer transition-all"
                style={{
                  backgroundColor: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "var(--color-error)",
                }}
                title="Resetar todas as flags"
              >
                <FiRotateCcw size={11} />
                Resetar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
