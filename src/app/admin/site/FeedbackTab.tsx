"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import {
  FiStar,
  FiTrash2,
  FiUser,
  FiMessageSquare,
  FiAlertTriangle,
  FiX,
  FiRefreshCw,
  FiCheckCircle,
  FiCheck,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { log } from "@/lib/logger";
import { Feedback } from "@/types";

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

function parseFeedback(d: QueryDocumentSnapshot<DocumentData>): Feedback {
  const data = d.data();
  return {
    id: d.id,
    name: data.name,
    rating: data.rating ?? 0,
    message: data.message ?? "",
    favorite: data.favorite ?? false,
    seen: data.seen ?? false,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

function sortFeedbacks(list: Feedback[]): Feedback[] {
  return [...list].sort((a, b) => {
    const fa = a.favorite ? 1 : 0;
    const fb = b.favorite ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
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
          className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4"
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
        <div className="p-4 sm:p-6 flex flex-col gap-5">
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
              {loading ? "Aguarde..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <FiStar
          key={star}
          size={14}
          fill={star <= rating ? "#f59e0b" : "none"}
          style={{ color: star <= rating ? "#f59e0b" : "var(--color-text-muted)" }}
        />
      ))}
    </div>
  );
}

// ─── Feedback card ────────────────────────────────────────────────────────────

function FeedbackCard({
  feedback,
  canManage,
  onToggleFavorite,
  onDelete,
  onMarkAsSeen,
}: {
  feedback: Feedback;
  canManage: boolean;
  onToggleFavorite: (feedback: Feedback) => void;
  onDelete: (feedback: Feedback) => void;
  onMarkAsSeen: (feedback: Feedback) => void;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 p-4 rounded-[var(--radius-lg)]"
      style={{
        backgroundColor: feedback.favorite
          ? "rgba(245,158,11,0.06)"
          : "var(--color-bg-surface)",
        border: `1px solid ${
          !feedback.seen
            ? "var(--color-primary)"
            : feedback.favorite
              ? "rgba(245,158,11,0.3)"
              : "var(--color-border)"
        }`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              color: "var(--color-text-muted)",
            }}
          >
            <FiUser size={14} />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {feedback.name?.trim() || "Anônimo"}
            </p>
            <Stars rating={feedback.rating} />
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onToggleFavorite(feedback)}
              title={feedback.favorite ? "Remover destaque" : "Destacar avaliação"}
              className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: feedback.favorite
                  ? "rgba(245,158,11,0.15)"
                  : "var(--color-bg-elevated)",
                color: feedback.favorite ? "#f59e0b" : "var(--color-text-muted)",
                border: `1px solid ${feedback.favorite ? "rgba(245,158,11,0.35)" : "var(--color-border)"}`,
              }}
            >
              <FiStar size={14} fill={feedback.favorite ? "#f59e0b" : "none"} />
            </button>
            <button
              onClick={() => onDelete(feedback)}
              title="Excluir avaliação"
              className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center cursor-pointer transition-all"
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
        )}
      </div>

      <p
        className="text-sm leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {feedback.message}
      </p>

      <div className="flex items-center justify-between gap-2">
        <p
          className="text-xs"
          style={{ color: "var(--color-text-muted)" }}
          title={feedback.createdAt.toLocaleString("pt-BR")}
        >
          {timeAgo(feedback.createdAt)}
        </p>

        {feedback.seen ? (
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiCheckCircle size={12} />
            Vista
          </span>
        ) : (
          <button
            onClick={() => onMarkAsSeen(feedback)}
            className="flex items-center gap-1 h-7 px-2 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
            style={{
              backgroundColor: "var(--color-primary-light)",
              border: "1px solid var(--color-primary)",
              color: "var(--color-primary)",
            }}
          >
            <FiCheck size={12} />
            Marcar como visto
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function FeedbackTab({
  canManage,
  onUnseenCountChange,
}: {
  canManage: boolean;
  onUnseenCountChange?: (count: number) => void;
}) {
  const { appUser } = useAuth();
  const { success, error } = useToast();
  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "?", username: "?" };
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Feedback | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchFeedbacks() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "feedbacks"), orderBy("createdAt", "desc")),
      );
      setFeedbacks(sortFeedbacks(snap.docs.map(parseFeedback)));
    } catch (err) {
      console.error(err);
      error("Erro ao carregar avaliações", "Tente recarregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onUnseenCountChange?.(feedbacks.filter((f) => !f.seen).length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbacks]);

  async function handleMarkAsSeen(feedback: Feedback) {
    if (feedback.seen) return;
    try {
      await updateDoc(doc(db, "feedbacks", feedback.id), { seen: true });
      setFeedbacks((prev) =>
        sortFeedbacks(
          prev.map((f) => (f.id === feedback.id ? { ...f, seen: true } : f)),
        ),
      );

      const authorName = feedback.name?.trim() || "Anônimo";
      log({
        action: "mark_feedback_seen",
        category: "site",
        description: `Marcou como vista a avaliação de "${authorName}"`,
        performedBy: actor,
        target: { type: "feedback", id: feedback.id, name: authorName },
      });
    } catch (err) {
      console.error(err);
      error("Erro ao atualizar", "Tente novamente.");
    }
  }

  async function handleToggleFavorite(feedback: Feedback) {
    const nextFavorite = !feedback.favorite;
    try {
      await updateDoc(doc(db, "feedbacks", feedback.id), {
        favorite: nextFavorite,
      });
      setFeedbacks((prev) =>
        sortFeedbacks(
          prev.map((f) =>
            f.id === feedback.id ? { ...f, favorite: nextFavorite } : f,
          ),
        ),
      );
      success(
        nextFavorite ? "Avaliação destacada" : "Destaque removido",
        nextFavorite
          ? "A avaliação aparecerá no topo da lista."
          : "A avaliação voltou para a ordem normal.",
      );

      const authorName = feedback.name?.trim() || "Anônimo";
      log({
        action: nextFavorite ? "favorite_feedback" : "unfavorite_feedback",
        category: "site",
        description: nextFavorite
          ? `Destacou a avaliação de "${authorName}"`
          : `Removeu o destaque da avaliação de "${authorName}"`,
        performedBy: actor,
        target: { type: "feedback", id: feedback.id, name: authorName },
      });
    } catch (err) {
      console.error(err);
      error("Erro ao atualizar", "Tente novamente.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "feedbacks", deleteTarget.id));
      setFeedbacks((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      success("Avaliação excluída", "O comentário foi removido.");

      const authorName = deleteTarget.name?.trim() || "Anônimo";
      log({
        action: "delete_feedback",
        category: "site",
        description: `Excluiu a avaliação de "${authorName}"`,
        performedBy: actor,
        target: { type: "feedback", id: deleteTarget.id, name: authorName },
      });

      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      error("Erro ao excluir", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Avaliações dos clientes
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            Comentários enviados pelo site, mais recentes primeiro. Avaliações
            destacadas aparecem no topo.
          </p>
        </div>
        <button
          onClick={fetchFeedbacks}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all disabled:opacity-50 flex-shrink-0"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
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
      ) : feedbacks.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 gap-3 rounded-[var(--radius-lg)]"
          style={{
            border: "1px dashed var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <FiMessageSquare size={28} style={{ opacity: 0.4 }} />
          <p className="text-sm">Nenhuma avaliação recebida ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {feedbacks.map((f) => (
            <FeedbackCard
              key={f.id}
              feedback={f}
              canManage={canManage}
              onToggleFavorite={handleToggleFavorite}
              onDelete={(fb) => setDeleteTarget(fb)}
              onMarkAsSeen={handleMarkAsSeen}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Excluir avaliação"
          description="Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita."
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
