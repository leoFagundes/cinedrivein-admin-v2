"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
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
  FiCheckCircle,
  FiCheck,
  FiBell,
  FiEyeOff,
  FiCornerUpLeft,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { log } from "@/lib/logger";
import { recordFirestoreRead, recordFirestoreWrite } from "@/lib/firestoreDevTracker";
import { useDevMode } from "@/contexts/DevModeContext";
import { Feedback, FeedbackStatus } from "@/types";

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
    status: (data.status as FeedbackStatus | undefined) ?? "approved",
    reply: data.reply ?? undefined,
    repliedAt: data.repliedAt?.toDate(),
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

function sortFeedbacks(list: Feedback[]): Feedback[] {
  return [...list].sort((a, b) => {
    const pa = (a.status ?? "approved") === "pending" ? 1 : 0;
    const pb = (b.status ?? "approved") === "pending" ? 1 : 0;
    if (pa !== pb) return pb - pa;
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
  onSetStatus,
  onSaveReply,
}: {
  feedback: Feedback;
  canManage: boolean;
  onToggleFavorite: (feedback: Feedback) => void;
  onDelete: (feedback: Feedback) => void;
  onMarkAsSeen: (feedback: Feedback) => void;
  onSetStatus: (feedback: Feedback, status: FeedbackStatus) => void;
  onSaveReply: (feedback: Feedback, reply: string) => Promise<void>;
}) {
  const status = feedback.status ?? "approved";
  const isPending = status === "pending";
  const isHidden = status === "hidden";

  const [editingReply, setEditingReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState(feedback.reply ?? "");
  const [savingReply, setSavingReply] = useState(false);
  // Mantém replyDraft sincronizado com feedback.reply (que pode mudar via
  // onSnapshot em tempo real) sem sobrescrever o que o admin está digitando —
  // ajuste de estado durante o render, não dentro de um efeito.
  const [lastSyncedReply, setLastSyncedReply] = useState(feedback.reply);
  if (!editingReply && feedback.reply !== lastSyncedReply) {
    setLastSyncedReply(feedback.reply);
    setReplyDraft(feedback.reply ?? "");
  }

  async function handleSaveReply() {
    setSavingReply(true);
    await onSaveReply(feedback, replyDraft);
    setSavingReply(false);
    setEditingReply(false);
  }

  return (
    <div
      className="flex flex-col gap-2.5 p-4 rounded-[var(--radius-lg)]"
      style={{
        backgroundColor: isPending
          ? "rgba(245,158,11,0.06)"
          : feedback.favorite
            ? "rgba(245,158,11,0.06)"
            : "var(--color-bg-surface)",
        border: `1px solid ${
          isPending
            ? "var(--color-warning)"
            : !feedback.seen
              ? "var(--color-primary)"
              : feedback.favorite
                ? "rgba(245,158,11,0.3)"
                : "var(--color-border)"
        }`,
        opacity: isHidden ? 0.6 : 1,
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--color-text-primary)" }}
              >
                {feedback.name?.trim() || "Anônimo"}
              </p>
              {isPending && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(245,158,11,0.15)",
                    color: "var(--color-warning)",
                    border: "1px solid rgba(245,158,11,0.3)",
                  }}
                >
                  Pendente
                </span>
              )}
              {isHidden && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Oculta
                </span>
              )}
            </div>
            <Stars rating={feedback.rating} />
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {(isPending || isHidden) && (
              <button
                onClick={() => onSetStatus(feedback, "approved")}
                title={isPending ? "Aprovar avaliação" : "Restaurar avaliação"}
                className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center cursor-pointer transition-all"
                style={{
                  backgroundColor: "rgba(34,197,94,0.12)",
                  color: "var(--color-success)",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                <FiCheck size={14} />
              </button>
            )}
            {!isHidden && (
              <button
                onClick={() => onSetStatus(feedback, "hidden")}
                title={isPending ? "Rejeitar (ocultar)" : "Ocultar avaliação"}
                className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center cursor-pointer transition-all"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <FiEyeOff size={14} />
              </button>
            )}
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

      {canManage ? (
        <div
          className="flex flex-col gap-1.5 pt-2.5"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {editingReply ? (
            <>
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Escreva uma resposta pública..."
                rows={2}
                maxLength={500}
                autoFocus
                className="w-full text-sm rounded-[var(--radius-md)] px-3 py-2 outline-none resize-none"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => {
                    setEditingReply(false);
                    setReplyDraft(feedback.reply ?? "");
                  }}
                  className="text-xs cursor-pointer"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveReply}
                  disabled={savingReply}
                  className="h-7 px-2.5 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                >
                  {savingReply ? "Salvando..." : "Salvar resposta"}
                </button>
              </div>
            </>
          ) : feedback.reply ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "var(--color-primary)" }}
                >
                  <FiCornerUpLeft size={11} />
                  Sua resposta
                </span>
                <button
                  onClick={() => setEditingReply(true)}
                  className="text-xs cursor-pointer"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Editar
                </button>
              </div>
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {feedback.reply}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setEditingReply(true)}
              className="flex items-center gap-1.5 text-xs font-medium cursor-pointer w-fit"
              style={{ color: "var(--color-primary)" }}
            >
              <FiCornerUpLeft size={12} />
              Responder publicamente
            </button>
          )}
        </div>
      ) : feedback.reply ? (
        <div
          className="flex flex-col gap-1 pt-2.5"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <span
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            <FiCornerUpLeft size={11} />
            Resposta
          </span>
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {feedback.reply}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function FeedbackTab({
  canManage,
  onPendingCountChange,
}: {
  canManage: boolean;
  onPendingCountChange?: (count: number) => void;
}) {
  const { appUser, refreshUser } = useAuth();
  const { success, error } = useToast();
  const devMode = useDevMode();
  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "?", username: "?" };
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Feedback | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [savingSidebarNotify, setSavingSidebarNotify] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all",
  );

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "feedbacks"), orderBy("createdAt", "desc")),
      (snap) => {
        recordFirestoreRead(snap.docChanges().length);
        setFeedbacks(sortFeedbacks(snap.docs.map(parseFeedback)));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        error("Erro ao carregar avaliações", "Tente recarregar a página.");
        setLoading(false);
      },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onPendingCountChange?.(
      feedbacks.filter((f) => (f.status ?? "approved") === "pending").length,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbacks]);

  async function handleToggleSidebarNotify(checked: boolean) {
    if (!appUser) return;
    setSavingSidebarNotify(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        notifyReviewsInSidebar: checked,
      });
      recordFirestoreWrite(1);
      await refreshUser();
    } catch (err) {
      console.error(err);
      error("Erro ao atualizar preferência", "Tente novamente.");
    } finally {
      setSavingSidebarNotify(false);
    }
  }

  async function handleMarkAsSeen(feedback: Feedback) {
    if (feedback.seen) return;
    try {
      await updateDoc(doc(db, "feedbacks", feedback.id), { seen: true });
      recordFirestoreWrite(1);
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
      recordFirestoreWrite(1);
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

  async function handleSetStatus(feedback: Feedback, status: FeedbackStatus) {
    const prevStatus = feedback.status ?? "approved";
    if (prevStatus === status) return;
    try {
      await updateDoc(doc(db, "feedbacks", feedback.id), { status });
      recordFirestoreWrite(1);
      setFeedbacks((prev) =>
        sortFeedbacks(
          prev.map((f) => (f.id === feedback.id ? { ...f, status } : f)),
        ),
      );

      const authorName = feedback.name?.trim() || "Anônimo";
      const labels: Record<FeedbackStatus, string> = {
        pending: "pendente",
        approved: "aprovada",
        hidden: "oculta",
      };
      success(
        status === "approved" ? "Avaliação aprovada" : "Avaliação ocultada",
        status === "approved"
          ? "Agora está visível para os clientes no site."
          : "Não aparece mais para os clientes.",
      );
      log({
        action: "set_feedback_status",
        category: "site",
        description: `Marcou a avaliação de "${authorName}" como ${labels[status]}`,
        performedBy: actor,
        target: { type: "feedback", id: feedback.id, name: authorName },
        changes: [{ field: "status", from: labels[prevStatus], to: labels[status] }],
      });
    } catch (err) {
      console.error(err);
      error("Erro ao atualizar", "Tente novamente.");
    }
  }

  async function handleSaveReply(feedback: Feedback, reply: string) {
    const trimmed = reply.trim();
    if (trimmed === (feedback.reply ?? "")) return;
    try {
      await updateDoc(doc(db, "feedbacks", feedback.id), {
        reply: trimmed.length > 0 ? trimmed : null,
        repliedAt: trimmed.length > 0 ? serverTimestamp() : null,
      });
      recordFirestoreWrite(1);
      setFeedbacks((prev) =>
        sortFeedbacks(
          prev.map((f) =>
            f.id === feedback.id
              ? {
                  ...f,
                  reply: trimmed.length > 0 ? trimmed : undefined,
                  repliedAt: trimmed.length > 0 ? new Date() : undefined,
                }
              : f,
          ),
        ),
      );
      success(
        trimmed.length > 0 ? "Resposta salva" : "Resposta removida",
        trimmed.length > 0 ? "Sua resposta já aparece no site." : "",
      );

      const authorName = feedback.name?.trim() || "Anônimo";
      log({
        action: "reply_feedback",
        category: "site",
        description: trimmed.length > 0
          ? `Respondeu a avaliação de "${authorName}"`
          : `Removeu a resposta da avaliação de "${authorName}"`,
        performedBy: actor,
        target: { type: "feedback", id: feedback.id, name: authorName },
      });
    } catch (err) {
      console.error(err);
      error("Erro ao salvar resposta", "Tente novamente.");
    }
  }

  async function handleDelete(fb?: Feedback) {
    const target = fb ?? deleteTarget;
    if (!target) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "feedbacks", target.id));
      recordFirestoreWrite(1);
      setFeedbacks((prev) => prev.filter((f) => f.id !== target.id));
      success("Avaliação excluída", "O comentário foi removido.");

      const authorName = target.name?.trim() || "Anônimo";
      log({
        action: "delete_feedback",
        category: "site",
        description: `Excluiu a avaliação de "${authorName}"`,
        performedBy: actor,
        target: { type: "feedback", id: target.id, name: authorName },
      });

      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      error("Erro ao excluir", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredFeedbacks = feedbacks.filter(
    (f) => statusFilter === "all" || (f.status ?? "approved") === statusFilter,
  );

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
            Comentários enviados pelo site, em tempo real. Avaliações
            pendentes precisam de aprovação antes de aparecer publicamente —
            você também pode ocultar e responder cada uma.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: "all", label: "Todas" },
            { key: "pending", label: "Pendentes" },
            { key: "approved", label: "Aprovadas" },
            { key: "hidden", label: "Ocultas" },
          ] as { key: FeedbackStatus | "all"; label: string }[]
        ).map((opt) => {
          const count =
            opt.key === "all"
              ? feedbacks.length
              : feedbacks.filter((f) => (f.status ?? "approved") === opt.key)
                  .length;
          const showPendingDot = opt.key === "pending" && count > 0;
          return (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className="relative px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor:
                  statusFilter === opt.key
                    ? "var(--color-primary)"
                    : "var(--color-bg-elevated)",
                color:
                  statusFilter === opt.key
                    ? "white"
                    : "var(--color-text-muted)",
                border: `1px solid ${statusFilter === opt.key ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              {opt.label} ({count})
              {showPendingDot && (
                <>
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping"
                    style={{ backgroundColor: "var(--color-warning)", opacity: 0.6 }}
                  />
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "var(--color-warning)" }}
                  />
                </>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="flex items-center justify-between p-4 rounded-[var(--radius-lg)]"
        style={{
          backgroundColor: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <FiBell size={16} style={{ color: "var(--color-text-muted)" }} />
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Aviso no menu lateral
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Mostra um badge de avaliações não vistas também na barra lateral
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            handleToggleSidebarNotify(!appUser?.notifyReviewsInSidebar)
          }
          disabled={savingSidebarNotify}
          className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: appUser?.notifyReviewsInSidebar
              ? "var(--color-primary)"
              : "var(--color-border)",
          }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{
              transform: appUser?.notifyReviewsInSidebar
                ? "translateX(22px)"
                : "translateX(2px)",
            }}
          />
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
      ) : filteredFeedbacks.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 gap-3 rounded-[var(--radius-lg)]"
          style={{
            border: "1px dashed var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <FiMessageSquare size={28} style={{ opacity: 0.4 }} />
          <p className="text-sm">
            {statusFilter === "all"
              ? "Nenhuma avaliação recebida ainda."
              : "Nenhuma avaliação nesse filtro."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {filteredFeedbacks.map((f) => (
            <FeedbackCard
              key={f.id}
              feedback={f}
              canManage={canManage}
              onToggleFavorite={handleToggleFavorite}
              onDelete={(fb) => devMode.skipConfirmations ? handleDelete(fb) : setDeleteTarget(fb)}
              onMarkAsSeen={handleMarkAsSeen}
              onSetStatus={handleSetStatus}
              onSaveReply={handleSaveReply}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Excluir avaliação"
          description="Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita."
          onConfirm={() => handleDelete()}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
