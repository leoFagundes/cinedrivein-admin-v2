/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  FiVolume2,
  FiVolumeX,
  FiMusic,
  FiSliders,
  FiCheck,
  FiX,
  FiMessageSquare,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { recordFirestoreRead, recordFirestoreWrite } from "@/lib/firestoreDevTracker";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Order } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SoundOption = "som1" | "som2" | "som3" | "som4" | "som5" | "som6";

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0–1
  sound: SoundOption;
  // Som específico para mensagens de chat
  chatSoundEnabled: boolean;
  chatSound: SoundOption;
  chatVolume: number;
}

const SOUND_DOC = "soundSettings"; // storeConfig/soundSettings

const DEFAULTS: SoundSettings = {
  enabled: true,
  volume: 0.7,
  sound: "som1",
  chatSoundEnabled: true,
  chatSound: "som2",
  chatVolume: 0.6,
};

const SOUND_LABELS: Record<SoundOption, string> = {
  som1: "Som 1",
  som2: "Som 2",
  som3: "Som 3",
  som4: "Som 4",
  som5: "Som 5",
  som6: "Som 6",
};

const SOUNDS: SoundOption[] = ["som1", "som2", "som3", "som4", "som5", "som6"];

// ── Module-level live settings ────────────────────────────────────────────────
// Updated synchronously whenever save() is called.
// play() and playChat() always read from here — no closures, no refs, no timing issues.

let _live: SoundSettings = { ...DEFAULTS };
let _liveLoaded = false; // true only after Firebase settings are fetched
let _lastPlay = 0;
let _lastPlayChat = 0;
const DEBOUNCE_MS = 800;

function normalize(data: Partial<SoundSettings>): SoundSettings {
  return {
    enabled: data.enabled ?? DEFAULTS.enabled,
    volume: typeof data.volume === "number" ? data.volume : DEFAULTS.volume,
    sound: (data.sound as SoundOption) ?? DEFAULTS.sound,
    chatSoundEnabled: data.chatSoundEnabled ?? DEFAULTS.chatSoundEnabled,
    chatSound: (data.chatSound as SoundOption) ?? DEFAULTS.chatSound,
    chatVolume:
      typeof data.chatVolume === "number"
        ? data.chatVolume
        : DEFAULTS.chatVolume,
  };
}

// ── Core hook ─────────────────────────────────────────────────────────────────

function useSoundAlertCore() {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  // Load from Firebase on mount
  useEffect(() => {
    getDoc(doc(db, "storeConfig", SOUND_DOC))
      .then((snap) => {
        recordFirestoreRead(1);
        const loaded = snap.exists() ? normalize(snap.data()) : { ...DEFAULTS };
        _live = loaded;
        _liveLoaded = true;
        setSettings(loaded);
      })
      .catch(() => {
        _liveLoaded = true;
      }) // even on error, allow sounds with defaults
      .finally(() => setLoading(false));
  }, []);

  // Save patch to Firebase — updates _live synchronously so play/playChat
  // see the new values immediately, before the async Firebase write completes.
  const save = useCallback(async (patch: Partial<SoundSettings>) => {
    _live = normalize({ ..._live, ...patch });
    _liveLoaded = true;
    setSettings({ ..._live });
    try {
      await setDoc(doc(db, "storeConfig", SOUND_DOC), _live);
      recordFirestoreWrite(1);
    } catch {
      // silent — UI already updated, Firebase write best-effort
    }
  }, []);

  // Play order alert — reads _live, debounced, only after Firebase has loaded
  const play = useCallback(() => {
    if (!_liveLoaded || !_live.enabled) return;
    const now = Date.now();
    if (now - _lastPlay < DEBOUNCE_MS) return;
    _lastPlay = now;
    const audio = new Audio(`/music/${_live.sound}.mp3`);
    audio.volume = _live.volume;
    audio.play().catch(() => {});
  }, []);

  // Play chat alert — reads _live, debounced, only after Firebase has loaded
  const playChat = useCallback(() => {
    if (!_liveLoaded || !_live.chatSoundEnabled) return;
    const now = Date.now();
    if (now - _lastPlayChat < DEBOUNCE_MS) return;
    _lastPlayChat = now;
    const audio = new Audio(`/music/${_live.chatSound}.mp3`);
    audio.volume = _live.chatVolume;
    audio.play().catch(() => {});
  }, []);

  return { settings, loading, save, play, playChat };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface SoundAlertContextValue {
  settings: SoundSettings;
  loading: boolean;
  save: (patch: Partial<SoundSettings>) => Promise<void>;
  play: () => void;
  playChat: () => void;
}

const SoundAlertContext = createContext<SoundAlertContextValue | null>(null);

export function SoundAlertProvider({ children }: { children: ReactNode }) {
  const value = useSoundAlertCore();
  return (
    <SoundAlertContext.Provider value={value}>
      {children}
    </SoundAlertContext.Provider>
  );
}

export function useSoundAlert(): SoundAlertContextValue {
  const ctx = useContext(SoundAlertContext);
  if (!ctx)
    throw new Error("useSoundAlert must be used inside <SoundAlertProvider>");
  return ctx;
}

// ── Auto-sound hook ────────────────────────────────────────────────────────────

export function useAutoSound(orders: Order[]) {
  const { play } = useSoundAlert();
  const prevIdsRef = useRef<Set<string>>(new Set());
  const baselineRef = useRef<Set<string> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (baselineRef.current === null) {
      baselineRef.current = new Set(orders.map((o) => o.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevIdsRef.current = new Set(orders.map((o) => o.id));
      return;
    }

    let shouldPlay = false;
    for (const order of orders) {
      if (
        !prevIdsRef.current.has(order.id) &&
        !baselineRef.current?.has(order.id)
      ) {
        shouldPlay = true;
        break;
      }
    }
    if (shouldPlay) play(); // play() checks enabled and debounces internally
    prevIdsRef.current = new Set(orders.map((o) => o.id));
  }, [orders, play]);
}

// ── Floating Button Component ─────────────────────────────────────────────────

type PanelTab = "orders" | "chat";

export function SoundAlertButton() {
  const { settings, save } = useSoundAlert();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("orders");
  const panelRef = useRef<HTMLDivElement>(null);

  // Pending state — changes only apply when Save is clicked
  const [pending, setPending] = useState<SoundSettings>(settings);
  const [ordersSaved, setOrdersSaved] = useState(false);
  const [chatSaved, setChatSaved] = useState(false);

  // Reset pending to saved settings whenever the panel opens
  useEffect(() => {
    if (open) setPending(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function previewSound(s: SoundOption) {
    setPending((p) => ({ ...p, sound: s }));
    const audio = new Audio(`/music/${s}.mp3`);
    audio.volume = pending.volume;
    audio.play().catch(() => {});
  }

  function previewChatSound(s: SoundOption) {
    setPending((p) => ({ ...p, chatSound: s }));
    const audio = new Audio(`/music/${s}.mp3`);
    audio.volume = pending.chatVolume;
    audio.play().catch(() => {});
  }

  async function saveOrders() {
    await save({
      enabled: pending.enabled,
      volume: pending.volume,
      sound: pending.sound,
    });
    setOrdersSaved(true);
    setTimeout(() => setOrdersSaved(false), 2000);
  }

  async function saveChat() {
    await save({
      chatSoundEnabled: pending.chatSoundEnabled,
      chatVolume: pending.chatVolume,
      chatSound: pending.chatSound,
    });
    setChatSaved(true);
    setTimeout(() => setChatSaved(false), 2000);
  }

  const volumePct = Math.round(pending.volume * 100);
  const chatVolumePct = Math.round(pending.chatVolume * 100);

  return (
    <div
      ref={panelRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3"
    >
      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
          style={{
            width: 280,
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            boxShadow:
              "0 16px 48px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.2)",
            animation: "soundPanelIn 0.18s cubic-bezier(0.34,1.4,0.64,1)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,136,194,0.15) 0%, rgba(0,136,194,0.04) 100%)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: settings.enabled
                    ? "rgba(0,136,194,0.2)"
                    : "var(--color-bg-elevated)",
                  border: settings.enabled
                    ? "1px solid rgba(0,136,194,0.4)"
                    : "1px solid var(--color-border)",
                }}
              >
                <FiMusic
                  size={13}
                  style={{
                    color: settings.enabled
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)",
                  }}
                />
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Alerta Sonoro
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded cursor-pointer transition-opacity hover:opacity-60"
              style={{ color: "var(--color-text-muted)" }}
            >
              <FiX size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex gap-0"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            {(["orders", "chat"] as PanelTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium cursor-pointer transition-all"
                style={{
                  color:
                    activeTab === t
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)",
                  borderBottom: `2px solid ${activeTab === t ? "var(--color-primary)" : "transparent"}`,
                  backgroundColor:
                    activeTab === t ? "rgba(0,136,194,0.05)" : "transparent",
                }}
              >
                {t === "orders" ? (
                  <FiMusic size={11} />
                ) : (
                  <FiMessageSquare size={11} />
                )}
                {t === "orders" ? "Pedidos" : "Chat"}
              </button>
            ))}
          </div>

          {/* Tab: Pedidos */}
          {activeTab === "orders" && (
            <div className="flex flex-col gap-4 px-4 py-4">
              {/* Enable / disable toggle */}
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {pending.enabled ? "Som ativado" : "Som desativado"}
                </span>
                <button
                  onClick={() =>
                    setPending((p) => ({ ...p, enabled: !p.enabled }))
                  }
                  className="relative flex items-center cursor-pointer transition-all"
                  style={{ width: 44, height: 24 }}
                >
                  <span
                    className="absolute inset-0 rounded-full transition-colors"
                    style={{
                      backgroundColor: pending.enabled
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    }}
                  />
                  <span
                    className="absolute w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{
                      transform: pending.enabled
                        ? "translateX(24px)"
                        : "translateX(4px)",
                    }}
                  />
                </button>
              </div>

              {/* Volume slider */}
              <div
                className="flex flex-col gap-2"
                style={{ opacity: pending.enabled ? 1 : 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FiSliders
                      size={12}
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Volume
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {volumePct}%
                  </span>
                </div>
                <div
                  className="relative flex items-center"
                  style={{ height: 20 }}
                >
                  <div
                    className="absolute inset-y-0 my-auto rounded-full"
                    style={{
                      left: 0,
                      right: 0,
                      height: 4,
                      backgroundColor: "var(--color-bg-base)",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                  <div
                    className="absolute inset-y-0 my-auto rounded-full transition-all"
                    style={{
                      left: 0,
                      width: `${volumePct}%`,
                      height: 4,
                      backgroundColor: "var(--color-primary)",
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={pending.volume}
                    disabled={!pending.enabled}
                    onChange={(e) =>
                      setPending((p) => ({
                        ...p,
                        volume: parseFloat(e.target.value),
                      }))
                    }
                    className="relative w-full cursor-pointer"
                    style={{
                      height: 20,
                      appearance: "none",
                      background: "transparent",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Sound picker */}
              <div
                className="flex flex-col gap-1.5"
                style={{ opacity: pending.enabled ? 1 : 0.4 }}
              >
                <div className="flex items-center gap-1.5">
                  <FiMusic
                    size={12}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Som ao receber pedido
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {SOUNDS.map((s) => {
                    const active = pending.sound === s;
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          pending.enabled ? previewSound(s) : undefined
                        }
                        disabled={!pending.enabled}
                        className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] cursor-pointer transition-all"
                        style={{
                          backgroundColor: active
                            ? "rgba(0,136,194,0.12)"
                            : "var(--color-bg-elevated)",
                          border: active
                            ? "1px solid rgba(0,136,194,0.35)"
                            : "1px solid var(--color-border)",
                          color: active
                            ? "var(--color-primary)"
                            : "var(--color-text-secondary)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: active
                                ? "var(--color-primary)"
                                : "var(--color-bg-base)",
                              border: active
                                ? "none"
                                : "1px solid var(--color-border)",
                            }}
                          >
                            {active ? (
                              <FiCheck size={10} color="white" />
                            ) : (
                              <FiMusic
                                size={10}
                                style={{ color: "var(--color-text-muted)" }}
                              />
                            )}
                          </div>
                          <span className="text-xs font-medium">
                            {SOUND_LABELS[s]}
                          </span>
                        </div>
                        {active && (
                          <span
                            className="text-[10px] font-medium"
                            style={{
                              color: "var(--color-primary)",
                              opacity: 0.7,
                            }}
                          >
                            ▶ preview
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={saveOrders}
                className="w-full py-2 rounded-[var(--radius-md)] text-xs font-semibold cursor-pointer transition-all"
                style={{
                  backgroundColor: ordersSaved
                    ? "rgba(34,197,94,0.15)"
                    : "var(--color-primary)",
                  color: ordersSaved ? "var(--color-success)" : "white",
                  border: ordersSaved
                    ? "1px solid rgba(34,197,94,0.35)"
                    : "none",
                }}
              >
                {ordersSaved ? "✓ Salvo!" : "Salvar"}
              </button>
            </div>
          )}

          {/* Tab: Chat */}
          {activeTab === "chat" && (
            <div className="flex flex-col gap-4 px-4 py-4">
              {/* Enable chat sound toggle */}
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {pending.chatSoundEnabled ? "Som ativado" : "Som desativado"}
                </span>
                <button
                  onClick={() =>
                    setPending((p) => ({
                      ...p,
                      chatSoundEnabled: !p.chatSoundEnabled,
                    }))
                  }
                  className="relative flex items-center cursor-pointer transition-all"
                  style={{ width: 44, height: 24 }}
                >
                  <span
                    className="absolute inset-0 rounded-full transition-colors"
                    style={{
                      backgroundColor: pending.chatSoundEnabled
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    }}
                  />
                  <span
                    className="absolute w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{
                      transform: pending.chatSoundEnabled
                        ? "translateX(24px)"
                        : "translateX(4px)",
                    }}
                  />
                </button>
              </div>

              {/* Chat volume slider */}
              <div
                className="flex flex-col gap-2"
                style={{ opacity: pending.chatSoundEnabled ? 1 : 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FiSliders
                      size={12}
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Volume
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {chatVolumePct}%
                  </span>
                </div>
                <div
                  className="relative flex items-center"
                  style={{ height: 20 }}
                >
                  <div
                    className="absolute inset-y-0 my-auto rounded-full"
                    style={{
                      left: 0,
                      right: 0,
                      height: 4,
                      backgroundColor: "var(--color-bg-base)",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                  <div
                    className="absolute inset-y-0 my-auto rounded-full transition-all"
                    style={{
                      left: 0,
                      width: `${chatVolumePct}%`,
                      height: 4,
                      backgroundColor: "var(--color-primary)",
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={pending.chatVolume}
                    disabled={!pending.chatSoundEnabled}
                    onChange={(e) =>
                      setPending((p) => ({
                        ...p,
                        chatVolume: parseFloat(e.target.value),
                      }))
                    }
                    className="relative w-full cursor-pointer"
                    style={{
                      height: 20,
                      appearance: "none",
                      background: "transparent",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Chat sound picker */}
              <div
                className="flex flex-col gap-1.5"
                style={{ opacity: pending.chatSoundEnabled ? 1 : 0.4 }}
              >
                <div className="flex items-center gap-1.5">
                  <FiMessageSquare
                    size={12}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Som ao receber mensagem
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {SOUNDS.map((s) => {
                    const active = pending.chatSound === s;
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          pending.chatSoundEnabled
                            ? previewChatSound(s)
                            : undefined
                        }
                        disabled={!pending.chatSoundEnabled}
                        className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] cursor-pointer transition-all"
                        style={{
                          backgroundColor: active
                            ? "rgba(0,136,194,0.12)"
                            : "var(--color-bg-elevated)",
                          border: active
                            ? "1px solid rgba(0,136,194,0.35)"
                            : "1px solid var(--color-border)",
                          color: active
                            ? "var(--color-primary)"
                            : "var(--color-text-secondary)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: active
                                ? "var(--color-primary)"
                                : "var(--color-bg-base)",
                              border: active
                                ? "none"
                                : "1px solid var(--color-border)",
                            }}
                          >
                            {active ? (
                              <FiCheck size={10} color="white" />
                            ) : (
                              <FiMessageSquare
                                size={10}
                                style={{ color: "var(--color-text-muted)" }}
                              />
                            )}
                          </div>
                          <span className="text-xs font-medium">
                            {SOUND_LABELS[s]}
                          </span>
                        </div>
                        {active && (
                          <span
                            className="text-[10px] font-medium"
                            style={{
                              color: "var(--color-primary)",
                              opacity: 0.7,
                            }}
                          >
                            ▶ preview
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={saveChat}
                className="w-full py-2 rounded-[var(--radius-md)] text-xs font-semibold cursor-pointer transition-all"
                style={{
                  backgroundColor: chatSaved
                    ? "rgba(34,197,94,0.15)"
                    : "var(--color-primary)",
                  color: chatSaved ? "var(--color-success)" : "white",
                  border: chatSaved ? "1px solid rgba(34,197,94,0.35)" : "none",
                }}
              >
                {chatSaved ? "✓ Salvo!" : "Salvar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-full shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
        style={{
          width: 46,
          height: 46,
          backgroundColor: open
            ? "var(--color-primary)"
            : settings.enabled
              ? "var(--color-bg-surface)"
              : "var(--color-bg-elevated)",
          border: open
            ? "2px solid rgba(255,255,255,0.15)"
            : settings.enabled
              ? "2px solid rgba(0,136,194,0.4)"
              : "2px solid var(--color-border)",
          boxShadow: open
            ? "0 8px 24px rgba(0,136,194,0.4)"
            : settings.enabled
              ? "0 4px 16px rgba(0,136,194,0.25)"
              : "0 2px 8px rgba(0,0,0,0.2)",
          color: open
            ? "white"
            : settings.enabled
              ? "var(--color-primary)"
              : "var(--color-text-muted)",
        }}
        title="Configurações de som"
      >
        {settings.enabled ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
      </button>

      {/* Pulse ring when enabled and closed */}
      {settings.enabled && !open && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 46,
            height: 46,
            border: "2px solid rgba(0,136,194,0.35)",
            animation: "soundPulse 2.4s ease-out infinite",
          }}
        />
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes soundPanelIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes soundPulse {
          0%   { transform: scale(1);    opacity: 0.7; }
          70%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-primary);
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.1s;
        }
        input[type='range']::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        input[type='range']:disabled::-webkit-slider-thumb {
          background: var(--color-border);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
