"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { FiX, FiSend, FiMessageSquare } from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Order, ChatMessage, ChatTemplate } from "@/types";

function fmtMsgTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggListRef = useRef<HTMLDivElement>(null);

  // Subscribe to messages
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
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        })),
      );
      setLoading(false);
    });
    return unsub;
  }, [order.id]);

  // Load templates once on open
  useEffect(() => {
    getDocs(query(collection(db, "chatTemplates"), orderBy("trigger")))
      .then((snap) => {
        setTemplates(
          snap.docs.map((d) => ({
            id: d.id,
            trigger: d.data().trigger as string,
            title: (d.data().title as string) ?? "",
            message: d.data().message as string,
            createdAt:
              (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
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

  // Auto-resize textarea whenever text changes (handles template selection too)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // Escape closes drawer (only when suggestions are not open)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Suggestions ──────────────────────────────────────────────────────────────

  const isSlashMode = text.startsWith("/");
  const queryStr = isSlashMode ? text.slice(1).toLowerCase() : "";
  const suggestions = isSlashMode
    ? templates.filter(
        (t) =>
          t.trigger.includes(queryStr) ||
          t.title.toLowerCase().includes(queryStr),
      )
    : [];
  const safeIdx = Math.min(selectedIdx, Math.max(0, suggestions.length - 1));

  // Scroll highlighted suggestion into view
  useEffect(() => {
    const el = suggListRef.current?.children[safeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  function selectTemplate(t: ChatTemplate) {
    setText(t.message);
    setSelectedIdx(0);
    inputRef.current?.focus();
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
        createdAt: serverTimestamp(),
      });
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectTemplate(suggestions[safeIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        setText("");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        selectTemplate(suggestions[safeIdx]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
            <p
              className="font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Chat — Pedido #{order.orderNumber}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
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
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Carregando...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-3"
              style={{ opacity: 0.4 }}
            >
              <FiMessageSquare
                size={36}
                style={{ color: "var(--color-text-muted)" }}
              />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Nenhuma mensagem ainda
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender === "admin";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%] flex flex-col gap-0.5">
                    {!isAdmin && (
                      <p
                        className="text-[10px] font-medium px-1"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {msg.senderName}
                      </p>
                    )}
                    <div
                      className="px-3 py-2 rounded-[var(--radius-md)]"
                      style={{
                        backgroundColor: isAdmin
                          ? "var(--color-primary)"
                          : "var(--color-bg-elevated)",
                        color: isAdmin ? "white" : "var(--color-text-primary)",
                        border: isAdmin ? "none" : "1px solid var(--color-border)",
                      }}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                      <p
                        className={`text-[10px] mt-1 ${isAdmin ? "text-right" : ""}`}
                        style={{
                          opacity: 0.65,
                          color: isAdmin ? "white" : "var(--color-text-muted)",
                        }}
                      >
                        {fmtMsgTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
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
            <div
              style={{
                borderBottom: "1px solid var(--color-border)",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-2 px-4 py-1.5"
                style={{ backgroundColor: "var(--color-bg-elevated)" }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: "var(--color-primary)" }}
                >
                  /
                </span>
                <p
                  className="text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Mensagens prontas
                </p>
                <p
                  className="text-[10px] ml-auto"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ↑↓ navegar · Enter/Tab selecionar · Esc fechar
                </p>
              </div>
              {/* Suggestions list */}
              <div ref={suggListRef}>
                {suggestions.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="w-full flex flex-col px-4 py-2.5 text-left cursor-pointer"
                    style={{
                      backgroundColor:
                        i === safeIdx
                          ? "var(--color-bg-elevated)"
                          : "transparent",
                      borderBottom:
                        i < suggestions.length - 1
                          ? "1px solid var(--color-border)"
                          : undefined,
                    }}
                    onMouseEnter={() => setSelectedIdx(i)}
                  >
                    <div className="flex items-center gap-2">
                      <code
                        className="text-xs font-bold"
                        style={{ color: "var(--color-primary)" }}
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
                      className="text-xs mt-0.5 line-clamp-1"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {t.message}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input + send button */}
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
                backgroundColor: text.trim()
                  ? "var(--color-primary)"
                  : "var(--color-bg-elevated)",
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
