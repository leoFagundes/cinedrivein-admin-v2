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
  FiChevronDown,
  FiCheck,
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

export type ConnectionMode = "serial" | "qztray";

// ── QZ Tray types ─────────────────────────────────────────────────────────────

// ── jsrsasign types ──────────────────────────────────────────────────────────

declare global {
  interface Window {
    KJUR?: {
      crypto: {
        Signature: new (opts: { alg: string }) => {
          init: (key: unknown) => void;
          updateString: (str: string) => void;
          sign: () => string;
        };
      };
    };
    KEYUTIL?: {
      getKey: (pem: string) => unknown;
    };
    hextob64: ((hex: string) => string) | undefined;
    qz?: {
      websocket: {
        connect: (opts?: {
          host?: string;
          port?: { secure: number[]; insecure: number[] };
        }) => Promise<void>;
        disconnect: () => Promise<void>;
        isActive: () => boolean;
      };
      printers: {
        find: (query?: string) => Promise<string | string[]>;
        getDefault: () => Promise<string>;
      };
      configs: {
        create: (printer: string, opts?: Record<string, unknown>) => unknown;
      };
      print: (config: unknown, data: unknown[]) => Promise<void>;
      security: {
        setCertificatePromise: (
          fn: (
            resolve: (v: string) => void,
            reject: (e: unknown) => void,
          ) => void,
        ) => void;
        setSignatureAlgorithm: (algorithm: string) => void;
        setSignaturePromise: (
          fn: (
            toSign: string,
          ) => (
            resolve: (v: string) => void,
            reject: (e: unknown) => void,
          ) => void,
        ) => void;
      };
    };
  }
}

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

// ── Ticket builder ────────────────────────────────────────────────────────────

const DIVIDER = "--------------------------------";

function fmt(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/** Right-aligns `right` so that `left + right` fills `width` chars total */
function rowLR(left: string, right: string, width = 32): string {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(spaces) + right;
}

export function buildOrderTicket(order: Order): Uint8Array {
  const parts: Uint8Array[] = [];

  const add = (...chunks: Uint8Array[]) => parts.push(...chunks);

  // ── Init ──────────────────────────────────────────────────────────────────
  add(CMD.init);

  // ── Header: VAGA (negrito, grande, centrado) ──────────────────────────────
  add(CMD.alignCenter, CMD.doubleHeight, CMD.bold(true));
  add(CMD.text(`VAGA ${order.spot}`));
  add(CMD.normal, CMD.bold(false));

  // ── Número da comanda + hora ───────────────────────────────────────────────
  add(CMD.alignCenter);
  const hora = order.createdAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  add(CMD.text(`Comanda #${order.orderNumber}  ${hora}`));
  add(CMD.text(DIVIDER));

  // ── Dados do cliente ───────────────────────────────────────────────────────
  add(CMD.alignLeft);
  add(CMD.bold(true), CMD.text("CLIENTE"), CMD.bold(false));
  add(CMD.text(`Nome:  ${order.username}`));
  if (order.phone) {
    add(CMD.text(`Tel:   ${order.phone}`));
  }
  add(CMD.alignCenter, CMD.text(DIVIDER), CMD.alignLeft);

  // ── Itens ──────────────────────────────────────────────────────────────────
  add(CMD.bold(true), CMD.text("ITENS"), CMD.bold(false));

  for (const item of order.items) {
    const qty = item.quantity ?? 1;
    const total = item.value * qty;

    // Linha principal: "2x Nome item          R$ 20,00"
    add(CMD.bold(true));
    add(CMD.text(rowLR(`${qty}x ${item.name}`, fmt(total))));
    add(CMD.bold(false));

    // Preço unitário se quantidade > 1
    if (qty > 1) {
      add(CMD.text(`   unit: ${fmt(item.value)}`));
    }

    // Adicionais
    const grupos: Array<[string[] | undefined, string]> = [
      [item.additionals, ""],
      [item.additionals_sauce, "molho"],
      [item.additionals_drink, "bebida"],
      [item.additionals_sweet, "doce"],
    ];
    for (const [lista, label] of grupos) {
      if (!lista?.length) continue;
      for (const a of lista) {
        add(CMD.text(`   + ${a}${label ? ` (${label})` : ""}`));
      }
    }

    // Observação
    if (item.observation) {
      add(CMD.text(`   Obs: ${item.observation}`));
    }
  }

  add(CMD.alignCenter, CMD.text(DIVIDER), CMD.alignLeft);

  // ── Totais ─────────────────────────────────────────────────────────────────
  add(CMD.text(rowLR("Subtotal:", fmt(order.subtotal))));
  add(CMD.text(rowLR("Taxa de servico:", fmt(order.serviceFee))));
  add(CMD.bold(true));
  add(CMD.text(rowLR("TOTAL:", fmt(order.subtotal + order.serviceFee))));
  add(CMD.bold(false));

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  add(CMD.alignCenter);
  add(CMD.text(DIVIDER));
  add(CMD.text("Cine Drive-in"));
  add(CMD.feed(4));
  add(CMD.feedAndCut);

  return concat(...parts);
}

/** Converts a Uint8Array of ESC/POS bytes to a base64 string for QZ Tray */
function escposToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ── QZ Tray loader ────────────────────────────────────────────────────────────

function loadScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

async function loadQzScript(): Promise<void> {
  await loadScript(
    "jsrsasign-script",
    "https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/11.1.0/jsrsasign-all-min.js",
  );
  await loadScript(
    "qz-tray-script",
    "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js",
  );
}

// ── Core hook ─────────────────────────────────────────────────────────────────

function useThermalPrinterCore() {
  // Shared state
  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [connectionMode, setConnectionMode] =
    useState<ConnectionMode>("serial");

  // Serial state
  const portRef = useRef<SerialPort | null>(null);
  const printingRef = useRef(false);
  const [portLabel, setPortLabel] = useState<string | null>(null);
  const [portWarning, setPortWarning] = useState<string | null>(null);

  // QZ Tray state
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [selectedQzPrinter, setSelectedQzPrinter] = useState<string | null>(
    null,
  );
  const [showPrinterDropdown, setShowPrinterDropdown] = useState(false);

  const isSerialSupported =
    typeof navigator !== "undefined" && "serial" in navigator;
  const isConnected = status === "connected" || status === "printing";

  // ── Serial write ────────────────────────────────────────────────────────────

  const serialWrite = useCallback(
    async (data: Uint8Array): Promise<boolean> => {
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
    },
    [],
  );

  // ── QZ Tray write ───────────────────────────────────────────────────────────

  const qzWrite = useCallback(
    async (data: Uint8Array): Promise<boolean> => {
      if (!window.qz || !selectedQzPrinter) return false;
      try {
        const config = window.qz.configs.create(selectedQzPrinter);
        await window.qz.print(config, [
          { type: "raw", format: "base64", data: escposToBase64(data) },
        ]);
        return true;
      } catch {
        return false;
      }
    },
    [selectedQzPrinter],
  );

  // ── Connect serial ──────────────────────────────────────────────────────────

  const connectSerial = useCallback(async () => {
    if (!isSerialSupported) {
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
  }, [isSerialSupported]);

  // ── Connect QZ Tray ─────────────────────────────────────────────────────────

  const connectQzTray = useCallback(async () => {
    try {
      setStatus("connecting");
      setErrorMsg(null);

      await loadQzScript();

      if (!window.qz) throw new Error("QZ Tray não carregou corretamente.");

      // Configure security — assinatura client-side com jsrsasign
      // Lê o certificado público (digital-certificate.txt) da pasta public/qz/
      window.qz.security.setCertificatePromise(
        (resolve: (v: string) => void, reject: (e: unknown) => void) => {
          fetch("/qz/digital-certificate.txt", { cache: "no-store" })
            .then((r) =>
              r.ok
                ? r.text()
                : Promise.reject("Falha ao carregar certificado QZ"),
            )
            .then(resolve)
            .catch(reject);
        },
      );

      window.qz.security.setSignatureAlgorithm("SHA512");

      // Assina usando a chave privada embutida via jsrsasign (100% client-side)
      window.qz.security.setSignaturePromise((toSign: string) => {
        return (resolve: (v: string) => void, reject: (e: unknown) => void) => {
          try {
            // Lê a chave privada do arquivo público (ok para uso local/intranet)
            fetch("/qz/private-key.pem", { cache: "no-store" })
              .then((r) =>
                r.ok
                  ? r.text()
                  : Promise.reject("Falha ao carregar chave privada"),
              )
              .then((pemKey) => {
                if (!window.KEYUTIL || !window.KJUR || !window.hextob64) {
                  throw new Error("jsrsasign não carregou corretamente");
                }
                const privateKey = window.KEYUTIL.getKey(pemKey);
                const sig = new window.KJUR.crypto.Signature({
                  alg: "SHA512withRSA",
                });
                sig.init(privateKey);
                sig.updateString(toSign);
                const hex = sig.sign();
                resolve(window.hextob64(hex));
              })
              .catch(reject);
          } catch (e) {
            reject(e);
          }
        };
      });

      if (!window.qz.websocket.isActive()) {
        await window.qz.websocket.connect();
      }

      const raw = await window.qz.printers.find();
      const list: string[] = Array.isArray(raw) ? raw : [raw];
      setQzPrinters(list);

      // Auto-select first or previously selected
      if (list.length > 0) {
        setSelectedQzPrinter((prev) =>
          prev && list.includes(prev) ? prev : list[0],
        );
      }

      setPortLabel("QZ Tray");
      setPortWarning(null);
      setStatus("connected");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Erro ao conectar ao QZ Tray";
      const isNotRunning =
        msg.toLowerCase().includes("unable to establish") ||
        msg.toLowerCase().includes("connection refused") ||
        msg.toLowerCase().includes("websocket");
      setErrorMsg(
        isNotRunning
          ? "QZ Tray não está em execução. Inicie o aplicativo QZ Tray e tente novamente."
          : msg,
      );
      setStatus("error");
    }
  }, []);

  // ── Connect (unified) ───────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (connectionMode === "qztray") {
      await connectQzTray();
    } else {
      await connectSerial();
    }
  }, [connectionMode, connectQzTray, connectSerial]);

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (connectionMode === "qztray") {
      try {
        await window.qz?.websocket.disconnect();
      } catch {}
      setQzPrinters([]);
    } else {
      try {
        await portRef.current?.close();
      } catch {}
      portRef.current = null;
    }
    setStatus("disconnected");
    setErrorMsg(null);
    setAutoPrint(false);
    setPortLabel(null);
    setPortWarning(null);
  }, [connectionMode]);

  // ── Print ───────────────────────────────────────────────────────────────────

  const print = useCallback(
    async (data: Uint8Array) => {
      if (printingRef.current) return;
      printingRef.current = true;
      setStatus("printing");
      try {
        let ok: boolean;
        if (connectionMode === "qztray") {
          if (!selectedQzPrinter)
            throw new Error("Nenhuma impressora selecionada.");
          ok = await qzWrite(data);
        } else {
          if (!portRef.current?.writable)
            throw new Error("Impressora não conectada.");
          ok = await serialWrite(data);
        }
        if (!ok) throw new Error("Falha na escrita");
        setStatus("connected");
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "Erro ao imprimir");
        setStatus("error");
      } finally {
        printingRef.current = false;
      }
    },
    [connectionMode, selectedQzPrinter, qzWrite, serialWrite],
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
    isSerialSupported,
    isConnected,
    autoPrint,
    setAutoPrint,
    portLabel,
    portWarning,
    connectionMode,
    setConnectionMode,
    qzPrinters,
    selectedQzPrinter,
    setSelectedQzPrinter,
    showPrinterDropdown,
    setShowPrinterDropdown,
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
  isSerialSupported: boolean;
  isConnected: boolean;
  autoPrint: boolean;
  setAutoPrint: (v: boolean) => void;
  portLabel: string | null;
  portWarning: string | null;
  connectionMode: ConnectionMode;
  setConnectionMode: (mode: ConnectionMode) => void;
  qzPrinters: string[];
  selectedQzPrinter: string | null;
  setSelectedQzPrinter: (p: string) => void;
  showPrinterDropdown: boolean;
  setShowPrinterDropdown: (v: boolean) => void;
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

// ── Auto-print hook ───────────────────────────────────────────────────────────

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

// ── Mode selector ─────────────────────────────────────────────────────────────

function ModeSelector() {
  const { connectionMode, setConnectionMode, isConnected, status } =
    usePrinter();
  const isBusy = status === "connecting" || status === "printing";

  if (isConnected || isBusy) return null;

  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius-md)] p-0.5"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {(["serial", "qztray"] as ConnectionMode[]).map((mode) => {
        const active = connectionMode === mode;
        return (
          <button
            key={mode}
            onClick={() => setConnectionMode(mode)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all"
            style={{
              backgroundColor: active
                ? "var(--color-bg-elevated)"
                : "transparent",
              color: active
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
              border: active
                ? "1px solid var(--color-border)"
                : "1px solid transparent",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {mode === "serial" ? (
              <>
                <FiWifi size={10} />
                USB Serial
              </>
            ) : (
              <>
                <FiPrinter size={10} />
                QZ Tray
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── QZ Printer selector ───────────────────────────────────────────────────────

function QzPrinterSelector() {
  const {
    isConnected,
    connectionMode,
    qzPrinters,
    selectedQzPrinter,
    setSelectedQzPrinter,
    showPrinterDropdown,
    setShowPrinterDropdown,
    status,
  } = usePrinter();

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowPrinterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowPrinterDropdown]);

  if (!isConnected || connectionMode !== "qztray" || qzPrinters.length === 0)
    return null;

  const isBusy = status === "printing";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowPrinterDropdown(!showPrinterDropdown)}
        disabled={isBusy}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border)",
          maxWidth: "200px",
        }}
        title="Selecionar impressora"
      >
        <FiPrinter size={11} style={{ flexShrink: 0 }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "140px",
          }}
        >
          {selectedQzPrinter ?? "Selecionar impressora"}
        </span>
        <FiChevronDown
          size={10}
          style={{
            flexShrink: 0,
            transform: showPrinterDropdown ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {showPrinterDropdown && (
        <div
          className="absolute top-full left-0 mt-1 rounded-[var(--radius-md)] overflow-hidden z-50"
          style={{
            minWidth: "200px",
            maxWidth: "280px",
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div
            className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-text-muted)" }}
          >
            Impressoras disponíveis
          </div>
          {qzPrinters.map((printer) => {
            const selected = printer === selectedQzPrinter;
            return (
              <button
                key={printer}
                onClick={() => {
                  setSelectedQzPrinter(printer);
                  setShowPrinterDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors hover:opacity-80"
                style={{
                  backgroundColor: selected
                    ? "rgba(0,136,194,0.08)"
                    : "transparent",
                  color: selected
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                <FiCheck
                  size={11}
                  style={{
                    flexShrink: 0,
                    opacity: selected ? 1 : 0,
                    color: "var(--color-primary)",
                  }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {printer}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

// ── ThermalPrinterBar ─────────────────────────────────────────────────────────

export default function ThermalPrinterBar() {
  const {
    status,
    isConnected,
    isSerialSupported,
    connectionMode,
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

  if (!isSerialSupported && connectionMode === "serial") {
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
        Impressora térmica via USB Serial requer Chrome ou Edge. Use QZ Tray
        para outros navegadores.
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
        {/* Mode selector — only when disconnected */}
        <ModeSelector />

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

        {/* QZ Printer selector */}
        <QzPrinterSelector />

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
                : connectionMode === "qztray"
                  ? "Conectar via QZ Tray"
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

        {/* Chrome badge */}
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

// ── PrintOrderButton ──────────────────────────────────────────────────────────

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
