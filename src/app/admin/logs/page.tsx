"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
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
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { Log, LogCategory } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 60000) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  if (hours < 24) return `há ${hours} hora${hours !== 1 ? "s" : ""}`;
  if (days < 7) return `há ${days} dia${days !== 1 ? "s" : ""}`;
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

// ─── Log entry row ────────────────────────────────────────────────────────────

function LogRow({ log }: { log: Log }) {
  const cat = CATEGORY_META[log.category];
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 transition-colors"
      style={{ borderBottom: "1px solid var(--color-border)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      {/* Category icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: cat.bg, color: cat.color }}
      >
        {cat.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
            {log.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          {/* Category badge */}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: cat.bg, color: cat.color }}
          >
            {cat.label}
          </span>

          {/* Actor */}
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

          {/* Timestamp */}
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            · {timeAgo(log.createdAt)}
          </span>
        </div>

        {/* Changes */}
        {log.changes && log.changes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {log.changes.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {c.field}:
                </span>
                {c.from !== null && (
                  <>
                    <span
                      style={{
                        color: "var(--color-error)",
                        textDecoration: "line-through",
                      }}
                    >
                      {c.from}
                    </span>
                    <span>→</span>
                  </>
                )}
                <span style={{ color: "var(--color-success)" }}>
                  {c.to ?? "—"}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Full date on hover */}
      <span
        className="text-xs flex-shrink-0 hidden sm:block"
        style={{ color: "var(--color-text-muted)" }}
        title={log.createdAt.toLocaleString("pt-BR")}
      >
        {log.createdAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
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
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "logs"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      setLogs(snap.docs.map(parseLog));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("[logs] Erro ao carregar:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function loadMore() {
    if (!lastDoc) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "logs"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      setLogs((prev) => [...prev, ...snap.docs.map(parseLog)]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("[logs] Erro ao carregar mais:", err);
    } finally {
      setLoadingMore(false);
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
      {/* Header */}
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
            Histórico completo de ações realizadas no sistema.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all disabled:opacity-50 flex-shrink-0"
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

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0"
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
              (e.currentTarget.style.borderColor = "var(--color-border-focus)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-border)")
            }
          />
        </div>
      </div>

      {/* Log list */}
      <div
        className="rounded-[var(--radius-lg)] overflow-hidden"
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
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {search || categoryFilter !== "all"
                ? "Nenhum log encontrado para essa busca."
                : "Nenhum log registrado ainda."}
            </p>
          </div>
        ) : (
          <>
            {/* List header */}
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
                {filtered.length}{" "}
                {filtered.length !== 1 ? "registros" : "registro"}
                {(search || categoryFilter !== "all") && " (filtrados)"}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Mais recentes primeiro
              </span>
            </div>

            {/* Rows */}
            {filtered.map((l) => (
              <LogRow key={l.id} log={l} />
            ))}

            {/* Load more */}
            {hasMore && !search && categoryFilter === "all" && (
              <div
                className="flex justify-center px-4 py-4"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 h-9 px-5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all disabled:opacity-50"
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
                  {loadingMore ? (
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
                  ) : null}
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
