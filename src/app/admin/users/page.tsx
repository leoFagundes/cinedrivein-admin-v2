"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";

import { db, getSecondaryAuth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { can, canAny } from "@/lib/access";
import { AppUser, Permission, PermissionProfile, UserStatus } from "@/types";
import { PERMISSION_GROUPS, PERMISSION_META, ALL_PERMISSIONS, PermissionGroup } from "@/lib/permissions";
import { log } from "@/lib/logger";
import DiceBearAvatar from "@/components/ui/DiceBearAvatar";
import Input from "@/components/ui/Input";
import {
  FiShield,
  FiX,
  FiAlertTriangle,
  FiUser,
  FiMail,
  FiLock,
  FiCheck,
  FiEdit2,
  FiTrash2,
  FiChevronDown,
  FiPlus,
  FiUsers,
  FiClock,
  FiSearch,
} from "react-icons/fi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function Avatar({
  name,
  size = 8,
  avatarStyle,
  avatarSeed,
}: {
  name: string;
  size?: number;
  avatarStyle?: string;
  avatarSeed?: string;
}) {
  const px = size * 4; // size 8 → 32px, size 9 → 36px
  if (avatarStyle && avatarSeed) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0"
        style={{ width: px, height: px, flexShrink: 0 }}
      >
        <DiceBearAvatar style={avatarStyle} seed={avatarSeed} size={px} />
      </div>
    );
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}
      style={{ backgroundColor: "var(--color-primary)", color: "white" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: "rgba(239,68,68,0.1)",
          color: "var(--color-error)",
        }}
      >
        <FiShield size={24} />
      </div>
      <div className="text-center">
        <p
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Acesso negado
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    </div>
  );
}

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
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
        className={`relative w-full ${wide ? "max-w-lg" : "max-w-md"} rounded-[var(--radius-xl)] flex flex-col max-h-[90vh]`}
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
            className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-60"
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

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  title,
  description,
  onConfirm,
  onClose,
  loading,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="p-6 flex flex-col gap-5">
        <div
          className="flex items-start gap-3 p-4 rounded-md"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <FiAlertTriangle
            size={18}
            className="shrink-0 mt-0.5"
            style={{ color: "var(--color-error)" }}
          />
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--color-error)" }}
          >
            {loading ? "Excluindo..." : "Confirmar exclusão"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────

// Field e TextInput removidos — substituídos pelo componente Input reutilizável

// ─── Create user modal ────────────────────────────────────────────────────────

function CreateUserModal({
  onCreated,
  onClose,
}: {
  onCreated: (user: AppUser) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Partial<typeof fields>>({});
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  function set(k: keyof typeof fields, v: string) {
    setFields((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function validate() {
    const e: Partial<typeof fields> = {};
    if (!fields.username.trim()) e.username = "Obrigatório";
    else if (fields.username.includes(" ")) e.username = "Sem espaços";
    if (!fields.email.trim()) e.email = "Obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      e.email = "E-mail inválido";
    if (!fields.password) e.password = "Obrigatório";
    else if (fields.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (fields.confirm !== fields.password) e.confirm = "Senhas não coincidem";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    setLoading(true);
    try {
      const usernameSnap = await getDoc(
        doc(db, "usernames", fields.username.trim()),
      );
      if (usernameSnap.exists()) {
        setErrors({ username: "Usuário já existe" });
        return;
      }

      const secondaryAuth = getSecondaryAuth();
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        fields.email.trim(),
        fields.password,
      );
      await fbSignOut(secondaryAuth);

      const uid = credential.user.uid;
      const username = fields.username.trim();
      const email = fields.email.trim();

      await Promise.all([
        setDoc(doc(db, "users", uid), {
          username,
          email,
          status: "approved",
          isOwner: false,
          createdAt: serverTimestamp(),
        }),
        setDoc(doc(db, "usernames", username), { uid, email }),
      ]);

      const newUser: AppUser = {
        uid,
        username,
        email,
        status: "approved",
        isOwner: false,
        permissions: [],
        createdAt: new Date(),
      };
      onCreated(newUser);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-in-use")
        toastError("Erro", "Este e-mail já está cadastrado.");
      else toastError("Erro ao criar usuário", "Tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Criar usuário" onClose={onClose}>
      <div className="p-6 flex flex-col gap-4">
        <Input
          label="Usuário"
          placeholder="Nome de usuário"
          value={fields.username}
          onChange={(e) => set("username", e.target.value)}
          icon={<FiUser size={16} />}
          error={errors.username}
          autoComplete="off"
        />
        <Input
          label="E-mail"
          type="email"
          placeholder="email@exemplo.com"
          value={fields.email}
          onChange={(e) => set("email", e.target.value)}
          icon={<FiMail size={16} />}
          error={errors.email}
          autoComplete="off"
        />
        <Input
          label="Senha"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={fields.password}
          onChange={(e) => set("password", e.target.value)}
          icon={<FiLock size={16} />}
          error={errors.password}
          autoComplete="new-password"
        />
        <Input
          label="Confirmar senha"
          type="password"
          placeholder="Repita a senha"
          value={fields.confirm}
          onChange={(e) => set("confirm", e.target.value)}
          icon={<FiLock size={16} />}
          error={errors.confirm}
          autoComplete="new-password"
        />
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          O usuário será criado com acesso aprovado e sem perfil de permissões.
        </p>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50 transition-all"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Edit user modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onSaved,
  onClose,
}: {
  user: AppUser;
  onSaved: (
    updated: Partial<AppUser> & { uid: string },
    changes: { field: string; from: string | null; to: string | null }[],
  ) => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  async function handleSave() {
    if (!username.trim()) {
      setUsernameError("Obrigatório");
      return;
    }
    if (username.includes(" ")) {
      setUsernameError("Sem espaços");
      return;
    }
    setLoading(true);
    try {
      const newUsername = username.trim();
      const usernameChanged = newUsername !== user.username;
      const statusChanged = status !== user.status;

      if (usernameChanged) {
        const snap = await getDoc(doc(db, "usernames", newUsername));
        if (snap.exists()) {
          setUsernameError("Usuário já existe");
          return;
        }
      }

      await updateDoc(doc(db, "users", user.uid), {
        username: newUsername,
        status,
      });

      if (usernameChanged) {
        const batch = writeBatch(db);
        batch.delete(doc(db, "usernames", user.username));
        batch.set(doc(db, "usernames", newUsername), {
          uid: user.uid,
          email: user.email,
        });
        await batch.commit();
      }

      // Compute the actual changes for the log
      const changes: {
        field: string;
        from: string | null;
        to: string | null;
      }[] = [];
      if (usernameChanged)
        changes.push({
          field: "Usuário",
          from: user.username,
          to: newUsername,
        });
      if (statusChanged)
        changes.push({
          field: "Status",
          from: STATUS_LABEL[user.status],
          to: STATUS_LABEL[status],
        });

      onSaved({ uid: user.uid, username: newUsername, status }, changes);
    } catch (err) {
      toastError("Erro ao editar", "Tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const statusOptions: UserStatus[] = ["approved", "pending", "rejected"];

  return (
    <Modal title={`Editar @${user.username}`} onClose={onClose}>
      <div className="p-6 flex flex-col gap-4">
        <Input
          label="Usuário"
          placeholder="Nome de usuário"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setUsernameError(""); }}
          icon={<FiUser size={16} />}
          error={usernameError}
          autoComplete="off"
        />

        <div className="flex flex-col gap-1">
          <Input
            label="E-mail"
            value={user.email}
            disabled
            icon={<FiMail size={16} />}
            className="opacity-50 cursor-not-allowed"
          />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            E-mail não pode ser alterado.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Status
          </label>
          <div className="flex gap-2">
            {statusOptions.map((s) => {
              const sc = STATUS_COLOR[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="flex-1 h-9 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
                  style={{
                    backgroundColor:
                      status === s ? sc.bg : "var(--color-bg-elevated)",
                    border: `1px solid ${status === s ? sc.color : "var(--color-border)"}`,
                    color:
                      status === s ? sc.color : "var(--color-text-secondary)",
                  }}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-[var(--radius-md)] text-sm cursor-pointer"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
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
    await onAssign(user.uid, profiles.find((p) => p.id === selected) ?? null);
    setLoading(false);
    onClose();
  }

  return (
    <Modal title={`Perfil de @${user.username}`} onClose={onClose}>
      <div className="p-6 flex flex-col gap-3">
        <p
          className="text-sm mb-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Selecione o perfil de permissões para este usuário.
        </p>
        {[null, ...profiles].map((p) => {
          const isNull = p === null;
          const isSelected = isNull ? selected === null : selected === p.id;
          return (
            <button
              key={isNull ? "none" : p!.id}
              onClick={() => setSelected(isNull ? null : p!.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] text-left cursor-pointer transition-all"
              style={{
                border: `1px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"}`,
                backgroundColor: isSelected
                  ? "var(--color-primary-light)"
                  : "var(--color-bg-elevated)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isNull
                    ? "var(--color-bg-base)"
                    : "rgba(0,136,194,0.2)",
                  color: isNull
                    ? "var(--color-text-muted)"
                    : "var(--color-primary)",
                }}
              >
                {isNull ? <FiUser size={14} /> : <FiShield size={14} />}
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {isNull ? "Sem perfil" : p!.name}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {isNull
                    ? "Acesso apenas a pedidos"
                    : `${p!.permissions.length} permissão${p!.permissions.length !== 1 ? "ões" : ""}`}
                </p>
              </div>
            </button>
          );
        })}
        <button
          onClick={handleSave}
          disabled={loading}
          className="mt-2 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Profile modal ────────────────────────────────────────────────────────────

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
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggle(p: Permission) {
    setPerms((prev) => {
      const n = new Set(prev);
      if (n.has(p)) {
        n.delete(p);
        // Deselecting the view perm removes all perms in that section
        const group = PERMISSION_GROUPS.find((g) => g.viewPerm === p);
        if (group) group.permissions.forEach((gp) => n.delete(gp));
      } else {
        n.add(p);
        // Selecting a non-view perm auto-enables the section's view perm
        const group = PERMISSION_GROUPS.find((g) => g.permissions.includes(p) && g.viewPerm !== p);
        if (group) n.add(group.viewPerm);
      }
      return n;
    });
  }

  function toggleSection(group: PermissionGroup) {
    setPerms((prev) => {
      const n = new Set(prev);
      const allIn = group.permissions.every((p) => n.has(p));
      if (allIn) {
        group.permissions.forEach((p) => n.delete(p));
      } else {
        group.permissions.forEach((p) => n.add(p));
      }
      return n;
    });
  }

  function toggleAll() {
    setPerms((prev) => {
      const allSelected = ALL_PERMISSIONS.every((p) => prev.has(p));
      return allSelected ? new Set<Permission>() : new Set<Permission>(ALL_PERMISSIONS);
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
    <Modal
      title={existing ? "Editar perfil" : "Novo perfil"}
      onClose={onClose}
      wide
    >
      <div className="p-6 flex flex-col gap-5">
        <Input
          label="Nome do perfil"
          placeholder="Ex: Caixa, Gerente..."
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          error={nameError}
          autoFocus
        />
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Permissões
            </p>
            <button
              onClick={toggleAll}
              className="text-xs px-2.5 py-1 rounded cursor-pointer transition-all"
              style={{
                backgroundColor: ALL_PERMISSIONS.every((p) => perms.has(p)) ? "var(--color-primary-light)" : "var(--color-bg-elevated)",
                border: `1px solid ${ALL_PERMISSIONS.every((p) => perms.has(p)) ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
                color: ALL_PERMISSIONS.every((p) => perms.has(p)) ? "var(--color-primary)" : "var(--color-text-secondary)",
              }}
            >
              {ALL_PERMISSIONS.every((p) => perms.has(p)) ? "Desmarcar tudo" : "Selecionar tudo"}
            </button>
          </div>
          {PERMISSION_GROUPS.map((group) => {
            const sectionEnabled = perms.has(group.viewPerm);
            const allInSection = group.permissions.every((p) => perms.has(p));
            return (
              <div key={group.label}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    {group.label}
                  </p>
                  <button
                    onClick={() => toggleSection(group)}
                    className="text-xs px-2 py-0.5 rounded cursor-pointer transition-all"
                    style={{
                      backgroundColor: allInSection ? "var(--color-primary-light)" : "var(--color-bg-elevated)",
                      border: `1px solid ${allInSection ? "rgba(0,136,194,0.3)" : "var(--color-border)"}`,
                      color: allInSection ? "var(--color-primary)" : "var(--color-text-muted)",
                    }}
                  >
                    {allInSection ? "Desmarcar seção" : "Selecionar seção"}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {group.permissions.map((perm) => {
                    const meta = PERMISSION_META[perm];
                    const checked = perms.has(perm);
                    const isViewPerm = perm === group.viewPerm;
                    const isDisabled = !isViewPerm && !sectionEnabled;
                    return (
                      <button
                        key={perm}
                        onClick={() => !isDisabled && toggle(perm)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all"
                        style={{
                          backgroundColor: checked ? "var(--color-primary-light)" : "var(--color-bg-elevated)",
                          border: `1px solid ${checked ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
                          cursor: isDisabled ? "not-allowed" : "pointer",
                          opacity: isDisabled ? 0.45 : 1,
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: checked ? "var(--color-primary)" : "transparent",
                            border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border)"}`,
                          }}
                        >
                          {checked && <FiCheck size={10} color="white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap" style={{ color: "var(--color-text-primary)" }}>
                            {meta.label}
                            {isViewPerm && (
                              <span className="text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                                (requerido para a seção)
                              </span>
                            )}
                            {perm === "manage_profiles" && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{
                                  backgroundColor: "rgba(245,158,11,0.15)",
                                  color: "var(--color-warning)",
                                  border: "1px solid rgba(245,158,11,0.35)",
                                }}
                              >
                                <FiAlertTriangle size={9} />
                                Acesso crítico
                              </span>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {meta.description}
                          </p>
                          {perm === "manage_profiles" && (
                            <p
                              className="text-xs mt-1 flex items-start gap-1"
                              style={{ color: "var(--color-warning)" }}
                            >
                              <FiAlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
                              Quem tem essa permissão pode criar perfis com qualquer acesso e atribuí-los a outros usuários.
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
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
  canApprove,
  canManage,
  canDelete,
  onApprove,
  onReject,
  onAssign,
  onEdit,
  onDelete,
}: {
  user: AppUser;
  canApprove: boolean;
  canManage: boolean;
  canDelete: boolean;
  onApprove: (uid: string) => void;
  onReject: (uid: string) => void;
  onAssign: (user: AppUser) => void;
  onEdit: (user: AppUser) => void;
  onDelete: (user: AppUser) => void;
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
          <Avatar
            name={user.username}
            size={9}
            avatarStyle={user.avatarStyle}
            avatarSeed={user.avatarSeed}
          />
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              @{user.username}
            </p>
            {!user.isOwner && (
              <p
                className="text-xs truncate"
                style={{ color: "var(--color-primary)", opacity: 0.85 }}
              >
                <FiShield size={10} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                {user.profileName ?? "Sem perfil"}
              </p>
            )}
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
        <div className="flex items-center gap-1.5">
          {user.status === "pending" && canApprove && !user.isOwner && (
            <>
              <button
                onClick={() => onApprove(user.uid)}
                title="Aprovar"
                className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
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
                className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
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
          {(canManage || canDelete) && !user.isOwner && (
            <>
              {canManage && user.status === "approved" && (
                <button
                  onClick={() => onAssign(user)}
                  title="Perfil"
                  className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <FiShield size={13} />
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => onEdit(user)}
                  title="Editar"
                  className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <FiEdit2 size={13} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(user)}
                  title="Excluir"
                  className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.08)",
                    color: "var(--color-error)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(239,68,68,0.2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(239,68,68,0.08)")
                  }
                >
                  <FiTrash2 size={13} />
                </button>
              )}
            </>
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
            className="w-8 h-8 rounded flex items-center justify-center cursor-pointer"
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
            className="w-8 h-8 rounded flex items-center justify-center cursor-pointer"
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
            className="w-8 h-8 rounded flex items-center justify-center cursor-pointer"
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
          className="px-4 pb-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="pt-3 flex flex-wrap gap-1.5">
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

  const canAccessPage = can(appUser, "view_users");
  const canApproveUsers = can(appUser, "approve_users");
  const canManageUsers = can(appUser, "edit_users");
  const canDeleteUsers = can(appUser, "delete_users");
  const canManageProfiles = can(appUser, "manage_profiles");
  const canCreateUser = can(appUser, "create_user");

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const [assignTarget, setAssignTarget] = useState<AppUser | null>(null);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [profileModal, setProfileModal] = useState<{
    open: boolean;
    editing?: PermissionProfile;
  }>({ open: false });

  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "unknown", username: "unknown" };

  useEffect(() => {
    getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")))
      .then((snap) =>
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
              permissions: [],
              avatarStyle: data.avatarStyle,
              avatarSeed: data.avatarSeed,
              createdAt: data.createdAt?.toDate() ?? new Date(),
            };
          }),
        ),
      )
      .catch(() => error("Erro ao carregar usuários", "Tente recarregar."))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    getDocs(
      query(collection(db, "permissionProfiles"), orderBy("createdAt", "asc")),
    )
      .then((snap) =>
        setProfiles(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name,
            permissions: d.data().permissions ?? [],
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          })),
        ),
      )
      .catch(() => error("Erro ao carregar perfis", "Tente recarregar."))
      .finally(() => setLoadingProfiles(false));
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function handleApprove(uid: string) {
    const user = users.find((u) => u.uid === uid);
    try {
      await updateDoc(doc(db, "users", uid), { status: "approved" });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: "approved" } : u)),
      );
      success("Usuário aprovado", `@${user?.username} agora tem acesso.`);
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
        description: `Rejeitou @${user?.username}`,
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
    const prevProfile = user?.profileName ?? null;
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
        profile ? `"${profile.name}" atribuído.` : "Perfil removido.",
      );
      log({
        action: "assign_profile",
        category: "users",
        description: profile
          ? `Atribuiu "${profile.name}" a @${user?.username}`
          : `Removeu perfil de @${user?.username}`,
        performedBy: actor,
        target: { type: "user", id: uid, name: user?.username ?? uid },
        changes: [
          { field: "perfil", from: prevProfile, to: profile?.name ?? null },
        ],
      });
    } catch {
      error("Erro ao atribuir perfil", "Tente novamente.");
    }
  }

  async function handleEditSaved(
    updated: Partial<AppUser> & { uid: string },
    changes: { field: string; from: string | null; to: string | null }[],
  ) {
    setUsers((prev) =>
      prev.map((u) => (u.uid === updated.uid ? { ...u, ...updated } : u)),
    );
    success("Usuário atualizado", `@${updated.username} foi salvo.`);
    log({
      action: "update_user",
      category: "users",
      description: `Editou o usuário @${updated.username}`,
      performedBy: actor,
      target: {
        type: "user",
        id: updated.uid,
        name: updated.username ?? updated.uid,
      },
      changes,
    });
    setEditTarget(null);
  }

  async function handleDelete(user: AppUser) {
    setDeleteLoading(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", user.uid));
      batch.delete(doc(db, "usernames", user.username));
      await batch.commit();
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      success("Usuário removido", `@${user.username} foi excluído.`);
      log({
        action: "delete_user",
        category: "users",
        description: `Excluiu o usuário @${user.username}`,
        performedBy: actor,
        target: { type: "user", id: user.uid, name: user.username },
      });
      setDeleteTarget(null);
    } catch {
      error("Erro ao excluir", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
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
        success("Perfil atualizado", `"${name}" foi salvo.`);

        // Registra mudanças detalhadas: nome + cada permissão adicionada/removida
        const changes: {
          field: string;
          from: string | null;
          to: string | null;
        }[] = [];
        if (name !== editing.name)
          changes.push({ field: "Nome", from: editing.name, to: name });
        const added = permissions.filter(
          (p) => !editing.permissions.includes(p),
        );
        const removed = editing.permissions.filter(
          (p) => !permissions.includes(p),
        );
        added.forEach((p) =>
          changes.push({
            field: "Adicionada",
            from: null,
            to: PERMISSION_META[p].label,
          }),
        );
        removed.forEach((p) =>
          changes.push({
            field: "Removida",
            from: PERMISSION_META[p].label,
            to: null,
          }),
        );

        log({
          action: "update_profile",
          category: "profiles",
          description: `Atualizou o perfil "${name}"`,
          performedBy: actor,
          target: { type: "profile", id: editing.id, name },
          changes,
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
        success("Perfil criado", `"${name}" disponível para atribuição.`);
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  const filtered = users.filter((u) => {
    const matchFilter = filter === "all" || u.status === filter;
    const matchSearch =
      !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pending = users.filter((u) => u.status === "pending").length;
  const approved = users.filter((u) => u.status === "approved").length;

  const filterOptions: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "rejected", label: "Rejeitados" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      <div className="flex items-start justify-between gap-4">
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
            Gerencie usuários e perfis de permissão.
          </p>
        </div>
        {canCreateUser && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0"
            style={{ backgroundColor: "var(--color-primary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--color-primary-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-primary)")
            }
          >
            <FiPlus size={15} /> Criar usuário
          </button>
        )}
      </div>

      {!canAccessPage ? (
        <AccessDenied />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Total",
                value: users.length,
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
                badge: pending > 0 ? pending : 0,
              },
              ...(canManageProfiles
                ? [
                    {
                      key: "profiles" as Tab,
                      label: "Perfis de Permissão",
                      icon: <FiShield size={14} />,
                      badge: 0,
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
                {t.badge > 0 && (
                  <span
                    className="w-4 h-4 rounded-full text-xs flex items-center justify-center"
                    style={{
                      backgroundColor: "var(--color-warning)",
                      color: "white",
                    }}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Users tab ── */}
          {tab === "users" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {filterOptions.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap cursor-pointer flex-shrink-0 flex items-center gap-1.5"
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
                    placeholder="Buscar..."
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
                      (e.currentTarget.style.borderColor =
                        "var(--color-border)")
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
                <div className="flex flex-col items-center py-16 gap-2">
                  <FiUsers
                    size={32}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Nenhum usuário encontrado
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    {filtered.map((user) => (
                      <UserCard
                        key={user.uid}
                        user={user}
                        canApprove={canApproveUsers}
                        canManage={canManageUsers}
                        canDelete={canDeleteUsers}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onAssign={setAssignTarget}
                        onEdit={setEditTarget}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>

                  {/* Desktop */}
                  <div
                    className="hidden sm:block rounded-[var(--radius-lg)] overflow-hidden overflow-x-auto"
                    style={{ border: "1px solid var(--color-border)" }}
                  >
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr
                          style={{
                            borderBottom: "1px solid var(--color-border)",
                            backgroundColor: "var(--color-bg-elevated)",
                          }}
                        >
                          {[
                            "Usuário",
                            "E-mail",
                            "Perfil",
                            "Status",
                            "Ações",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              {h}
                            </th>
                          ))}
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
                                <Avatar
                                  name={user.username}
                                  avatarStyle={user.avatarStyle}
                                  avatarSeed={user.avatarSeed}
                                />
                                <div>
                                  <p
                                    className="text-sm font-medium"
                                    style={{
                                      color: "var(--color-text-primary)",
                                    }}
                                  >
                                    {user.username}
                                  </p>
                                  {user.isOwner ? (
                                    <span
                                      className="text-xs"
                                      style={{ color: "var(--color-primary)" }}
                                    >
                                      Owner
                                    </span>
                                  ) : (
                                    <span
                                      className="text-xs flex items-center gap-1"
                                      style={{ color: "var(--color-text-muted)" }}
                                    >
                                      <FiShield size={10} />
                                      {user.profileName ?? "Sem perfil"}
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
                              <div className="flex items-center gap-1.5">
                                {user.status === "pending" &&
                                  canApproveUsers &&
                                  !user.isOwner && (
                                    <>
                                      <button
                                        onClick={() => handleApprove(user.uid)}
                                        title="Aprovar"
                                        className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                          backgroundColor:
                                            "rgba(34,197,94,0.12)",
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
                                        className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                          backgroundColor:
                                            "rgba(239,68,68,0.12)",
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
                                {(canManageUsers || canDeleteUsers) && !user.isOwner && (
                                  <>
                                    {canManageUsers && user.status === "approved" && (
                                      <button
                                        onClick={() => setAssignTarget(user)}
                                        title="Atribuir perfil"
                                        className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                          backgroundColor:
                                            "var(--color-bg-elevated)",
                                          color: "var(--color-text-secondary)",
                                          border:
                                            "1px solid var(--color-border)",
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
                                        <FiShield size={13} />
                                      </button>
                                    )}
                                    {canManageUsers && (
                                      <button
                                        onClick={() => setEditTarget(user)}
                                        title="Editar"
                                        className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                          backgroundColor:
                                            "var(--color-bg-elevated)",
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
                                        <FiEdit2 size={13} />
                                      </button>
                                    )}
                                    {canDeleteUsers && (
                                      <button
                                        onClick={() => setDeleteTarget(user)}
                                        title="Excluir"
                                        className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                          backgroundColor: "rgba(239,68,68,0.08)",
                                          color: "var(--color-error)",
                                        }}
                                        onMouseEnter={(e) =>
                                          (e.currentTarget.style.backgroundColor =
                                            "rgba(239,68,68,0.2)")
                                        }
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.backgroundColor =
                                            "rgba(239,68,68,0.08)")
                                        }
                                      >
                                        <FiTrash2 size={13} />
                                      </button>
                                    )}
                                  </>
                                )}
                                {!canApproveUsers &&
                                  !canManageUsers &&
                                  !canDeleteUsers &&
                                  user.status !== "pending" && (
                                    <span
                                      className="text-xs"
                                      style={{
                                        color: "var(--color-text-muted)",
                                      }}
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

          {/* ── Profiles tab ── */}
          {tab === "profiles" && canManageProfiles && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {profiles.length} perfil{profiles.length !== 1 ? "is" : ""}
                </p>
                <button
                  onClick={() => setProfileModal({ open: true })}
                  className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-primary-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-primary)")
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
                <div className="flex flex-col items-center py-16 gap-3">
                  <FiShield
                    size={32}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Nenhum perfil criado
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {profiles.map((p) => (
                    <ProfileCard
                      key={p.id}
                      profile={p}
                      onEdit={(p) =>
                        setProfileModal({ open: true, editing: p })
                      }
                      onDelete={handleDeleteProfile}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onCreated={(user) => {
            setUsers((prev) => [user, ...prev]);
            success(
              "Usuário criado",
              `@${user.username} foi criado com acesso aprovado.`,
            );
            log({
              action: "create_user",
              category: "users",
              description: `Criou o usuário @${user.username}`,
              performedBy: actor,
              target: { type: "user", id: user.uid, name: user.username },
            });
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {assignTarget && (
        <AssignProfileModal
          user={assignTarget}
          profiles={profiles}
          onAssign={handleAssignProfile}
          onClose={() => setAssignTarget(null)}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onSaved={handleEditSaved}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Excluir usuário"
          description={`Tem certeza que deseja excluir @${deleteTarget.username}? Esta ação removerá o usuário do sistema. A conta de autenticação deve ser removida manualmente no Firebase Console.`}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
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
