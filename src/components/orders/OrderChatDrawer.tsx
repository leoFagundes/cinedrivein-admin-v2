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
  getDocs,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { FiX, FiSend, FiMessageSquare, FiEdit2, FiTrash2, FiCheck, FiMoreVertical } from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Order, ChatMessage, ChatTemplate } from "@/types";
import { renderMarkdown } from "@/lib/chat-format";
import RichTextToolbar from "@/components/ui/RichTextToolbar";

function fmtMsgTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Speech-bubble tail ────────────────────────────────────────────────────────

function BubbleTail({ side, color }: { side: "left" | "right"; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        ...(side === "right" ? { right: -7 } : { left: -7 }),
        width: 0,
        height: 0,
        borderTop: "6px solid transparent",
        borderBottom: "6px solid transparent",
        ...(side === "right"
          ? { borderLeft: `8px solid ${color}` }
          : { borderRight: `8px solid ${color}` }),
      }}
    />
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  onEdit,
  onDelete,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const bgColor = isMine ? "var(--color-primary)" : "var(--color-bg-elevated)";
  const textColor = isMine ? "white" : "var(--color-text-primary)";
  const borderRadius = isMine ? "12px 12px 3px 12px" : "12px 12px 12px 3px";

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  const dotsMenu = (
    <div className="relative flex-shrink-0 self-center" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="p-1 rounded cursor-pointer transition-opacity hover:opacity-70"
        style={{ color: "var(--color-text-muted)" }}
        title="Opções"
      >
        <FiMoreVertical size={14} />
      </button>

      {menuOpen && (
        <div
          className="absolute z-10 rounded-[var(--radius-md)] overflow-hidden"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            top: "100%",
            minWidth: 130,
            ...(isMine ? { right: 0 } : { left: 0 }),
          }}
        >
          {confirmDelete ? (
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Excluir mensagem?
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { onDelete(); setMenuOpen(false); setConfirmDelete(false); }}
                  className="flex-1 py-1 rounded text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--color-error)", color: "white" }}
                >
                  Excluir
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-1 rounded text-xs cursor-pointer transition-opacity hover:opacity-70"
                  style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
                >
                  Não
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => { onEdit(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer"
                style={{ color: "var(--color-text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <FiEdit2 size={13} />
                Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer"
                style={{ color: "var(--color-error)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <FiTrash2 size={13} />
                Excluir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
      {!isMine && (
        <p className="text-[10px] font-medium px-1" style={{ color: "var(--color-text-muted)" }}>
          {msg.senderName}
        </p>
      )}
      <div className={`flex items-start gap-1.5 w-full ${isMine ? "flex-row-reverse" : "flex-row"}`}>
        {isMine && dotsMenu}
        <div
          className="relative max-w-[82%] px-3 py-2"
          style={{
            backgroundColor: bgColor,
            color: textColor,
            borderRadius,
            border: isMine ? "none" : "1px solid var(--color-border)",
          }}
        >
          <BubbleTail side={isMine ? "right" : "left"} color={bgColor} />
          <div
            className="text-sm leading-relaxed"
            style={{ wordBreak: "normal", overflowWrap: "break-word" }}
          >
            {renderMarkdown(msg.text)}
          </div>
          <div
            className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}
            style={{ opacity: 0.6 }}
          >
            <span className="text-[10px]">{fmtMsgTime(msg.createdAt)}</span>
            {msg.editedAt && <span className="text-[10px]">(editado)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function OrderChatDrawer({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { appUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [templates, setTemplates] = useState<ChatTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const suggListRef = useRef<HTMLDivElement>(null);

  // Messages subscription
  useEffect(() => {
    const q = query(
      collection(db, "orders", order.id, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          text: d.data().text as string,
          sender: d.data().sender as ChatMessage["sender"],
          senderName: d.data().senderName as string,
          uid: d.data().uid as string | undefined,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
          editedAt: (d.data().editedAt as Timestamp)?.toDate(),
        })),
      );
      setLoading(false);
    });
    return unsub;
  }, [order.id]);

  // Load templates once
  useEffect(() => {
    getDocs(query(collection(db, "chatTemplates"), orderBy("trigger")))
      .then((snap) => {
        setTemplates(
          snap.docs.map((d) => ({
            id: d.id,
            trigger: d.data().trigger as string,
            title: (d.data().title as string) ?? "",
            message: d.data().message as string,
            createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
          })),
        );
      })
      .catch(() => {});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize send textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // Focus edit textarea when editing starts
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  // Auto-resize edit textarea
  useEffect(() => {
    const el = editInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [editText]);

  // Escape: close edit or close drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (editingId) { setEditingId(null); setEditText(""); }
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editingId]);

  // ── Suggestions ──────────────────────────────────────────────────────────────

  const isSlashMode = text.startsWith("/");
  const queryStr = isSlashMode ? text.slice(1).toLowerCase() : "";
  const suggestions = isSlashMode
    ? templates.filter(
        (t) => t.trigger.includes(queryStr) || t.title.toLowerCase().includes(queryStr),
      )
    : [];
  const safeIdx = Math.min(selectedIdx, Math.max(0, suggestions.length - 1));

  useEffect(() => {
    const el = suggListRef.current?.children[safeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  function selectTemplate(t: ChatTemplate) {
    setText(t.message);
    setSelectedIdx(0);
    inputRef.current?.focus();
  }

  // ── Format insert ─────────────────────────────────────────────────────────────

  function insertFormat(prefix: string, suffix: string) {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    handleTextChange(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  }

  // ── Send ──────────────────────────────────────────────────────────────────────

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !appUser || sending) return;
    setSending(true);
    setText("");
    try {
      await addDoc(collection(db, "orders", order.id, "messages"), {
        text: trimmed,
        sender: "admin",
        senderName: appUser.username,
        uid: appUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  function startEdit(msg: ChatMessage) {
    setEditingId(msg.id);
    setEditText(msg.text);
  }

  async function saveEdit() {
    if (!editingId || !editText.trim()) return;
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "orders", order.id, "messages", editingId), {
        text: editText.trim(),
        editedAt: serverTimestamp(),
      });
      setEditingId(null);
      setEditText("");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteMessage(msgId: string) {
    await deleteDoc(doc(db, "orders", order.id, "messages", msgId));
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") { e.preventDefault(); selectTemplate(suggestions[safeIdx]); return; }
      if (e.key === "Escape") { e.stopPropagation(); setText(""); return; }
      if (e.key === "Tab") { e.preventDefault(); selectTemplate(suggestions[safeIdx]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleTextChange(v: string) {
    setText(v);
    setSelectedIdx(0);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-[400px]"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div>
            <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Chat — Pedido #{order.orderNumber}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Vaga {order.spot} · {order.username}
              {order.phone && ` · ${order.phone}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Carregando...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ opacity: 0.4 }}>
              <FiMessageSquare size={36} style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Nenhuma mensagem ainda</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine =
                msg.sender === "admin" &&
                (msg.uid === appUser?.uid ||
                  (!msg.uid && msg.senderName === appUser?.username));
              const isAdmin = msg.sender === "admin";

              if (editingId === msg.id) {
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className="w-[85%] flex flex-col gap-1.5">
                      <textarea
                        ref={editInputRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                        }}
                        rows={2}
                        className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm outline-none resize-none"
                        style={{
                          backgroundColor: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-primary)",
                          color: "var(--color-text-primary)",
                          lineHeight: "1.5",
                        }}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => { setEditingId(null); setEditText(""); }}
                          className="px-2.5 py-1 rounded text-xs cursor-pointer transition-opacity hover:opacity-70"
                          style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={savingEdit || !editText.trim()}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer transition-opacity hover:opacity-80"
                          style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                        >
                          <FiCheck size={11} />
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isMine={isMine}
                  onEdit={() => startEdit(msg)}
                  onDelete={() => deleteMessage(msg.id)}
                />
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {/* Suggestions panel */}
          {suggestions.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--color-border)", maxHeight: "200px", overflowY: "auto" }}>
              <div className="flex items-center gap-2 px-4 py-1.5" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>/</span>
                <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Mensagens prontas</p>
                <p className="text-[10px] ml-auto" style={{ color: "var(--color-text-muted)" }}>↑↓ Enter/Tab · Esc fechar</p>
              </div>
              <div ref={suggListRef}>
                {suggestions.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="w-full flex flex-col px-4 py-2.5 text-left cursor-pointer"
                    style={{
                      backgroundColor: i === safeIdx ? "var(--color-bg-elevated)" : "transparent",
                      borderBottom: i < suggestions.length - 1 ? "1px solid var(--color-border)" : undefined,
                    }}
                    onMouseEnter={() => setSelectedIdx(i)}
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>/{t.trigger}</code>
                      {t.title && t.title !== t.trigger && (
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t.title}</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--color-text-muted)" }}>{t.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formatting toolbar */}
          <RichTextToolbar onFormat={insertFormat} />

          {/* Textarea + send */}
          <div className="flex gap-2 px-4 py-3 items-end">
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Mensagem... (digite "/" para respostas prontas)'
              className="flex-1 px-3 py-2.5 rounded-[var(--radius-md)] text-sm outline-none resize-none"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: `1px solid ${isSlashMode ? "var(--color-primary)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
                lineHeight: "1.5",
                overflow: "hidden",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim() || sending}
              className="p-2.5 rounded-[var(--radius-md)] cursor-pointer transition-opacity hover:opacity-80 flex-shrink-0"
              style={{
                backgroundColor: text.trim() ? "var(--color-primary)" : "var(--color-bg-elevated)",
                color: text.trim() ? "white" : "var(--color-text-muted)",
                border: text.trim() ? "none" : "1px solid var(--color-border)",
              }}
            >
              <FiSend size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
