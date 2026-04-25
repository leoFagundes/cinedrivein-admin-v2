"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import {
  FiCheck,
  FiX,
  FiUser,
  FiClock,
  FiUsers,
  FiSearch,
  FiShield,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiChevronDown,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { AppUser, Permission, PermissionProfile, UserStatus } from "@/types";
import { PERMISSION_GROUPS, PERMISSION_META } from "@/lib/permissions";
import { log } from "@/lib/logger";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};
const STATUS_COLOR: Record<UserStatus, { color: string; bg: string }> = {
  pending: { color: "var(--color-warning)", bg: "rgba(245,158,11,0.12)" },
  approved: { color: "var(--color-success)", bg: "rgba(34,197,94,0.12)" },
  rejected: { color: "var(--color-error)", bg: "rgba(239,68,68,0.12)" },
};

function StatusBadge({ status }: { status: UserStatus }) {
  const s = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}
      style={{ backgroundColor: "var(--color-primary)", color: "white" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />
      <div
        className="relative w-full max-w-md rounded-[var(--radius-xl)] flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-opacity hover:opacity-60"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Assign profile modal ─────────────────────────────────────────────────────

function AssignProfileModal({
  user,
  profiles,
  onAssign,
  onClose,
}: {
  user: AppUser;
  profiles: PermissionProfile[];
  onAssign: (uid: string, profile: PermissionProfile | null) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(
    user.profileId ?? null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const profile = profiles.find((p) => p.id === selected) ?? null;
    await onAssign(user.uid, profile);
    setLoading(false);
    onClose();
  }

  return (
    <Modal title={`Perfil de @${user.username}`} onClose={onClose}>
      <div className="p-6 flex flex-col gap-3">
        <p
          className="text-sm mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          Selecione o perfil de permissões para este usuário.
        </p>

        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] text-left transition-all cursor-pointer"
          style={{
            border: `1px solid ${selected === null ? "var(--color-primary)" : "var(--color-border)"}`,
            backgroundColor:
              selected === null
                ? "var(--color-primary-light)"
                : "var(--color-bg-elevated)",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "var(--color-bg-base)",
              color: "var(--color-text-muted)",
            }}
          >
            <FiUser size={14} />
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Sem perfil
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Sem permissões especiais
            </p>
          </div>
        </button>

        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] text-left transition-all cursor-pointer"
            style={{
              border: `1px solid ${selected === p.id ? "var(--color-primary)" : "var(--color-border)"}`,
              backgroundColor:
                selected === p.id
                  ? "var(--color-primary-light)"
                  : "var(--color-bg-elevated)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: "rgba(0,136,194,0.2)",
                color: "var(--color-primary)",
              }}
            >
              <FiShield size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {p.name}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--color-text-muted)" }}
              >
                {p.permissions.length} permissão
                {p.permissions.length !== 1 ? "ões" : ""}
              </p>
            </div>
          </button>
        ))}

        <button
          onClick={handleSave}
          disabled={loading}
          className="mt-2 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Create / edit profile modal ──────────────────────────────────────────────

function ProfileModal({
  existing,
  onSave,
  onClose,
}: {
  existing?: PermissionProfile;
  onSave: (name: string, permissions: Permission[]) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [perms, setPerms] = useState<Set<Permission>>(
    new Set(existing?.permissions ?? []),
  );
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  function toggle(p: Permission) {
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError("Nome obrigatório");
      return;
    }
    setLoading(true);
    await onSave(name.trim(), Array.from(perms));
    setLoading(false);
    onClose();
  }

  return (
    <Modal title={existing ? "Editar perfil" : "Novo perfil"} onClose={onClose}>
      <div className="p-6 flex flex-col gap-5">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Nome do perfil
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError("");
            }}
            placeholder="Ex: Caixa, Gerente..."
            className="h-10 px-3 text-sm rounded-[var(--radius-md)] outline-none"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: `1px solid ${nameError ? "var(--color-error)" : "var(--color-border)"}`,
              color: "var(--color-text-primary)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-border-focus)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = nameError
                ? "var(--color-error)"
                : "var(--color-border)")
            }
          />
          {nameError && (
            <span className="text-xs" style={{ color: "var(--color-error)" }}>
              {nameError}
            </span>
          )}
        </div>

        {/* Permissions */}
        <div className="flex flex-col gap-4">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Permissões
          </p>
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.permissions.map((perm) => {
                  const meta = PERMISSION_META[perm];
                  const checked = perms.has(perm);
                  return (
                    <button
                      key={perm}
                      onClick={() => toggle(perm)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all cursor-pointer"
                      style={{
                        backgroundColor: checked
                          ? "var(--color-primary-light)"
                          : "var(--color-bg-elevated)",
                        border: `1px solid ${checked ? "var(--color-primary)40" : "var(--color-border)"}`,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: checked
                            ? "var(--color-primary)"
                            : "transparent",
                          border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border)"}`,
                        }}
                      >
                        {checked && <FiCheck size={10} color="white" />}
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {meta.label}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {meta.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="h-10 rounded-[var(--radius-md)] text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading
            ? "Salvando..."
            : existing
              ? "Salvar alterações"
              : "Criar perfil"}
        </button>
      </div>
    </Modal>
  );
}

// ─── User card (mobile) ───────────────────────────────────────────────────────

function UserCard({
  user,
  isOwnerViewing,
  onApprove,
  onReject,
  onAssign,
}: {
  user: AppUser;
  isOwnerViewing: boolean;
  onApprove: (uid: string) => void;
  onReject: (uid: string) => void;
  onAssign: (user: AppUser) => void;
}) {
  return (
    <div
      className="p-4 rounded-[var(--radius-lg)] flex flex-col gap-3"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={user.username} size={9} />
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              @{user.username}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: "var(--color-text-muted)" }}
            >
              {user.email}
            </p>
          </div>
        </div>
        <StatusBadge status={user.status} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FiShield size={12} style={{ color: "var(--color-text-muted)" }} />
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {user.isOwner ? "Owner" : (user.profileName ?? "Sem perfil")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {user.status === "pending" && !user.isOwner && (
            <>
              <button
                onClick={() => onApprove(user.uid)}
                title="Aprovar"
                className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
                style={{
                  backgroundColor: "rgba(34,197,94,0.12)",
                  color: "var(--color-success)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(34,197,94,0.25)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(34,197,94,0.12)")
                }
              >
                <FiCheck size={14} />
              </button>
              <button
                onClick={() => onReject(user.uid)}
                title="Rejeitar"
                className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
                style={{
                  backgroundColor: "rgba(239,68,68,0.12)",
                  color: "var(--color-error)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(239,68,68,0.25)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(239,68,68,0.12)")
                }
              >
                <FiX size={14} />
              </button>
            </>
          )}
          {user.status === "approved" && !user.isOwner && isOwnerViewing && (
            <button
              onClick={() => onAssign(user)}
              title="Atribuir perfil"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-border)")
              }
            >
              <FiEdit2 size={12} /> Perfil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: PermissionProfile;
  onEdit: (p: PermissionProfile) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: "rgba(0,136,194,0.15)",
            color: "var(--color-primary)",
          }}
        >
          <FiShield size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {profile.name}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {profile.permissions.length} permissão
            {profile.permissions.length !== 1 ? "ões" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            title="Ver permissões"
            className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--color-bg-elevated)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <FiChevronDown
              size={15}
              style={{
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
          <button
            onClick={() => onEdit(profile)}
            title="Editar"
            className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--color-bg-elevated)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <FiEdit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(profile.id)}
            title="Excluir"
            className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
              e.currentTarget.style.color = "var(--color-error)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-muted)";
            }}
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div
          className="px-4 pb-4 flex flex-wrap gap-1.5"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="pt-3 w-full flex flex-wrap gap-1.5">
            {profile.permissions.length === 0 ? (
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nenhuma permissão
              </span>
            ) : (
              profile.permissions.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                  }}
                >
                  {PERMISSION_META[p].label}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "users" | "profiles";
type Filter = "all" | UserStatus;

export default function UsersPage() {
  const { appUser } = useAuth();
  const { success, error, warning } = useToast();
  const isOwner = appUser?.isOwner ?? false;

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const [assignTarget, setAssignTarget] = useState<AppUser | null>(null);
  const [profileModal, setProfileModal] = useState<{
    open: boolean;
    editing?: PermissionProfile;
  }>({ open: false });

  // Load users
  useEffect(() => {
    getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")))
      .then((snap) => {
        setUsers(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              username: data.username,
              email: data.email,
              status: data.status,
              isOwner: data.isOwner ?? false,
              profileId: data.profileId,
              profileName: data.profileName,
              createdAt: data.createdAt?.toDate() ?? new Date(),
            };
          }),
        );
      })
      .catch(() =>
        error("Erro ao carregar usuários", "Tente recarregar a página."),
      )
      .finally(() => setLoadingUsers(false));
  }, []);

  // Load profiles
  useEffect(() => {
    getDocs(
      query(collection(db, "permissionProfiles"), orderBy("createdAt", "asc")),
    )
      .then((snap) => {
        setProfiles(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name,
            permissions: d.data().permissions ?? [],
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          })),
        );
      })
      .catch(() =>
        error("Erro ao carregar perfis", "Tente recarregar a página."),
      )
      .finally(() => setLoadingProfiles(false));
  }, []);

  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "unknown", username: "unknown" };

  // Actions
  async function handleApprove(uid: string) {
    const user = users.find((u) => u.uid === uid);
    try {
      await updateDoc(doc(db, "users", uid), { status: "approved" });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: "approved" } : u)),
      );
      success(
        "Usuário aprovado",
        `@${user?.username} agora tem acesso ao sistema.`,
      );
      log({
        action: "approve_user",
        category: "users",
        description: `Aprovou o usuário @${user?.username}`,
        performedBy: actor,
        target: { type: "user", id: uid, name: user?.username ?? uid },
        changes: [{ field: "status", from: "pending", to: "approved" }],
      });
    } catch {
      error("Erro ao aprovar", "Tente novamente.");
    }
  }

  async function handleReject(uid: string) {
    const user = users.find((u) => u.uid === uid);
    try {
      await updateDoc(doc(db, "users", uid), { status: "rejected" });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: "rejected" } : u)),
      );
      warning(
        "Usuário rejeitado",
        `O acesso de @${user?.username} foi negado.`,
      );
      log({
        action: "reject_user",
        category: "users",
        description: `Rejeitou o usuário @${user?.username}`,
        performedBy: actor,
        target: { type: "user", id: uid, name: user?.username ?? uid },
        changes: [{ field: "status", from: "pending", to: "rejected" }],
      });
    } catch {
      error("Erro ao rejeitar", "Tente novamente.");
    }
  }

  async function handleAssignProfile(
    uid: string,
    profile: PermissionProfile | null,
  ) {
    const user = users.find((u) => u.uid === uid);
    const previousProfile = user?.profileName ?? null;
    try {
      await updateDoc(doc(db, "users", uid), {
        profileId: profile?.id ?? null,
        profileName: profile?.name ?? null,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? { ...u, profileId: profile?.id, profileName: profile?.name }
            : u,
        ),
      );
      success(
        "Perfil atualizado",
        profile ? `Perfil "${profile.name}" atribuído.` : "Perfil removido.",
      );
      log({
        action: "assign_profile",
        category: "users",
        description: profile
          ? `Atribuiu o perfil "${profile.name}" a @${user?.username}`
          : `Removeu o perfil de @${user?.username}`,
        performedBy: actor,
        target: { type: "user", id: uid, name: user?.username ?? uid },
        changes: [
          { field: "perfil", from: previousProfile, to: profile?.name ?? null },
        ],
      });
    } catch {
      error("Erro ao atribuir perfil", "Tente novamente.");
    }
  }

  async function handleSaveProfile(
    name: string,
    permissions: Permission[],
    editing?: PermissionProfile,
  ) {
    try {
      if (editing) {
        await updateDoc(doc(db, "permissionProfiles", editing.id), {
          name,
          permissions,
        });
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === editing.id ? { ...p, name, permissions } : p,
          ),
        );
        success("Perfil atualizado", `"${name}" foi atualizado.`);
        log({
          action: "update_profile",
          category: "profiles",
          description: `Atualizou o perfil "${name}" (${permissions.length} permissão${permissions.length !== 1 ? "ões" : ""})`,
          performedBy: actor,
          target: { type: "profile", id: editing.id, name },
          changes: [
            {
              field: "permissões",
              from: `${editing.permissions.length}`,
              to: `${permissions.length}`,
            },
          ],
        });
      } else {
        const ref = await addDoc(collection(db, "permissionProfiles"), {
          name,
          permissions,
          createdAt: serverTimestamp(),
        });
        setProfiles((prev) => [
          ...prev,
          { id: ref.id, name, permissions, createdAt: new Date() },
        ]);
        success("Perfil criado", `"${name}" está disponível para atribuição.`);
        log({
          action: "create_profile",
          category: "profiles",
          description: `Criou o perfil "${name}" com ${permissions.length} permissão${permissions.length !== 1 ? "ões" : ""}`,
          performedBy: actor,
          target: { type: "profile", id: ref.id, name },
        });
      }
    } catch {
      error("Erro ao salvar perfil", "Tente novamente.");
    }
  }

  async function handleDeleteProfile(id: string) {
    const profile = profiles.find((p) => p.id === id);
    try {
      await deleteDoc(doc(db, "permissionProfiles", id));
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      success("Perfil removido", `"${profile?.name}" foi excluído.`);
      log({
        action: "delete_profile",
        category: "profiles",
        description: `Excluiu o perfil "${profile?.name}"`,
        performedBy: actor,
        target: { type: "profile", id, name: profile?.name ?? id },
      });
    } catch {
      error("Erro ao remover perfil", "Tente novamente.");
    }
  }

  // Filtered users
  const filtered = users.filter((u) => {
    const matchFilter = filter === "all" || u.status === filter;
    const matchSearch =
      !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const total = users.length;
  const pending = users.filter((u) => u.status === "pending").length;
  const approved = users.filter((u) => u.status === "approved").length;

  const filterOptions: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "rejected", label: "Rejeitados" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full ">
      {/* Header */}
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Controle de Usuários
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Gerencie usuários e perfis de permissão do sistema.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total",
            value: total,
            icon: <FiUsers size={16} />,
            color: "var(--color-primary)",
          },
          {
            label: "Pendentes",
            value: pending,
            icon: <FiClock size={16} />,
            color: "var(--color-warning)",
          },
          {
            label: "Aprovados",
            value: approved,
            icon: <FiUser size={16} />,
            color: "var(--color-success)",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-[var(--radius-lg)]"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${s.color}18`, color: s.color }}
            >
              {s.icon}
            </div>
            <div>
              <p
                className="text-lg sm:text-2xl font-bold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {s.value}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {[
          {
            key: "users" as Tab,
            label: "Usuários",
            icon: <FiUsers size={14} />,
          },
          ...(isOwner
            ? [
                {
                  key: "profiles" as Tab,
                  label: "Perfis de Permissão",
                  icon: <FiShield size={14} />,
                },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px cursor-pointer transition-all"
            style={{
              color:
                tab === t.key
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
              borderBottom: `2px solid ${tab === t.key ? "var(--color-primary)" : "transparent"}`,
            }}
          >
            {t.icon}
            {t.label}
            {t.key === "users" && pending > 0 && (
              <span
                className="w-4 h-4 rounded-full text-xs flex items-center justify-center"
                style={{
                  backgroundColor: "var(--color-warning)",
                  color: "white",
                }}
              >
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Users ── */}
      {tab === "users" && (
        <div className="flex flex-col gap-4">
          {/* Filters + Search */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor:
                      filter === f.key
                        ? "var(--color-primary)"
                        : "var(--color-bg-elevated)",
                    color:
                      filter === f.key
                        ? "white"
                        : "var(--color-text-secondary)",
                    border: `1px solid ${filter === f.key ? "var(--color-primary)" : "var(--color-border)"}`,
                    flexShrink: 0,
                  }}
                >
                  {f.label}
                  {f.key === "pending" && pending > 0 && (
                    <span
                      className="w-4 h-4 rounded-full text-xs flex items-center justify-center"
                      style={{
                        backgroundColor:
                          filter === "pending"
                            ? "white"
                            : "var(--color-warning)",
                        color:
                          filter === "pending"
                            ? "var(--color-warning)"
                            : "white",
                      }}
                    >
                      {pending}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <FiSearch
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 pr-4 text-sm rounded-[var(--radius-md)] outline-none w-full sm:w-56"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor =
                    "var(--color-border-focus)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--color-border)")
                }
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-16">
              <svg
                className="animate-spin w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-20"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="var(--color-primary)"
                  strokeWidth="3"
                />
                <path
                  className="opacity-80"
                  fill="var(--color-primary)"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FiUsers size={32} style={{ color: "var(--color-text-muted)" }} />
              <p
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nenhum usuário encontrado
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {filtered.map((user) => (
                  <UserCard
                    key={user.uid}
                    user={user}
                    isOwnerViewing={isOwner}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onAssign={setAssignTarget}
                  />
                ))}
              </div>

              {/* Desktop: table */}
              <div
                className="hidden sm:block rounded-[var(--radius-lg)] overflow-hidden"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-bg-elevated)",
                      }}
                    >
                      {["Usuário", "E-mail", "Perfil", "Status", "Ações"].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user, i) => (
                      <tr
                        key={user.uid}
                        style={{
                          borderBottom:
                            i < filtered.length - 1
                              ? "1px solid var(--color-border)"
                              : "none",
                          backgroundColor: "var(--color-bg-surface)",
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.username} />
                            <div>
                              <p
                                className="text-sm font-medium"
                                style={{ color: "var(--color-text-primary)" }}
                              >
                                {user.username}
                              </p>
                              {user.isOwner && (
                                <span
                                  className="text-xs"
                                  style={{ color: "var(--color-primary)" }}
                                >
                                  Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-sm"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {user.email}
                        </td>
                        <td
                          className="px-4 py-3 text-sm"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {user.isOwner
                            ? "—"
                            : (user.profileName ?? "Sem perfil")}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {user.status === "pending" && !user.isOwner && (
                              <>
                                <button
                                  onClick={() => handleApprove(user.uid)}
                                  title="Aprovar"
                                  className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
                                  style={{
                                    backgroundColor: "rgba(34,197,94,0.12)",
                                    color: "var(--color-success)",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(34,197,94,0.25)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(34,197,94,0.12)")
                                  }
                                >
                                  <FiCheck size={14} />
                                </button>
                                <button
                                  onClick={() => handleReject(user.uid)}
                                  title="Rejeitar"
                                  className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
                                  style={{
                                    backgroundColor: "rgba(239,68,68,0.12)",
                                    color: "var(--color-error)",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(239,68,68,0.25)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(239,68,68,0.12)")
                                  }
                                >
                                  <FiX size={14} />
                                </button>
                              </>
                            )}
                            {user.status === "approved" &&
                              !user.isOwner &&
                              isOwner && (
                                <button
                                  onClick={() => setAssignTarget(user)}
                                  title="Atribuir perfil"
                                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-all"
                                  style={{
                                    backgroundColor: "var(--color-bg-elevated)",
                                    color: "var(--color-text-secondary)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.borderColor =
                                      "var(--color-primary)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.borderColor =
                                      "var(--color-border)")
                                  }
                                >
                                  <FiEdit2 size={11} /> Perfil
                                </button>
                              )}
                            {(user.isOwner ||
                              (user.status !== "pending" &&
                                !(user.status === "approved" && isOwner))) && (
                              <span
                                className="text-xs"
                                style={{ color: "var(--color-text-muted)" }}
                              >
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Profiles ── */}
      {tab === "profiles" && isOwner && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {profiles.length} perfil{profiles.length !== 1 ? "is" : ""} criado
              {profiles.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setProfileModal({ open: true })}
              className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer transition-all"
              style={{ backgroundColor: "var(--color-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-primary-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--color-primary)")
              }
            >
              <FiPlus size={15} /> Novo perfil
            </button>
          </div>

          {loadingProfiles ? (
            <div className="flex justify-center py-16">
              <svg
                className="animate-spin w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-20"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="var(--color-primary)"
                  strokeWidth="3"
                />
                <path
                  className="opacity-80"
                  fill="var(--color-primary)"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FiShield
                size={32}
                style={{ color: "var(--color-text-muted)" }}
              />
              <p
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nenhum perfil criado ainda
              </p>
              <button
                onClick={() => setProfileModal({ open: true })}
                className="text-sm font-medium"
                style={{ color: "var(--color-primary)" }}
              >
                Criar primeiro perfil
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  onEdit={(p) => setProfileModal({ open: true, editing: p })}
                  onDelete={handleDeleteProfile}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {assignTarget && (
        <AssignProfileModal
          user={assignTarget}
          profiles={profiles}
          onAssign={handleAssignProfile}
          onClose={() => setAssignTarget(null)}
        />
      )}
      {profileModal.open && (
        <ProfileModal
          existing={profileModal.editing}
          onSave={(name, perms) =>
            handleSaveProfile(name, perms, profileModal.editing)
          }
          onClose={() => setProfileModal({ open: false })}
        />
      )}
    </div>
  );
}
