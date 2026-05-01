"use client";

import { useState, useRef, useCallback } from "react";
import { FiPrinter, FiZap, FiWifi, FiWifiOff, FiLoader } from "react-icons/fi";

// ── ESC/POS helpers ───────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

function esc(...bytes: number[]): Uint8Array {
  return new Uint8Array([ESC, ...bytes]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

const CMD = {
  init: esc(0x40), // ESC @ — reset
  alignCenter: esc(0x61, 0x01), // ESC a 1
  alignLeft: esc(0x61, 0x00), // ESC a 0
  bold: (on: boolean) => esc(0x45, on ? 1 : 0), // ESC E
  doubleHeight: esc(0x21, 0x10), // ESC ! — double height
  normal: esc(0x21, 0x00), // ESC ! — normal
  feedAndCut: new Uint8Array([GS, 0x56, 0x00]), // GS V 0 — full cut
  feed: (lines: number) => esc(0x64, lines), // ESC d n
  text: (str: string) => new TextEncoder().encode(str + "\n"),
};

// ── Types ─────────────────────────────────────────────────────────────────────

type PrinterStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "printing"
  | "error";

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useThermalPrinter() {
  const portRef = useRef<SerialPort | null>(null);
  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  const connect = useCallback(async () => {
    if (!isSupported) {
      setErrorMsg("Web Serial API não suportada. Use Chrome ou Edge.");
      setStatus("error");
      return;
    }
    try {
      setStatus("connecting");
      setErrorMsg(null);
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setStatus("connected");
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "NotFoundError") {
        // User cancelled the picker
        setStatus("disconnected");
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Erro ao conectar");
        setStatus("error");
      }
    }
  }, [isSupported]);

  const disconnect = useCallback(async () => {
    try {
      await portRef.current?.close();
    } catch {}
    portRef.current = null;
    setStatus("disconnected");
    setErrorMsg(null);
  }, []);

  const print = useCallback(async (data: Uint8Array) => {
    const port = portRef.current;
    if (!port?.writable) {
      setErrorMsg("Impressora não conectada.");
      setStatus("error");
      return;
    }
    setStatus("printing");
    try {
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      setStatus("connected");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao imprimir");
      setStatus("error");
    }
  }, []);

  const printHelloWorld = useCallback(async () => {
    const data = concat(
      CMD.init,
      CMD.alignCenter,
      CMD.doubleHeight,
      CMD.bold(true),
      CMD.text("Hello, World!"),
      CMD.normal,
      CMD.bold(false),
      CMD.feed(1),
      CMD.alignLeft,
      CMD.text("Impressao de teste"),
      CMD.text("Web Serial API + Next.js"),
      CMD.feed(3),
      CMD.feedAndCut,
    );
    await print(data);
  }, [print]);

  return {
    status,
    errorMsg,
    isSupported,
    connect,
    disconnect,
    print,
    printHelloWorld,
  };
}

// ── UI Component ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PrinterStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  disconnected: {
    label: "Desconectada",
    color: "var(--color-text-muted)",
    bg: "var(--color-bg-elevated)",
    border: "var(--color-border)",
    dot: "var(--color-text-muted)",
  },
  connecting: {
    label: "Conectando...",
    color: "var(--color-warning)",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.3)",
    dot: "var(--color-warning)",
  },
  connected: {
    label: "Conectada",
    color: "var(--color-success)",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.3)",
    dot: "var(--color-success)",
  },
  printing: {
    label: "Imprimindo...",
    color: "var(--color-primary)",
    bg: "rgba(0,136,194,0.08)",
    border: "rgba(0,136,194,0.3)",
    dot: "var(--color-primary)",
  },
  error: {
    label: "Erro",
    color: "var(--color-error)",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.3)",
    dot: "var(--color-error)",
  },
};

export default function ThermalPrinterBar() {
  const {
    status,
    errorMsg,
    isSupported,
    connect,
    disconnect,
    printHelloWorld,
  } = useThermalPrinter();

  const cfg = STATUS_CONFIG[status];
  const isConnected = status === "connected" || status === "printing";
  const isBusy = status === "connecting" || status === "printing";

  if (!isSupported) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs"
        style={{
          backgroundColor: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "var(--color-error)",
        }}
      >
        <FiWifiOff size={13} />
        Impressora térmica requer Chrome ou Edge
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status pill */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)]"
        style={{
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
        }}
      >
        {/* Dot — pulses when active */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {(status === "connected" ||
            status === "printing" ||
            status === "connecting") && (
            <span
              className="absolute inline-flex h-full w-full rounded-full animate-ping"
              style={{ backgroundColor: cfg.dot, opacity: 0.5 }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: cfg.dot }}
          />
        </span>

        <FiPrinter size={13} style={{ color: cfg.color, flexShrink: 0 }} />

        <span className="text-xs font-medium" style={{ color: cfg.color }}>
          {cfg.label}
        </span>

        {status === "printing" && (
          <FiLoader
            size={12}
            style={{ color: cfg.color, animation: "spin 1s linear infinite" }}
          />
        )}
      </div>

      {/* Error tooltip */}
      {errorMsg && (
        <span
          className="text-xs px-2 py-1 rounded-[var(--radius-sm)]"
          style={{
            color: "var(--color-error)",
            backgroundColor: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={errorMsg}
        >
          {errorMsg}
        </span>
      )}

      {/* Connect / Disconnect */}
      <button
        onClick={isConnected ? disconnect : connect}
        disabled={isBusy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: isConnected
            ? "rgba(239,68,68,0.1)"
            : "var(--color-bg-elevated)",
          color: isConnected
            ? "var(--color-error)"
            : "var(--color-text-secondary)",
          border: isConnected
            ? "1px solid rgba(239,68,68,0.25)"
            : "1px solid var(--color-border)",
        }}
      >
        {isConnected ? (
          <>
            <FiWifiOff size={12} />
            Desconectar
          </>
        ) : (
          <>
            <FiWifi size={12} />
            {status === "connecting" ? "Conectando..." : "Conectar impressora"}
          </>
        )}
      </button>

      {/* Print test */}
      {isConnected && (
        <button
          onClick={printHelloWorld}
          disabled={status === "printing"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
          }}
        >
          <FiZap size={12} />
          {status === "printing" ? "Imprimindo..." : "Imprimir teste"}
        </button>
      )}
    </div>
  );
}
