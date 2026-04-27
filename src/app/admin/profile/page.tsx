"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, getDoc, writeBatch } from "firebase/firestore";
import {
  FiUser,
  FiMail,
  FiShield,
  FiRefreshCw,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { log } from "@/lib/logger";
import DiceBearAvatar from "@/components/ui/DiceBearAvatar";

// ─── DiceBear config ──────────────────────────────────────────────────────────

const AVATAR_STYLES: { id: string; label: string; bg: string }[] = [
  { id: "adventurer", label: "Aventureiro", bg: "#fff3e0" },
  { id: "avataaars", label: "Cartoon", bg: "#e3f2fd" },
  { id: "bottts", label: "Robô", bg: "#e8f5e9" },
  { id: "fun-emoji", label: "Emoji", bg: "#fffde7" },
  { id: "lorelei", label: "Lorelei", bg: "#f3e5f5" },
  { id: "micah", label: "Micah", bg: "#fce4ec" },
  { id: "pixel-art", label: "Pixel Art", bg: "#e8eaf6" },
  { id: "thumbs", label: "Thumbs", bg: "#e0f7fa" },
  { id: "notionists", label: "Notion", bg: "#fff8e1" },
  { id: "open-peeps", label: "Esboço", bg: "#f1f8e9" },
  { id: "big-smile", label: "Big Smile", bg: "#fbe9e7" },
  { id: "croodles", label: "Croodles", bg: "#f9fbe7" },
];

const SEEDS = [
  "Felix",
  "Luna",
  "Max",
  "Zoe",
  "Alex",
  "Mia",
  "Jordan",
  "Sam",
  "Casey",
  "Riley",
  "Morgan",
  "Quinn",
  "Leo",
  "Ivy",
  "Kai",
  "Nova",
  "Ace",
  "Vera",
  "Dex",
  "Aria",
  "Cole",
  "Skye",
  "Beau",
  "Eden",
];

// ─── Avatar picker ────────────────────────────────────────────────────────────

function AvatarPicker({
  selectedStyle,
  selectedSeed,
  onSelect,
}: {
  selectedStyle: string;
  selectedSeed: string;
  onSelect: (style: string, seed: string) => void;
}) {
  const [activeStyle, setActiveStyle] = useState(
    selectedStyle || AVATAR_STYLES[0].id,
  );
  const [customSeed, setCustomSeed] = useState("");
  const [customPreview, setCustomPreview] = useState<string | null>(null);

  function handleStyleClick(id: string) {
    setActiveStyle(id);
    onSelect(id, selectedSeed || SEEDS[0]);
  }

  function handleSeedClick(seed: string) {
    onSelect(activeStyle, seed);
  }

  function handleCustomPreview() {
    if (!customSeed.trim()) return;
    setCustomPreview(customSeed.trim());
    onSelect(activeStyle, customSeed.trim());
  }

  const currentStyleMeta = AVATAR_STYLES.find((s) => s.id === activeStyle);

  return (
    <div className="flex flex-col gap-5">
      {/* Style selector */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          Estilo
        </p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => handleStyleClick(style.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
              style={{
                border: `1.5px solid ${activeStyle === style.id ? "var(--color-primary)" : "var(--color-border)"}`,
                backgroundColor:
                  activeStyle === style.id
                    ? "var(--color-primary-light)"
                    : "var(--color-bg-elevated)",
                color:
                  activeStyle === style.id
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
              }}
            >
              <div
                className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"
                style={{ backgroundColor: style.bg }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/9.x/${style.id}/svg?seed=preview`}
                  width={20}
                  height={20}
                  alt={style.label}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seed grid */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          Variações
        </p>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
          {SEEDS.map((seed) => {
            const isSelected =
              selectedSeed === seed && selectedStyle === activeStyle;
            return (
              <button
                key={seed}
                onClick={() => handleSeedClick(seed)}
                title={seed}
                className="aspect-square rounded-[var(--radius-md)] overflow-hidden cursor-pointer transition-all p-0.5"
                style={{
                  border: `2px solid ${isSelected ? "var(--color-primary)" : "transparent"}`,
                  backgroundColor: isSelected
                    ? "var(--color-primary-light)"
                    : (currentStyleMeta?.bg ?? "var(--color-bg-elevated)"),
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.borderColor = "var(--color-border)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.borderColor = "transparent";
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/9.x/${activeStyle}/svg?seed=${encodeURIComponent(seed)}`}
                  alt={seed}
                  width={48}
                  height={48}
                  style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom seed */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          Semente personalizada
        </p>
        <div className="flex gap-2">
          <input
            value={customSeed}
            onChange={(e) => setCustomSeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomPreview();
            }}
            placeholder="Digite qualquer texto..."
            className="flex-1 h-9 px-3 text-sm rounded-[var(--radius-md)] outline-none"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-border-focus)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-border)")
            }
          />
          <button
            onClick={handleCustomPreview}
            disabled={!customSeed.trim()}
            className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-[var(--radius-md)] cursor-pointer disabled:opacity-50 transition-all"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-border)")
            }
          >
            <FiCheck size={14} />
            Usar
          </button>
        </div>
        {customPreview && selectedSeed === customPreview && (
          <p
            className="text-xs mt-1.5"
            style={{ color: "var(--color-success)" }}
          >
            Semente &quot;{customPreview}&quot; aplicada.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { appUser, refreshUser } = useAuth();
  const { success, error } = useToast();

  const [username, setUsername] = useState(appUser?.username ?? "");
  const [usernameError, setUsernameError] = useState("");

  const [avatarStyle, setAvatarStyle] = useState(appUser?.avatarStyle ?? "");
  const [avatarSeed, setAvatarSeed] = useState(appUser?.avatarSeed ?? "");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sync with appUser after refresh
  useEffect(() => {
    if (appUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(appUser.username);
      setAvatarStyle(appUser.avatarStyle ?? "");
      setAvatarSeed(appUser.avatarSeed ?? "");
    }
  }, [appUser]);

  const hasAvatar = avatarStyle && avatarSeed;
  const avatarChanged =
    avatarStyle !== (appUser?.avatarStyle ?? "") ||
    avatarSeed !== (appUser?.avatarSeed ?? "");
  const usernameChanged = username.trim() !== (appUser?.username ?? "");
  const hasChanges = avatarChanged || usernameChanged;

  function handleAvatarSelect(style: string, seed: string) {
    setAvatarStyle(style);
    setAvatarSeed(seed);
  }

  async function handleSave() {
    if (!appUser) return;

    const newUsername = username.trim();
    if (!newUsername) {
      setUsernameError("Usuário obrigatório");
      return;
    }
    if (newUsername.includes(" ")) {
      setUsernameError("Sem espaços no usuário");
      return;
    }

    setSaving(true);
    try {
      const changes: {
        field: string;
        from: string | null;
        to: string | null;
      }[] = [];

      // Check username availability if changed
      if (usernameChanged) {
        const snap = await getDoc(doc(db, "usernames", newUsername));
        if (snap.exists() && snap.data().uid !== appUser.uid) {
          setUsernameError("Usuário já em uso");
          return;
        }
      }

      // Build update payload
      const updates: Record<string, unknown> = {};
      if (usernameChanged) {
        updates.username = newUsername;
        changes.push({
          field: "Usuário",
          from: appUser.username,
          to: newUsername,
        });
      }
      if (avatarChanged) {
        updates.avatarStyle = avatarStyle || null;
        updates.avatarSeed = avatarSeed || null;
        if (avatarStyle && avatarSeed) {
          changes.push({
            field: "Avatar",
            from: appUser.avatarStyle ?? null,
            to: avatarStyle,
          });
        }
      }

      await updateDoc(doc(db, "users", appUser.uid), updates);

      // Update usernames collection if username changed
      if (usernameChanged) {
        const batch = writeBatch(db);
        batch.delete(doc(db, "usernames", appUser.username));
        batch.set(doc(db, "usernames", newUsername), {
          uid: appUser.uid,
          email: appUser.email,
        });
        await batch.commit();
      }

      if (changes.length > 0) {
        log({
          action: "update_profile_self",
          category: "users",
          description: `Atualizou o próprio perfil`,
          performedBy: { uid: appUser.uid, username: appUser.username },
          target: { type: "user", id: appUser.uid, name: appUser.username },
          changes,
        });
      }

      await refreshUser();
      success("Perfil salvo!", "Suas informações foram atualizadas.");
      setUsernameError("");
    } catch (err) {
      console.error(err);
      error("Erro ao salvar", "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshAvatar() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 300));
    const randomSeed = Math.random().toString(36).slice(2, 8);
    const randomStyle =
      AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    setAvatarStyle(randomStyle.id);
    setAvatarSeed(randomSeed);
    setRefreshing(false);
  }

  if (!appUser) return null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Meu Perfil
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Edite seu avatar e informações pessoais.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary)" }}
          onMouseEnter={(e) => {
            if (!saving && hasChanges)
              e.currentTarget.style.backgroundColor =
                "var(--color-primary-hover)";
          }}
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--color-primary)")
          }
        >
          <FiCheck size={15} />
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Avatar card */}
      <div
        className="rounded-[var(--radius-xl)] overflow-hidden"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Avatar preview */}
        <div
          className="flex flex-col sm:flex-row items-center gap-6 p-6"
          style={{
            borderBottom: pickerOpen ? "1px solid var(--color-border)" : "none",
          }}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                backgroundColor: hasAvatar
                  ? (AVATAR_STYLES.find((s) => s.id === avatarStyle)?.bg ??
                    "var(--color-bg-elevated)")
                  : "var(--color-primary)",
                border: "3px solid var(--color-border)",
              }}
            >
              {hasAvatar ? (
                <DiceBearAvatar
                  style={avatarStyle}
                  seed={avatarSeed}
                  size={96}
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {appUser.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {avatarChanged && (
              <div
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "var(--color-primary)",
                  border: "2px solid var(--color-bg-surface)",
                }}
              >
                <FiCheck size={10} color="white" />
              </div>
            )}
          </div>

          {/* Info + controls */}
          <div className="flex-1 text-center sm:text-left">
            <p
              className="text-lg font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              @{appUser.username}
            </p>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              {appUser.isOwner
                ? "Owner"
                : (appUser.profileName ?? "Sem perfil")}
            </p>
            {hasAvatar && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {AVATAR_STYLES.find((s) => s.id === avatarStyle)?.label} ·{" "}
                {avatarSeed}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
                style={{
                  backgroundColor: pickerOpen
                    ? "var(--color-primary-light)"
                    : "var(--color-bg-elevated)",
                  border: `1px solid ${pickerOpen ? "var(--color-primary)" : "var(--color-border)"}`,
                  color: pickerOpen
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                }}
              >
                {pickerOpen ? (
                  <FiChevronUp size={13} />
                ) : (
                  <FiChevronDown size={13} />
                )}
                {pickerOpen ? "Fechar picker" : "Personalizar avatar"}
              </button>

              <button
                onClick={handleRefreshAvatar}
                disabled={refreshing}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
                title="Gerar avatar aleatório"
              >
                <FiRefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                />
                Aleatório
              </button>

              {hasAvatar && (
                <button
                  onClick={() => {
                    setAvatarStyle("");
                    setAvatarSeed("");
                  }}
                  className="flex items-center h-8 px-3 rounded-[var(--radius-md)] text-xs cursor-pointer transition-all"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--color-error)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--color-text-muted)")
                  }
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Picker (expandable) */}
        {pickerOpen && (
          <div className="p-6">
            <AvatarPicker
              selectedStyle={avatarStyle}
              selectedSeed={avatarSeed}
              onSelect={handleAvatarSelect}
            />
          </div>
        )}
      </div>

      {/* Info card */}
      <div
        className="rounded-[var(--radius-xl)] p-6 flex flex-col gap-5"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Informações pessoais
        </p>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Usuário
          </label>
          <div className="relative flex items-center">
            <span
              className="absolute left-3 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            >
              <FiUser size={15} />
            </span>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameError("");
              }}
              placeholder="Nome de usuário"
              className="w-full h-10 pl-9 pr-3 text-sm rounded-[var(--radius-md)] outline-none"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: `1px solid ${usernameError ? "var(--color-error)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = usernameError
                  ? "var(--color-error)"
                  : "var(--color-border-focus)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = usernameError
                  ? "var(--color-error)"
                  : "var(--color-border)")
              }
            />
          </div>
          {usernameError && (
            <span className="text-xs" style={{ color: "var(--color-error)" }}>
              {usernameError}
            </span>
          )}
        </div>

        {/* Email (readonly) */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            E-mail
          </label>
          <div className="relative flex items-center">
            <span
              className="absolute left-3 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            >
              <FiMail size={15} />
            </span>
            <input
              value={appUser.email}
              disabled
              className="w-full h-10 pl-9 pr-3 text-sm rounded-[var(--radius-md)] opacity-50 cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            O e-mail não pode ser alterado por aqui.
          </span>
        </div>

        {/* Profile / Role (readonly) */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Nível de acesso
          </label>
          <div className="flex items-center gap-2">
            <FiShield size={15} style={{ color: "var(--color-text-muted)" }} />
            {appUser.isOwner ? (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: "rgba(0,136,194,0.12)",
                  color: "var(--color-primary)",
                }}
              >
                Owner — acesso total
              </span>
            ) : appUser.profileName ? (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                }}
              >
                {appUser.profileName}
              </span>
            ) : (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Sem perfil — acesso restrito
              </span>
            )}
          </div>
        </div>

        {/* Permissions summary */}
        {!appUser.isOwner && appUser.permissions.length > 0 && (
          <div
            className="flex flex-col gap-2 pt-2"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <p
              className="text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              Suas permissões
            </p>
            <div className="flex flex-wrap gap-1.5">
              {appUser.permissions.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {p.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
