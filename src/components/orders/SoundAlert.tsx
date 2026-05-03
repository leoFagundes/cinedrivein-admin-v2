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
} from "react-icons/fi";
import { Order } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SoundOption = "som1" | "som2" | "som3" | "som4" | "som5" | "som6";

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0–1
  sound: SoundOption;
}

const STORAGE_KEY = "cdi_sound_alert";

const SOUND_LABELS: Record<SoundOption, string> = {
  som1: "Som 1",
  som2: "Som 2",
  som3: "Som 3",
  som4: "Som 4",
  som5: "Som 5",
  som6: "Som 6",
};

const SOUNDS: SoundOption[] = ["som1", "som2", "som3", "som4", "som5", "som6"];

function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      return {
        enabled: parsed.enabled ?? true,
        volume: typeof parsed.volume === "number" ? parsed.volume : 0.7,
        sound: parsed.sound ?? "som1",
      };
    }
  } catch {}
  return { enabled: true, volume: 0.7, sound: "som1" };
}

function saveSettings(s: SoundSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

// ── Core hook ─────────────────────────────────────────────────────────────────

function useSoundAlertCore() {
  const [settings, setSettings] = useState<SoundSettings>(loadSettings);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Persist whenever settings change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Rebuild audio element when sound changes
  useEffect(() => {
    const audio = new Audio(`/music/${settings.sound}.mp3`);
    audio.volume = settings.volume;
    audioRef.current = audio;
  }, [settings.sound]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = settings.volume;
  }, [settings.volume]);

  const play = useCallback(() => {
    if (!settings.enabled || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [settings.enabled]);

  const update = useCallback((patch: Partial<SoundSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update, play };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface SoundAlertContextValue {
  settings: SoundSettings;
  update: (patch: Partial<SoundSettings>) => void;
  play: () => void;
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

// ── Auto-sound hook (call once, pass activeOrders) ────────────────────────────

export function useAutoSound(orders: Order[]) {
  const { play, settings } = useSoundAlert();
  const prevIdsRef = useRef<Set<string>>(new Set());
  const baselineRef = useRef<Set<string> | null>(null);

  // Set baseline on mount
  useEffect(() => {
    if (baselineRef.current === null) {
      baselineRef.current = new Set(orders.map((o) => o.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.enabled) {
      prevIdsRef.current = new Set(orders.map((o) => o.id));
      return;
    }

    for (const order of orders) {
      const isNew = !prevIdsRef.current.has(order.id);
      const notInBaseline = !baselineRef.current?.has(order.id);
      if (isNew && notInBaseline) {
        play();
        break; // one beep per batch
      }
    }

    prevIdsRef.current = new Set(orders.map((o) => o.id));
  }, [orders, settings.enabled, play]);
}

// ── Floating Button Component ─────────────────────────────────────────────────

export function SoundAlertButton() {
  const { settings, update, play } = useSoundAlert();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    update({ sound: s });
    setTimeout(() => play(), 60);
  }

  const volumePct = Math.round(settings.volume * 100);

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
            width: 260,
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

          <div className="flex flex-col gap-4 px-4 py-4">
            {/* Enable / disable toggle */}
            <div className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {settings.enabled ? "Som ativado" : "Som desativado"}
              </span>
              <button
                onClick={() => update({ enabled: !settings.enabled })}
                className="relative flex items-center cursor-pointer transition-all"
                style={{ width: 44, height: 24 }}
                title={settings.enabled ? "Desativar som" : "Ativar som"}
              >
                <span
                  className="absolute inset-0 rounded-full transition-colors"
                  style={{
                    backgroundColor: settings.enabled
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                  }}
                />
                <span
                  className="absolute w-4 h-4 bg-white rounded-full shadow transition-transform"
                  style={{
                    transform: settings.enabled
                      ? "translateX(24px)"
                      : "translateX(4px)",
                  }}
                />
              </button>
            </div>

            {/* Volume slider */}
            <div
              className="flex flex-col gap-2"
              style={{ opacity: settings.enabled ? 1 : 0.4 }}
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
                {/* Track background */}
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
                {/* Track fill */}
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
                  value={settings.volume}
                  disabled={!settings.enabled}
                  onChange={(e) =>
                    update({ volume: parseFloat(e.target.value) })
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
              style={{ opacity: settings.enabled ? 1 : 0.4 }}
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
                  Som do alerta
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {SOUNDS.map((s) => {
                  const active = settings.sound === s;
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        settings.enabled ? previewSound(s) : undefined
                      }
                      disabled={!settings.enabled}
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
          </div>
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
