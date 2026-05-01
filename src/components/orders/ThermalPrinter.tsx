"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  FiPrinter,
  FiZap,
  FiWifi,
  FiWifiOff,
  FiLoader,
  FiAlertTriangle,
} from "react-icons/fi";
import { Order } from "@/types";

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
  init: esc(0x40),
  alignCenter: esc(0x61, 0x01),
  alignLeft: esc(0x61, 0x00),
  bold: (on: boolean) => esc(0x45, on ? 1 : 0),
  doubleHeight: esc(0x21, 0x10),
  normal: esc(0x21, 0x00),
  feedAndCut: new Uint8Array([GS, 0x56, 0x00]),
  feed: (lines: number) => esc(0x64, lines),
  text: (str: string) => new TextEncoder().encode(str + "\n"),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrinterStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "printing"
  | "error";

// ── Vendor tables ─────────────────────────────────────────────────────────────

const PRINTER_VENDORS: Record<number, string> = {
  0x04b8: "Epson",
  0x0519: "Star Micronics",
  0x154f: "Bematech",
  0x1fc9: "Elgin",
  0x0dd4: "Citizen",
  0x0fe6: "Daruma",
  0x28e9: "Gprinter",
  0x0416: "Winbond",
  0x1504: "Sewoo",
  0x0525: "Woosim",
  0x20d1: "Diebold",
};

const NON_PRINTER_VENDORS: Record<number, string> = {
  0x0403: "adaptador USB-Serial (FTDI)",
  0x067b: "adaptador USB-Serial (Prolific PL2303)",
  0x10c4: "adaptador USB-Serial (Silicon Labs CP210x)",
  0x1a86: "adaptador USB-Serial (CH340/CH341)",
  0x0483: "dispositivo STMicroelectronics",
  0x2341: "Arduino",
  0x1d50: "dispositivo OpenMoko",
  0x0451: "dispositivo Texas Instruments",
  0x0bda: "adaptador Realtek",
  0x05ac: "dispositivo Apple",
  0x046d: "dispositivo Logitech",
  0x045e: "dispositivo Microsoft",
};

function resolvePortInfo(info: SerialPortInfo): {
  label: string;
  warning: string | null;
} {
  // No usbVendorId — likely a Bluetooth paired port or native COM
  if (!info.usbVendorId) {
    return {
      label: "Porta serial",
      warning:
        "Porta serial sem ID USB detectada (provável conexão Bluetooth). A impressão pode não funcionar corretamente — conecte a impressora via USB.",
    };
  }

  const vendorHex = info.usbVendorId
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  const productHex =
    info.usbProductId?.toString(16).toUpperCase().padStart(4, "0") ?? "????";
  const ids = `${vendorHex}:${productHex}`;

  const printerName = PRINTER_VENDORS[info.usbVendorId];
  if (printerName) {
    return { label: `${printerName} (${ids})`, warning: null };
  }

  const nonPrinterName = NON_PRINTER_VENDORS[info.usbVendorId];
  if (nonPrinterName) {
    return {
      label: `${nonPrinterName} (${ids})`,
      warning: `Este dispositivo parece ser um ${nonPrinterName}, não uma impressora térmica. A impressão pode não funcionar.`,
    };
  }

  return {
    label: `Dispositivo desconhecido (${ids})`,
    warning: `Dispositivo USB ${ids} não reconhecido. Verifique se é uma impressora térmica.`,
  };
}

// ── Ticket builder (export for future reuse) ──────────────────────────────────

export function buildOrderTicket(order: Order): Uint8Array {
  return concat(
    CMD.init,
    CMD.alignCenter,
    CMD.doubleHeight,
    CMD.bold(true),
    CMD.text(`Comanda #${order.orderNumber}`),
    CMD.normal,
    CMD.bold(false),
    CMD.feed(3),
    CMD.feedAndCut,
  );
}

// ── Core hook ─────────────────────────────────────────────────────────────────

function useThermalPrinterCore() {
  const portRef = useRef<SerialPort | null>(null);
  const printingRef = useRef(false);
  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [portLabel, setPortLabel] = useState<string | null>(null);
  const [portWarning, setPortWarning] = useState<string | null>(null);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;
  const isConnected = status === "connected" || status === "printing";

  const write = useCallback(async (data: Uint8Array): Promise<boolean> => {
    const port = portRef.current;
    if (!port?.writable) return false;
    try {
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      return true;
    } catch {
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setErrorMsg("Web Serial API não suportada. Use Chrome ou Edge.");
      setStatus("error");
      return;
    }
    try {
      setStatus("connecting");
      setErrorMsg(null);
      const nav = navigator as unknown as {
        serial: { requestPort: () => Promise<SerialPort> };
      };
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      const { label, warning } = resolvePortInfo(port.getInfo());
      setPortLabel(label);
      setPortWarning(warning);
      setStatus("connected");
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "NotFoundError") {
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
    setAutoPrint(false);
    setPortLabel(null);
    setPortWarning(null);
  }, []);

  const print = useCallback(
    async (data: Uint8Array) => {
      if (!portRef.current?.writable) {
        setErrorMsg("Impressora não conectada.");
        setStatus("error");
        return;
      }
      if (printingRef.current) return;
      printingRef.current = true;
      setStatus("printing");
      try {
        const ok = await write(data);
        if (!ok) throw new Error("Falha na escrita");
        setStatus("connected");
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "Erro ao imprimir");
        setStatus("error");
      } finally {
        printingRef.current = false;
      }
    },
    [write],
  );

  const printOrder = useCallback(
    async (order: Order) => {
      await print(buildOrderTicket(order));
    },
    [print],
  );

  const printHelloWorld = useCallback(async () => {
    await print(
      concat(
        CMD.init,
        CMD.alignCenter,
        CMD.doubleHeight,
        CMD.bold(true),
        CMD.text("Olá, Cine Drive-in!"),
        CMD.normal,
        CMD.bold(false),
        CMD.feed(1),
        CMD.alignLeft,
        CMD.text("Impressao de teste"),
        CMD.text("Web Serial API + Next.js"),
        CMD.feed(1),
        CMD.alignCenter,
        CMD.text("--------------------------------"),
        CMD.text("Impressora conectada com sucesso"),
        CMD.text("--------------------------------"),
        CMD.feed(5),
        CMD.feedAndCut,
      ),
    );
  }, [print]);

  return {
    status,
    errorMsg,
    isSupported,
    isConnected,
    autoPrint,
    setAutoPrint,
    portLabel,
    portWarning,
    connect,
    disconnect,
    print,
    printOrder,
    printHelloWorld,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface PrinterContextValue {
  status: PrinterStatus;
  errorMsg: string | null;
  isSupported: boolean;
  isConnected: boolean;
  autoPrint: boolean;
  setAutoPrint: (v: boolean) => void;
  portLabel: string | null;
  portWarning: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  print: (data: Uint8Array) => Promise<void>;
  printOrder: (order: Order) => Promise<void>;
  printHelloWorld: () => Promise<void>;
}

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const printer = useThermalPrinterCore();
  return (
    <PrinterContext.Provider value={printer}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error("usePrinter must be used inside <PrinterProvider>");
  return ctx;
}

// ── Auto-print hook (call once in OrdersPage) ─────────────────────────────────

export function useAutoPrint(orders: Order[]) {
  const { autoPrint, isConnected, printOrder } = usePrinter();
  const printedRef = useRef<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const baselineSetRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (autoPrint && isConnected) {
      if (baselineSetRef.current === null) {
        baselineSetRef.current = new Set(orders.map((o) => o.id));
      }
    } else {
      baselineSetRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, isConnected]);

  useEffect(() => {
    if (!autoPrint || !isConnected) return;

    for (const order of orders) {
      const isNew = !prevIdsRef.current.has(order.id);
      const notInBaseline = !baselineSetRef.current?.has(order.id);
      const notYetPrinted = !printedRef.current.has(order.id);

      if (isNew && notInBaseline && notYetPrinted) {
        printedRef.current.add(order.id);
        printOrder(order);
      }
    }

    prevIdsRef.current = new Set(orders.map((o) => o.id));
  }, [orders, autoPrint, isConnected, printOrder]);
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
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

// ── Chrome badge ──────────────────────────────────────────────────────────────

function ChromeBadge() {
  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
      style={{
        backgroundColor: "rgba(66,133,244,0.12)",
        color: "#4285F4",
        border: "1px solid rgba(66,133,244,0.25)",
      }}
      title="A impressora térmica requer Google Chrome ou Microsoft Edge"
    >
      Chrome / Edge
    </span>
  );
}

// ── ThermalPrinterBar — top strip ─────────────────────────────────────────────

export default function ThermalPrinterBar() {
  const {
    status,
    isConnected,
    isSupported,
    autoPrint,
    setAutoPrint,
    portLabel,
    portWarning,
    connect,
    disconnect,
    printHelloWorld,
  } = usePrinter();

  const cfg = STATUS_CFG[status];
  const isBusy = status === "connecting" || status === "printing";
  const hasWarning = !!portWarning;

  if (!isSupported) {
    return (
      <div
        className="flex items-center gap-2 px-4 sm:px-6 py-2 text-xs"
        style={{
          backgroundColor: "rgba(239,68,68,0.06)",
          borderBottom: "1px solid rgba(239,68,68,0.2)",
          color: "var(--color-error)",
        }}
      >
        <FiWifiOff size={13} />
        Impressora térmica requer Chrome ou Edge para funcionar
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Main bar */}
      <div
        className="flex items-center gap-2 flex-wrap px-4 sm:px-6 py-2"
        style={{
          borderBottom: hasWarning ? "none" : "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-elevated)",
        }}
      >
        {/* Status pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)]"
          style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
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
          <FiPrinter size={12} style={{ color: cfg.color, flexShrink: 0 }} />
          <span className="text-xs font-medium" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {portLabel && isConnected && (
            <span
              className="text-xs"
              style={{ color: cfg.color, opacity: 0.65 }}
            >
              · {portLabel}
            </span>
          )}
          {status === "printing" && (
            <FiLoader
              size={11}
              style={{ color: cfg.color, animation: "spin 1s linear infinite" }}
            />
          )}
        </div>

        {/* Connect / Disconnect */}
        <button
          onClick={isConnected ? disconnect : connect}
          disabled={isBusy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isConnected
              ? "rgba(239,68,68,0.1)"
              : "var(--color-bg-surface)",
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
              <FiWifiOff size={11} />
              Desconectar
            </>
          ) : (
            <>
              <FiWifi size={11} />
              {status === "connecting"
                ? "Conectando..."
                : "Conectar impressora"}
            </>
          )}
        </button>

        {/* Auto-print toggle */}
        {isConnected && (
          <button
            onClick={() => setAutoPrint(!autoPrint)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all hover:opacity-80"
            style={{
              backgroundColor: autoPrint
                ? "rgba(34,197,94,0.12)"
                : "var(--color-bg-surface)",
              color: autoPrint
                ? "var(--color-success)"
                : "var(--color-text-muted)",
              border: autoPrint
                ? "1px solid rgba(34,197,94,0.3)"
                : "1px solid var(--color-border)",
            }}
            title="Imprimir automaticamente novas comandas"
          >
            <span
              className="relative inline-flex items-center w-6 h-3.5 rounded-full flex-shrink-0 transition-colors"
              style={{
                backgroundColor: autoPrint
                  ? "var(--color-success)"
                  : "var(--color-border)",
              }}
            >
              <span
                className="absolute w-2.5 h-2.5 bg-white rounded-full shadow transition-transform"
                style={{
                  transform: autoPrint ? "translateX(12px)" : "translateX(2px)",
                }}
              />
            </span>
            Auto-imprimir
          </button>
        )}

        {/* Test print */}
        {isConnected && (
          <button
            onClick={printHelloWorld}
            disabled={status === "printing"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            <FiZap size={11} />
            Teste
          </button>
        )}

        {/* Chrome badge — always visible, pushed to the right */}
        <div className="ml-auto">
          <ChromeBadge />
        </div>
      </div>

      {/* Warning strip */}
      {hasWarning && (
        <div
          className="flex items-center gap-2 px-4 sm:px-6 py-1.5 text-xs"
          style={{
            backgroundColor: "rgba(245,158,11,0.08)",
            borderBottom: "1px solid rgba(245,158,11,0.2)",
            borderTop: "1px solid rgba(245,158,11,0.15)",
            color: "var(--color-warning)",
          }}
        >
          <FiAlertTriangle size={12} style={{ flexShrink: 0 }} />
          {portWarning}
        </div>
      )}
    </div>
  );
}

// ── PrintOrderButton — embed inside OrderCard ─────────────────────────────────

export function PrintOrderButton({ order }: { order: Order }) {
  const { isConnected, printOrder, status } = usePrinter();
  const [justPrinted, setJustPrinted] = useState(false);

  if (!isConnected) return null;

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    await printOrder(order);
    setJustPrinted(true);
    setTimeout(() => setJustPrinted(false), 2000);
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "printing"}
      className="p-1 rounded cursor-pointer transition-all hover:opacity-70 disabled:opacity-40"
      style={{
        color: justPrinted ? "var(--color-success)" : "var(--color-text-muted)",
      }}
      title={justPrinted ? "Impresso!" : "Imprimir comanda"}
    >
      <FiPrinter size={13} />
    </button>
  );
}
