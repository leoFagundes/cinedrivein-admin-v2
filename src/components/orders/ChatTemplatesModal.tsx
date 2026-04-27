"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  FiX,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiArrowLeft,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { ChatTemplate } from "@/types";
import { renderMarkdown } from "@/lib/chat-format";
import RichTextToolbar from "@/components/ui/RichTextToolbar";

function sanitizeTrigger(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export default function ChatTemplatesModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<ChatTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<ChatTemplate | null>(null);

  const msgRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [triggerError, setTriggerError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "chatTemplates"), orderBy("trigger"));
    return onSnapshot(q, (snap) => {
      setTemplates(
        snap.docs.map((d) => ({
          id: d.id,
          trigger: d.data().trigger as string,
          title: (d.data().title as string) ?? "",
          message: d.data().message as string,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        })),
      );
      setLoading(false);
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setTrigger("");
    setTitle("");
    setMessage("");
    setTriggerError("");
    setMessageError("");
    setView("form");
  }

  function openEdit(t: ChatTemplate) {
    setEditing(t);
    setTrigger(t.trigger);
    setTitle(t.title);
    setMessage(t.message);
    setTriggerError("");
    setMessageError("");
    setView("form");
  }

  function insertFormat(prefix: string, suffix: string) {
    const el = msgRef.current;
    if (!el) return;
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const selected = message.slice(start, end);
    const newText = message.slice(0, start) + prefix + selected + suffix + message.slice(end);
    setMessage(newText);
    setMessageError("");
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  }

  function backToList() {
    setView("list");
    setEditing(null);
    setConfirmDeleteId(null);
  }

  async function save() {
    const cleanTrigger = sanitizeTrigger(trigger);
    let ok = true;
    if (!cleanTrigger) {
      setTriggerError("Trigger obrigatório");
      ok = false;
    }
    if (!message.trim()) {
      setMessageError("Mensagem obrigatória");
      ok = false;
    }
    if (!ok) return;
    setSaving(true);
    try {
      const payload = {
        trigger: cleanTrigger,
        title: title.trim() || cleanTrigger,
        message: message.trim(),
      };
      if (editing) {
        await updateDoc(doc(db, "chatTemplates", editing.id), payload);
      } else {
        await addDoc(collection(db, "chatTemplates"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      backToList();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "chatTemplates", id));
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            {view === "form" && (
              <button
                onClick={backToList}
                className="p-1 rounded cursor-pointer transition-opacity hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiArrowLeft size={16} />
              </button>
            )}
            <p
              className="font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {view === "form"
                ? editing
                  ? "Editar mensagem"
                  : "Nova mensagem"
                : "Mensagens prontas"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-primary)", color: "white" }}
              >
                <FiPlus size={14} />
                Nova
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* List view */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Carregando...
                </p>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Nenhuma mensagem criada
                </p>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                >
                  <FiPlus size={14} />
                  Criar primeira mensagem
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {templates.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 px-5 py-3.5"
                    style={{
                      borderBottom:
                        i < templates.length - 1
                          ? "1px solid var(--color-border)"
                          : undefined,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "var(--color-primary-light)",
                            color: "var(--color-primary)",
                          }}
                        >
                          /{t.trigger}
                        </code>
                        {t.title && t.title !== t.trigger && (
                          <span
                            className="text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {t.title}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm line-clamp-2"
                        style={{
                          color: "var(--color-text-secondary)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {t.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {confirmDeleteId === t.id ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Excluir?
                          </span>
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deletingId === t.id}
                            className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
                            style={{ color: "var(--color-error)" }}
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs cursor-pointer transition-opacity hover:opacity-70"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
                            style={{ color: "var(--color-text-muted)" }}
                            title="Editar"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(t.id)}
                            className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
                            style={{ color: "var(--color-error)" }}
                            title="Excluir"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form view */}
        {view === "form" && (
          <>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Trigger */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Trigger{" "}
                  <span
                    className="font-normal text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    — o que o operador digita no chat
                  </span>
                </label>
                <div
                  className="flex items-center overflow-hidden"
                  style={{
                    border: `1px solid ${triggerError ? "var(--color-error)" : "var(--color-border)"}`,
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-bg-elevated)",
                  }}
                >
                  <span
                    className="px-3 py-2 text-sm font-bold flex-shrink-0"
                    style={{
                      color: "var(--color-primary)",
                      backgroundColor: "var(--color-primary-light)",
                      borderRight: "1px solid var(--color-border)",
                    }}
                  >
                    /
                  </span>
                  <input
                    value={trigger}
                    onChange={(e) => {
                      setTrigger(sanitizeTrigger(e.target.value));
                      setTriggerError("");
                    }}
                    placeholder="molhos"
                    className="flex-1 px-3 py-2 bg-transparent text-sm outline-none"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                </div>
                {triggerError && (
                  <p className="text-xs" style={{ color: "var(--color-error)" }}>
                    {triggerError}
                  </p>
                )}
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Título{" "}
                  <span
                    className="font-normal text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    — opcional, aparece no menu de sugestões
                  </span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Lista de molhos disponíveis"
                  className="px-3 py-2 rounded-[var(--radius-md)] text-sm outline-none"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Mensagem
                </label>
                <div
                  className="rounded-[var(--radius-md)] overflow-hidden"
                  style={{ border: `1px solid ${messageError ? "var(--color-error)" : "var(--color-border)"}` }}
                >
                  <RichTextToolbar onFormat={insertFormat} />
                  <textarea
                    ref={msgRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setMessageError("");
                    }}
                    placeholder={"Nossos molhos disponíveis são:\n• Catchup\n• Maionese\n• Barbecue\n• Mostarda"}
                    rows={6}
                    className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      color: "var(--color-text-primary)",
                      lineHeight: "1.6",
                    }}
                  />
                </div>
                {messageError && (
                  <p className="text-xs" style={{ color: "var(--color-error)" }}>
                    {messageError}
                  </p>
                )}
              </div>

              {/* Preview */}
              {message.trim() && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    Pré-visualização
                  </p>
                  <div
                    className="px-3 py-2.5 rounded-[var(--radius-md)] text-sm"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)",
                      lineHeight: "1.6",
                    }}
                  >
                    {renderMarkdown(message)}
                  </div>
                </div>
              )}
            </div>

            <div
              className="flex gap-2 px-5 py-4 flex-shrink-0"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                onClick={backToList}
                disabled={saving}
                className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-primary)", color: "white" }}
              >
                {saving
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "Criar mensagem"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
