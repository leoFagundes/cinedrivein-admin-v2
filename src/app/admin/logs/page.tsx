"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
  Timestamp,
} from "firebase/firestore";
import {
  FiActivity,
  FiUsers,
  FiShield,
  FiShoppingBag,
  FiBox,
  FiGlobe,
  FiLogIn,
  FiSearch,
  FiRefreshCw,
  FiTrash2,
  FiAlertTriangle,
  FiCalendar,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/access";
import { Log, LogCategory } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (diff < 60000) return "agora mesmo";
  if (min < 60) return `há ${min} minuto${min !== 1 ? "s" : ""}`;
  if (hr < 24) return `há ${hr} hora${hr !== 1 ? "s" : ""}`;
  if (day < 7) return `há ${day} dia${day !== 1 ? "s" : ""}`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CATEGORY_META: Record<
  LogCategory,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  users: {
    label: "Usuários",
    icon: <FiUsers size={14} />,
    color: "var(--color-primary)",
    bg: "rgba(0,136,194,0.12)",
  },
  profiles: {
    label: "Perfis",
    icon: <FiShield size={14} />,
    color: "#a855f7",
    bg: "rgba(168,85,247,0.12)",
  },
  auth: {
    label: "Acesso",
    icon: <FiLogIn size={14} />,
    color: "var(--color-text-muted)",
    bg: "var(--color-bg-elevated)",
  },
  orders: {
    label: "Pedidos",
    icon: <FiShoppingBag size={14} />,
    color: "var(--color-warning)",
    bg: "rgba(245,158,11,0.12)",
  },
  stock: {
    label: "Estoque",
    icon: <FiBox size={14} />,
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.12)",
  },
  site: {
    label: "Site",
    icon: <FiGlobe size={14} />,
    color: "var(--color-success)",
    bg: "rgba(34,197,94,0.12)",
  },
};

// ─── Access denied ────────────────────────────────────────────────────────────

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
          Você precisa da permissão {'"'}Ver logs{'"'} para acessar esta página.
        </p>
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />
      <div
        className="relative w-full max-w-sm rounded-[var(--radius-xl)] flex flex-col"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
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
            className="p-1 rounded cursor-pointer hover:opacity-60"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div
            className="flex items-start gap-3 p-4 rounded-[var(--radius-md)]"
            style={{
              backgroundColor: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <FiAlertTriangle
              size={18}
              className="flex-shrink-0 mt-0.5"
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
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: "var(--color-error)" }}
            >
              {loading ? "Aguarde..." : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FiX({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function ChangeTag({ from, to }: { from: string | null; to: string | null }) {
  if (from === null) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium max-w-full"
        style={{
          backgroundColor: "rgba(34,197,94,0.12)",
          color: "var(--color-success)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        + {to}
      </span>
    );
  }
  if (to === null) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium max-w-full"
        style={{
          backgroundColor: "rgba(239,68,68,0.10)",
          color: "var(--color-error)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        − {from}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs max-w-full flex-wrap"
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
      }}
    >
      <span
        className="truncate"
        style={{
          color: "var(--color-error)",
          textDecoration: "line-through",
          maxWidth: "8rem",
        }}
      >
        {from}
      </span>
      <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>→</span>
      <span
        className="truncate"
        style={{ color: "var(--color-success)", maxWidth: "8rem" }}
      >
        {to}
      </span>
    </span>
  );
}

function LogRow({
  log,
  isOwner,
  onDelete,
}: {
  log: Log;
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const cat = CATEGORY_META[log.category];
  const hasChanges = log.changes && log.changes.length > 0;

  return (
    <div
      className="px-4 py-3.5 group transition-colors"
      style={{ borderBottom: "1px solid var(--color-border)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: cat.bg, color: cat.color }}
        >
          {cat.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Description + time */}
          <div className="flex items-start justify-between gap-3">
            <p
              className="text-sm font-medium leading-snug"
              style={{ color: "var(--color-text-primary)" }}
            >
              {log.description}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-xs hidden sm:block"
                style={{ color: "var(--color-text-muted)" }}
                title={log.createdAt.toLocaleString("pt-BR")}
              >
                {timeAgo(log.createdAt)}
              </span>
              {isOwner && (
                <button
                  onClick={() => onDelete(log.id)}
                  title="Excluir log"
                  className="w-7 h-7 rounded flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "rgba(239,68,68,0.1)";
                    e.currentTarget.style.color = "var(--color-error)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--color-text-muted)";
                  }}
                >
                  <FiTrash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: cat.bg, color: cat.color }}
            >
              {cat.label}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              por{" "}
              <span
                className="font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                @{log.performedBy.username}
              </span>
            </span>
            <span
              className="text-xs sm:hidden"
              style={{ color: "var(--color-text-muted)" }}
            >
              · {timeAgo(log.createdAt)}
            </span>
          </div>

          {/* Changes */}
          {hasChanges && (
            <div
              className="mt-2.5 flex flex-col gap-1.5 pl-1"
              style={{ borderLeft: "2px solid var(--color-border)" }}
            >
              {log.changes!.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start flex-wrap gap-x-2 gap-y-1 pl-2 min-w-0"
                >
                  <span
                    className="text-xs flex-shrink-0"
                    style={{
                      color: "var(--color-text-muted)",
                      minWidth: "4.5rem",
                    }}
                  >
                    {c.field}
                  </span>
                  <div className="flex-1 min-w-0">
                    <ChangeTag from={c.from} to={c.to} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// ─── Main page ────────────────────────────────────────────────────────────────

type CategoryFilter = "all" | LogCategory;

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "users", label: "Usuários" },
  { key: "profiles", label: "Perfis" },
  { key: "orders", label: "Pedidos" },
  { key: "stock", label: "Estoque" },
  { key: "site", label: "Site" },
  { key: "auth", label: "Acesso" },
];

export default function LogsPage() {
  const { appUser } = useAuth();
  const { success, error } = useToast();
  const isOwner = appUser?.isOwner ?? false;
  const canView = can(appUser, "view_logs");

  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deleteOldConfirm, setDeleteOldConfirm] = useState(false);
  const [deleteOldLoading, setDeleteOldLoading] = useState(false);

  function parseLog(d: QueryDocumentSnapshot<DocumentData>): Log {
    const data = d.data();
    return {
      id: d.id,
      action: data.action,
      category: data.category,
      description: data.description,
      performedBy: data.performedBy,
      target: data.target,
      changes: data.changes,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  }

  function buildDateConstraints(): QueryConstraint[] {
    const c: QueryConstraint[] = [];
    if (fromDate) c.push(where("createdAt", ">=", Timestamp.fromDate(startOfDay(fromDate))));
    if (toDate) c.push(where("createdAt", "<=", Timestamp.fromDate(endOfDay(toDate))));
    return c;
  }

  async function fetchLogs() {
    setLoading(true);
    setLogs([]);
    setLastDoc(null);
    try {
      const snap = await getDocs(
        query(collection(db, "logs"), ...buildDateConstraints(), orderBy("createdAt", "desc"), limit(PAGE_SIZE)),
      );
      setLogs(snap.docs.map(parseLog));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
      error("Erro ao carregar logs", "Tente recarregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLogs([]);
      setLastDoc(null);
      try {
        const c: QueryConstraint[] = [];
        if (fromDate) c.push(where("createdAt", ">=", Timestamp.fromDate(startOfDay(fromDate))));
        if (toDate) c.push(where("createdAt", "<=", Timestamp.fromDate(endOfDay(toDate))));
        const snap = await getDocs(
          query(collection(db, "logs"), ...c, orderBy("createdAt", "desc"), limit(PAGE_SIZE)),
        );
        setLogs(snap.docs.map(parseLog));
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fromDate, toDate]);

  async function loadMore() {
    if (!lastDoc) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(collection(db, "logs"), ...buildDateConstraints(), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE)),
      );
      setLogs((prev) => [...prev, ...snap.docs.map(parseLog)]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDeleteLog(id: string) {
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "logs", id));
      setLogs((prev) => prev.filter((l) => l.id !== id));
      success("Log removido", "O registro foi excluído.");
      setDeleteTarget(null);
    } catch {
      error("Erro ao excluir", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleClearAll() {
    setClearLoading(true);
    try {
      // Delete in batches of 500 (Firestore limit)
      const snap = await getDocs(query(collection(db, "logs"), limit(500)));
      if (snap.empty) {
        setClearConfirm(false);
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      setLogs([]);
      setHasMore(false);
      success("Logs limpos", "Todos os registros foram excluídos.");
      setClearConfirm(false);
    } catch {
      error("Erro ao limpar logs", "Tente novamente.");
    } finally {
      setClearLoading(false);
    }
  }

  async function handleDeleteOldLogs() {
    setDeleteOldLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      let total = 0;
      let keepGoing = true;
      while (keepGoing) {
        const snap = await getDocs(
          query(
            collection(db, "logs"),
            where("createdAt", "<", Timestamp.fromDate(cutoff)),
            limit(500),
          ),
        );
        if (snap.empty) { keepGoing = false; break; }
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        total += snap.docs.length;
        if (snap.docs.length < 500) keepGoing = false;
      }
      success(
        "Logs antigos excluídos",
        `${total} log${total !== 1 ? "s" : ""} com mais de 30 dias foram excluídos.`,
      );
      setDeleteOldConfirm(false);
      fetchLogs();
    } catch {
      error("Erro", "Não foi possível excluir os logs antigos.");
    } finally {
      setDeleteOldLoading(false);
    }
  }

  const filtered = logs.filter((l) => {
    const matchCat = categoryFilter === "all" || l.category === categoryFilter;
    const matchSearch =
      !search ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.performedBy.username.toLowerCase().includes(search.toLowerCase()) ||
      (l.target?.name ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Logs do Sistema
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Histórico completo de ações realizadas.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <>
              <button
                onClick={() => setDeleteOldConfirm(true)}
                className="flex items-center gap-2 h-9 px-3 rounded-md text-sm cursor-pointer transition-all"
                style={{
                  backgroundColor: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  color: "var(--color-warning)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.15)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.08)")
                }
              >
                <FiTrash2 size={14} />
                <span className="hidden sm:inline">Limpar &gt;30 dias</span>
              </button>
              {logs.length > 0 && (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="flex items-center gap-2 h-9 px-3 rounded-md text-sm cursor-pointer transition-all"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "var(--color-error)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.15)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")
                  }
                >
                  <FiTrash2 size={14} />
                  <span className="hidden sm:inline">Limpar tudo</span>
                </button>
              )}
            </>
          )}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all disabled:opacity-50"
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
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {!canView ? (
        <AccessDenied />
      ) : (
        <>
          {/* Filters + Search */}
          <div className="flex flex-col gap-3">
            {/* Date range */}
            <div className="flex flex-wrap items-center gap-2">
              <FiCalendar size={14} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-[var(--radius-md)] outline-none cursor-pointer"
                style={{
                  backgroundColor: fromDate ? "var(--color-primary-light)" : "var(--color-bg-elevated)",
                  border: `1px solid ${fromDate ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
                  color: fromDate ? "var(--color-primary)" : "var(--color-text-secondary)",
                }}
              />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>até</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-[var(--radius-md)] outline-none cursor-pointer"
                style={{
                  backgroundColor: toDate ? "var(--color-primary-light)" : "var(--color-bg-elevated)",
                  border: `1px solid ${toDate ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
                  color: toDate ? "var(--color-primary)" : "var(--color-text-secondary)",
                }}
              />
              {(fromDate || toDate) && (
                <button
                  onClick={() => { setFromDate(""); setToDate(""); }}
                  className="flex items-center gap-1 text-xs cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <FiX size={12} />
                  Limpar datas
                </button>
              )}
              {(fromDate || toDate) && (
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setCategoryFilter(f.key)}
                  className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap cursor-pointer flex-shrink-0 transition-all"
                  style={{
                    backgroundColor:
                      categoryFilter === f.key
                        ? "var(--color-primary)"
                        : "var(--color-bg-elevated)",
                    color:
                      categoryFilter === f.key
                        ? "white"
                        : "var(--color-text-secondary)",
                    border: `1px solid ${categoryFilter === f.key ? "var(--color-primary)" : "var(--color-border)"}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative flex-shrink-0">
              <FiSearch
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                type="text"
                placeholder="Buscar nos logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 pr-4 text-sm rounded-[var(--radius-md)] outline-none w-full sm:w-64"
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
          </div>

          {/* List */}
          <div
            className="rounded-[var(--radius-lg)] overflow-hidden overflow-x-auto"
            style={{
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-surface)",
            }}
          >
            {loading ? (
              <div className="flex justify-center items-center py-20">
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
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <FiActivity
                  size={32}
                  style={{ color: "var(--color-text-muted)" }}
                />
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {search || categoryFilter !== "all"
                    ? "Nenhum log encontrado."
                    : "Nenhum log registrado ainda."}
                </p>
              </div>
            ) : (
              <>
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg-elevated)",
                  }}
                >
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
                    {(search || categoryFilter !== "all") && " (filtrados)"}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Mais recentes primeiro
                  </span>
                </div>

                {filtered.map((l) => (
                  <LogRow
                    key={l.id}
                    log={l}
                    isOwner={isOwner}
                    onDelete={(id) => setDeleteTarget(id)}
                  />
                ))}

                {hasMore && !search && categoryFilter === "all" && (
                  <div
                    className="flex justify-center px-4 py-4"
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 h-9 px-5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer disabled:opacity-50 transition-all"
                      style={{
                        backgroundColor: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-secondary)",
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
                      {loadingMore && (
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-20"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      )}
                      {loadingMore ? "Carregando..." : "Carregar mais"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {deleteTarget && (
        <ConfirmModal
          title="Excluir log"
          description="Tem certeza que deseja excluir este registro de log? Esta ação não pode ser desfeita."
          onConfirm={() => handleDeleteLog(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
      {clearConfirm && (
        <ConfirmModal
          title="Limpar todos os logs"
          description="Tem certeza que deseja excluir TODOS os logs do sistema? Esta ação é irreversível e removerá todo o histórico de ações."
          onConfirm={handleClearAll}
          onClose={() => setClearConfirm(false)}
          loading={clearLoading}
        />
      )}
      {deleteOldConfirm && (
        <ConfirmModal
          title="Excluir logs com mais de 30 dias"
          description="Isso vai excluir permanentemente todos os logs gerados há mais de 30 dias. Esta ação não pode ser desfeita."
          onConfirm={handleDeleteOldLogs}
          onClose={() => setDeleteOldConfirm(false)}
          loading={deleteOldLoading}
        />
      )}
    </div>
  );
}
