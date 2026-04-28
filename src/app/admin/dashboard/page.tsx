"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FiToggleLeft,
  FiToggleRight,
  FiClock,
  FiSave,
  FiCalendar,
  FiAlertTriangle,
  FiArchive,
  FiTrendingUp,
  FiShoppingBag,
  FiDollarSign,
  FiPrinter,
  FiX,
  FiChevronDown,
  FiTrash2,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/access";
import { log } from "@/lib/logger";
import { Order, DailyStats } from "@/types";
import { parseOrder } from "@/contexts/OrdersContext";

// ── Constants ──────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  primary: "#0088c2",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  purple: "#a855f7",
  teal: "#14b8a6",
  border: "#2a2f42",
  text: "#525870",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--color-bg-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-text-primary)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--color-text-secondary)" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function fmtCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// Orders before 2 AM belong to the previous operational day (late-night shift)
function getOperationalDate(createdAt: Date): string {
  const d = new Date(createdAt);
  if (d.getHours() < 2) d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Operational day: 02:00 on selected date → 01:59:59 on the next calendar day
function operationalDayStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 2, 0, 0, 0);
}

function operationalDayEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 1, 59, 59, 999);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = "var(--color-primary)",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-[var(--radius-lg)]"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
        <p
          className="text-lg font-bold leading-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p
          className="font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ChartCard({
  title,
  range,
  onRangeChange,
  onClearClick,
  count,
  children,
}: {
  title: string;
  range: { from: string; to: string };
  onRangeChange: (r: { from: string; to: string }) => void;
  onClearClick?: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex flex-col gap-2.5 px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <p
            className="font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </p>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {count} dia{count !== 1 ? "s" : ""}
              </span>
            )}
            {onClearClick && (
              <button
                onClick={onClearClick}
                className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
                style={{ color: "var(--color-error)" }}
                title="Zerar dados deste gráfico"
              >
                <FiTrash2 size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={range.from}
            onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
            className="h-7 px-2 text-xs rounded-[var(--radius-sm)] outline-none cursor-pointer"
            style={{
              backgroundColor: range.from
                ? "var(--color-primary-light)"
                : "var(--color-bg-elevated)",
              border: `1px solid ${range.from ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
              color: range.from
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
            }}
          />
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            até
          </span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
            className="h-7 px-2 text-xs rounded-[var(--radius-sm)] outline-none cursor-pointer"
            style={{
              backgroundColor: range.to
                ? "var(--color-primary-light)"
                : "var(--color-bg-elevated)",
              border: `1px solid ${range.to ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
              color: range.to
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
            }}
          />
          {(range.from || range.to) && (
            <button
              onClick={() => onRangeChange({ from: "", to: "" })}
              className="flex items-center gap-1 text-xs cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              <FiX size={11} />
              Limpar
            </button>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { appUser, loading: authLoading } = useAuth();
  const { activeOrders } = useOrders();
  const { success, error: toastError, info } = useToast();

  // ── Store control ──
  const [isOpen, setIsOpen] = useState(false);
  const [openingTime, setOpeningTime] = useState("18:00");
  const [closingTime, setClosingTime] = useState("23:00");
  const [togglingStore, setTogglingStore] = useState(false);
  const [savingTimes, setSavingTimes] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ── Report ──
  const [reportDate, setReportDate] = useState("");
  const [reportOrders, setReportOrders] = useState<Order[]>([]);
  const [archivedStats, setArchivedStats] = useState<DailyStats | null>(null);
  const [reportSource, setReportSource] = useState<"live" | "archived" | null>(
    null,
  );
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(true);

  // ── Charts ──
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Close day ──
  const [archivableCount, setArchivableCount] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingDay, setClosingDay] = useState(false);

  // Chart date ranges
  const [revenueRange, setRevenueRange] = useState({ from: "", to: "" });
  const [ordersRange, setOrdersRange] = useState({ from: "", to: "" });
  const [topItemsRange, setTopItemsRange] = useState({ from: "", to: "" });
  const [paymentRange, setPaymentRange] = useState({ from: "", to: "" });

  // Clear chart data modal
  const [clearModal, setClearModal] = useState<{
    label: string;
    range: { from: string; to: string };
  } | null>(null);
  const [clearing, setClearing] = useState(false);

  const configLoaded = useRef(false);

  // Initialize report date to today (deferred to avoid render-phase impurity)
  useEffect(() => {
    const id = setTimeout(() => setReportDate(todayStr()), 0);
    return () => clearTimeout(id);
  }, []);

  // Load storeConfig
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "storeConfig", "main"));
        if (snap.exists()) {
          const d = snap.data();
          setIsOpen(d.isOpen ?? false);
          setOpeningTime(d.openingTime ?? "18:00");
          setClosingTime(d.closingTime ?? "23:00");
        }
      } finally {
        setLoadingConfig(false);
        configLoaded.current = true;
      }
    }
    load();
  }, []);

  // Load dailyStats for charts (last 30 days)
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "dailyStats"),
            orderBy("date", "asc"),
            limit(30),
          ),
        );
        setStats(
          snap.docs.map((d) => ({
            id: d.id,
            date: d.data().date as string,
            totalOrders: d.data().totalOrders ?? 0,
            finishedOrders: d.data().finishedOrders ?? 0,
            canceledOrders: d.data().canceledOrders ?? 0,
            revenue: d.data().revenue ?? {
              total: 0,
              subtotal: 0,
              serviceFee: 0,
              money: 0,
              pix: 0,
              credit: 0,
              debit: 0,
              discount: 0,
            },
            topItems: d.data().topItems ?? [],
            createdAt:
              (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
          })),
        );
      } finally {
        setLoadingStats(false);
      }
    }
    load();
  }, []);

  // Count archivable orders
  useEffect(() => {
    async function count() {
      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("status", "in", ["finished", "canceled"]),
        ),
      );
      setArchivableCount(snap.size);
    }
    count();
  }, [closingDay]);

  // Load report — archived stats take priority over live orders
  useEffect(() => {
    if (!reportDate) return;
    async function load() {
      setLoadingReport(true);
      setReportOrders([]);
      setArchivedStats(null);
      setReportSource(null);
      try {
        // 1. Check if this day was already archived in dailyStats
        const statsSnap = await getDoc(doc(db, "dailyStats", reportDate));
        if (statsSnap.exists()) {
          const data = statsSnap.data();
          setArchivedStats({
            id: statsSnap.id,
            date: data.date as string,
            totalOrders: (data.totalOrders as number) ?? 0,
            finishedOrders: (data.finishedOrders as number) ?? 0,
            canceledOrders: (data.canceledOrders as number) ?? 0,
            revenue: (data.revenue as DailyStats["revenue"]) ?? {
              total: 0,
              subtotal: 0,
              serviceFee: 0,
              money: 0,
              pix: 0,
              credit: 0,
              debit: 0,
              discount: 0,
            },
            topItems: (data.topItems as DailyStats["topItems"]) ?? [],
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
          });
          setReportSource("archived");
          return;
        }
        // 2. No archive — query live finished orders for the operational day
        const snap = await getDocs(
          query(collection(db, "orders"), where("status", "==", "finished")),
        );
        const start = operationalDayStart(reportDate);
        const end = operationalDayEnd(reportDate);
        const filtered = snap.docs
          .map((d) => parseOrder(d.id, d.data() as Record<string, unknown>))
          .filter((o) => o.createdAt >= start && o.createdAt <= end);
        setReportOrders(filtered);
        setReportSource("live");
      } finally {
        setLoadingReport(false);
      }
    }
    load();
  }, [reportDate]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleToggleStore() {
    setTogglingStore(true);
    try {
      const newVal = !isOpen;
      await setDoc(doc(db, "storeConfig", "main"), { isOpen: newVal }, { merge: true });
      setIsOpen(newVal);
      log({
        action: newVal ? "Lanchonete aberta" : "Lanchonete fechada",
        category: "site",
        description: `Status da lanchonete alterado para ${newVal ? "aberto" : "fechado"}`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
        changes: [{ field: "isOpen", from: String(!newVal), to: String(newVal) }],
      });
      success(
        newVal ? "Lanchonete aberta" : "Lanchonete fechada",
        newVal
          ? "Pedidos ativados para o público."
          : "Pedidos desativados para o público.",
      );
    } catch {
      toastError("Erro", "Não foi possível alterar o status.");
    } finally {
      setTogglingStore(false);
    }
  }

  async function handleSaveTimes() {
    setSavingTimes(true);
    try {
      await setDoc(doc(db, "storeConfig", "main"), { openingTime, closingTime }, { merge: true });
      log({
        action: "Horários atualizados",
        category: "site",
        description: `Horário de funcionamento: ${openingTime} – ${closingTime}`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
        changes: [
          { field: "openingTime", from: null, to: openingTime },
          { field: "closingTime", from: null, to: closingTime },
        ],
      });
      success("Horários salvos", "Horários de funcionamento atualizados.");
    } catch {
      toastError("Erro", "Não foi possível salvar os horários.");
    } finally {
      setSavingTimes(false);
    }
  }

  async function handleCloseDay() {
    if (!appUser) return;
    setClosingDay(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("status", "in", ["finished", "canceled"]),
        ),
      );
      if (snap.empty) {
        info("Nada a arquivar", "Não há pedidos finalizados ou cancelados.");
        setShowCloseModal(false);
        setClosingDay(false);
        return;
      }

      const orders = snap.docs.map((d) =>
        parseOrder(d.id, d.data() as Record<string, unknown>),
      );

      // Group by operational date (orders before 2 AM count as previous day)
      const byDate: Record<string, typeof orders> = {};
      orders.forEach((o) => {
        const dateKey = getOperationalDate(o.createdAt);
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(o);
      });

      // Create/merge dailyStats per date
      for (const [dateKey, dayOrders] of Object.entries(byDate)) {
        const finished = dayOrders.filter((o) => o.status === "finished");
        const canceled = dayOrders.filter((o) => o.status === "canceled");

        const revenue = finished.reduce(
          (acc, o) => ({
            total: acc.total + (o.total || 0),
            subtotal: acc.subtotal + (o.subtotal || 0),
            serviceFee: acc.serviceFee + (o.serviceFee || 0),
            money: acc.money + (o.payment?.money || 0),
            pix: acc.pix + (o.payment?.pix || 0),
            credit: acc.credit + (o.payment?.credit || 0),
            debit: acc.debit + (o.payment?.debit || 0),
            discount: acc.discount + (o.discount || 0),
          }),
          {
            total: 0,
            subtotal: 0,
            serviceFee: 0,
            money: 0,
            pix: 0,
            credit: 0,
            debit: 0,
            discount: 0,
          },
        );

        const itemMap: Record<
          string,
          { codItem: string; name: string; quantity: number }
        > = {};
        finished.forEach((o) => {
          o.items.forEach((item) => {
            const key = item.itemId || item.name;
            if (itemMap[key]) {
              itemMap[key].quantity++;
            } else {
              itemMap[key] = {
                codItem: item.codItem,
                name: item.name,
                quantity: 1,
              };
            }
          });
        });
        const topItems = Object.values(itemMap).sort(
          (a, b) => b.quantity - a.quantity,
        );

        await setDoc(
          doc(db, "dailyStats", dateKey),
          {
            date: dateKey,
            totalOrders: dayOrders.length,
            finishedOrders: finished.length,
            canceledOrders: canceled.length,
            revenue,
            topItems,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      // Delete archived orders in batches of 500
      const refs = snap.docs.map((d) => d.ref);
      for (let i = 0; i < refs.length; i += 500) {
        const batch = writeBatch(db);
        refs.slice(i, i + 500).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      // Reset order number counter so next day starts from #1
      await setDoc(doc(db, "counters", "orders"), { last: 0 });

      // Refresh stats
      const statsSnap = await getDocs(
        query(collection(db, "dailyStats"), orderBy("date", "asc"), limit(30)),
      );
      setStats(
        statsSnap.docs.map((d) => ({
          id: d.id,
          date: d.data().date as string,
          totalOrders: d.data().totalOrders ?? 0,
          finishedOrders: d.data().finishedOrders ?? 0,
          canceledOrders: d.data().canceledOrders ?? 0,
          revenue: d.data().revenue ?? {
            total: 0,
            subtotal: 0,
            serviceFee: 0,
            money: 0,
            pix: 0,
            credit: 0,
            debit: 0,
            discount: 0,
          },
          topItems: d.data().topItems ?? [],
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        })),
      );

      log({
        action: "Expediente fechado",
        category: "orders",
        description: `${snap.size} pedido${snap.size !== 1 ? "s" : ""} arquivado${snap.size !== 1 ? "s" : ""} em ${Object.keys(byDate).length} dia${Object.keys(byDate).length !== 1 ? "s" : ""}`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
        changes: [
          { field: "pedidos_arquivados", from: null, to: String(snap.size) },
          { field: "contador_reiniciado", from: null, to: "0" },
        ],
      });
      success(
        "Expediente fechado!",
        `${snap.size} pedido${snap.size !== 1 ? "s" : ""} arquivado${snap.size !== 1 ? "s" : ""} com sucesso.`,
      );
      setShowCloseModal(false);
      setArchivableCount(0);
    } catch (err) {
      console.error(err);
      toastError(
        "Erro",
        "Não foi possível fechar o expediente. Tente novamente.",
      );
    } finally {
      setClosingDay(false);
    }
  }

  // ── Computed report values ─────────────────────────────────────────────────

  const hasReportData = archivedStats != null || reportOrders.length > 0;

  const reportRevenue = archivedStats
    ? {
        money: archivedStats.revenue.money,
        pix: archivedStats.revenue.pix,
        credit: archivedStats.revenue.credit,
        debit: archivedStats.revenue.debit,
        subtotal: archivedStats.revenue.subtotal,
        serviceFee: archivedStats.revenue.serviceFee,
        total: archivedStats.revenue.total,
      }
    : reportOrders.reduce(
        (acc, o) => ({
          money: acc.money + (o.payment?.money || 0),
          pix: acc.pix + (o.payment?.pix || 0),
          credit: acc.credit + (o.payment?.credit || 0),
          debit: acc.debit + (o.payment?.debit || 0),
          subtotal: acc.subtotal + o.subtotal,
          serviceFee: acc.serviceFee + o.serviceFee,
          total: acc.total + o.total,
        }),
        {
          money: 0,
          pix: 0,
          credit: 0,
          debit: 0,
          subtotal: 0,
          serviceFee: 0,
          total: 0,
        },
      );

  const reportItems: Array<{
    codItem: string;
    name: string;
    quantity: number;
  }> = archivedStats
    ? archivedStats.topItems
    : (() => {
        const map: Record<
          string,
          { codItem: string; name: string; quantity: number }
        > = {};
        reportOrders.forEach((o) => {
          o.items.forEach((item) => {
            const key = item.itemId || item.name;
            if (map[key]) map[key].quantity++;
            else
              map[key] = {
                codItem: item.codItem,
                name: item.name,
                quantity: 1,
              };
          });
        });
        return Object.values(map).sort((a, b) => b.quantity - a.quantity);
      })();

  // ── Chart helpers ──────────────────────────────────────────────────────────

  function filterStats(range: { from: string; to: string }) {
    return stats.filter((s) => {
      if (range.from && s.date < range.from) return false;
      if (range.to && s.date > range.to) return false;
      return true;
    });
  }

  async function handleClearStats(range: { from: string; to: string }) {
    setClearing(true);
    try {
      const snap = await getDocs(
        query(collection(db, "dailyStats"), orderBy("date")),
      );
      const toDelete = snap.docs.filter((d) => {
        const date = d.data().date as string;
        if (range.from && date < range.from) return false;
        if (range.to && date > range.to) return false;
        return true;
      });
      if (toDelete.length === 0) {
        info("Nada a zerar", "Nenhum dado no período selecionado.");
        setClearModal(null);
        setClearing(false);
        return;
      }
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      setStats((prev) =>
        prev.filter((s) => {
          if (range.from && s.date < range.from) return true;
          if (range.to && s.date > range.to) return true;
          return false;
        }),
      );
      log({
        action: "Estatísticas zeradas",
        category: "orders",
        description: `${toDelete.length} dia${toDelete.length !== 1 ? "s" : ""} de estatísticas removido${toDelete.length !== 1 ? "s" : ""}${range.from || range.to ? ` (${range.from || "início"} → ${range.to || "fim"})` : ""}`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
        changes: [{ field: "dailyStats_deletados", from: null, to: String(toDelete.length) }],
      });
      success(
        "Dados zerados",
        `${toDelete.length} dia${toDelete.length !== 1 ? "s" : ""} removido${toDelete.length !== 1 ? "s" : ""}.`,
      );
      setClearModal(null);
    } catch {
      toastError("Erro", "Não foi possível zerar os dados.");
    } finally {
      setClearing(false);
    }
  }

  // ── Chart data (per-chart filtered) ────────────────────────────────────────

  const revenueStats = filterStats(revenueRange);
  const revenueData = revenueStats.map((s) => ({
    date: fmtDate(s.date),
    Total: +s.revenue.total.toFixed(2),
    Subtotal: +s.revenue.subtotal.toFixed(2),
  }));

  const ordersStats = filterStats(ordersRange);
  const ordersData = ordersStats.map((s) => ({
    date: fmtDate(s.date),
    Finalizados: s.finishedOrders,
    Cancelados: s.canceledOrders,
  }));

  const topItemsStats = filterStats(topItemsRange);
  const topItemsAgg: Record<
    string,
    { name: string; codItem: string; total: number }
  > = {};
  topItemsStats
    .flatMap((s) => s.topItems)
    .forEach((item) => {
      const key = item.codItem || item.name;
      if (topItemsAgg[key]) topItemsAgg[key].total += item.quantity;
      else
        topItemsAgg[key] = {
          name: item.name,
          codItem: item.codItem,
          total: item.quantity,
        };
    });
  const topItemsData = Object.values(topItemsAgg)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((i) => ({ name: `${i.name} (${i.codItem})`, value: i.total }));

  const paymentStats = filterStats(paymentRange);
  const paymentData = paymentStats.reduce(
    (acc, s) => ({
      Dinheiro: acc.Dinheiro + s.revenue.money,
      Pix: acc.Pix + s.revenue.pix,
      Crédito: acc.Crédito + s.revenue.credit,
      Débito: acc.Débito + s.revenue.debit,
    }),
    { Dinheiro: 0, Pix: 0, Crédito: 0, Débito: 0 },
  );
  const paymentPieData = Object.entries(paymentData)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  const PIE_COLORS = [
    CHART_COLORS.success,
    CHART_COLORS.primary,
    CHART_COLORS.purple,
    CHART_COLORS.warning,
  ];

  const todayRevenue = activeOrders.reduce(
    (s, o) => s + o.subtotal + o.serviceFee,
    0,
  );

  if (authLoading) return null;

  const canViewDashboard = can(appUser, "view_dashboard");
  const canManageStore = can(appUser, "manage_store");
  const canGenerateReport = can(appUser, "generate_report");
  const canDeleteChartData = can(appUser, "delete_chart_data");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Header */}
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Dashboard
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Visão geral da operação.
        </p>
      </div>

      {/* Row 1: Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Pedidos ativos"
          value={String(activeOrders.length)}
          icon={<FiShoppingBag size={18} />}
          color={CHART_COLORS.primary}
        />
        <StatCard
          label="Faturamento hoje"
          value={fmtCurrency(todayRevenue)}
          icon={<FiDollarSign size={18} />}
          color={CHART_COLORS.success}
        />
        <StatCard
          label="Dias registrados"
          value={String(stats.length)}
          icon={<FiArchive size={18} />}
          color={CHART_COLORS.purple}
        />
        <StatCard
          label="Para arquivar"
          value={String(archivableCount)}
          icon={<FiTrendingUp size={18} />}
          color={archivableCount > 0 ? CHART_COLORS.warning : CHART_COLORS.text}
        />
      </div>

      {/* Row 2: Store control + Close day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Store Control */}
        {canManageStore && (
          <SectionCard title="Controle da Lanchonete">
            <div className="flex flex-col gap-5">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {loadingConfig
                      ? "Carregando..."
                      : isOpen
                        ? "Aberta para pedidos"
                        : "Fechada para pedidos"}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Controla se o público pode fazer pedidos na lanchonete
                  </p>
                </div>
                <button
                  onClick={handleToggleStore}
                  disabled={togglingStore || loadingConfig}
                  className="cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    color: isOpen
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                >
                  {isOpen ? (
                    <FiToggleRight size={42} />
                  ) : (
                    <FiToggleLeft size={42} />
                  )}
                </button>
              </div>

              {/* Status badge */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: isOpen
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(239,68,68,0.08)",
                  border: `1px solid ${isOpen ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isOpen
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                />
                <span
                  className="text-sm font-medium"
                  style={{
                    color: isOpen
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                >
                  {isOpen
                    ? "Aberta — pedidos ativos"
                    : "Fechada — pedidos desativados"}
                </span>
              </div>

              {/* Time inputs */}
              <div className="flex flex-col gap-3">
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Horário de funcionamento
                </p>
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Abertura
                    </label>
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
                      style={{
                        backgroundColor: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <FiClock
                        size={13}
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <input
                        type="time"
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: "var(--color-text-primary)" }}
                      />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Fechamento
                    </label>
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
                      style={{
                        backgroundColor: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <FiClock
                        size={13}
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <input
                        type="time"
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: "var(--color-text-primary)" }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSaveTimes}
                  disabled={savingTimes}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }}
                >
                  <FiSave size={14} />
                  {savingTimes ? "Salvando..." : "Salvar horários"}
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Close Day */}
        {canGenerateReport && (
          <SectionCard title="Fechar Expediente">
            <div className="flex flex-col gap-4">
              <p
                className="text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Arquiva os pedidos finalizados e cancelados nas estatísticas
                diárias e os remove da fila de pedidos. Execute ao fim de cada
                dia de operação.
              </p>

              <div
                className="flex flex-col gap-2 p-3 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Pedidos para arquivar
                  </span>
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        archivableCount > 0
                          ? "var(--color-warning)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    {archivableCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Dias já registrados
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {stats.length}
                  </span>
                </div>
              </div>

              {archivableCount === 0 ? (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-sm"
                  style={{
                    backgroundColor: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    color: "var(--color-success)",
                  }}
                >
                  Nenhum pedido pendente de arquivamento
                </div>
              ) : (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "var(--color-warning)",
                    color: "white",
                  }}
                >
                  <FiArchive size={16} />
                  Fechar Expediente ({archivableCount} pedido
                  {archivableCount !== 1 ? "s" : ""})
                </button>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Row 3: Daily Report */}
      {canViewDashboard && (
        <div
          className="flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <button
            onClick={() => setReportExpanded((v) => !v)}
            className="flex items-center justify-between px-5 py-4 w-full text-left cursor-pointer"
            style={{
              borderBottom: reportExpanded
                ? "1px solid var(--color-border)"
                : "none",
            }}
          >
            <div className="flex items-center gap-2">
              <p
                className="font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Relatório Diário
              </p>
              {reportSource === "archived" && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: "rgba(168,85,247,0.15)",
                    color: "#a855f7",
                  }}
                >
                  Arquivado
                </span>
              )}
              {reportSource === "live" && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: "rgba(34,197,94,0.12)",
                    color: "var(--color-success)",
                  }}
                >
                  Ao vivo
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Date picker */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-sm"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <FiCalendar
                  size={13}
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-sm outline-none cursor-pointer"
                  style={{ color: "var(--color-text-primary)" }}
                />
              </div>
              <FiChevronDown
                size={16}
                style={{
                  color: "var(--color-text-muted)",
                  transform: reportExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </div>
          </button>

          {reportExpanded && (
            <div className="p-5 flex flex-col gap-5">
              {loadingReport ? (
                <div className="py-8 flex justify-center">
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Carregando...
                  </p>
                </div>
              ) : !hasReportData ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Nenhum pedido finalizado em {reportDate || "..."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Financial grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Dinheiro",
                        value: reportRevenue.money,
                        color: CHART_COLORS.success,
                      },
                      {
                        label: "Pix",
                        value: reportRevenue.pix,
                        color: CHART_COLORS.primary,
                      },
                      {
                        label: "Crédito",
                        value: reportRevenue.credit,
                        color: CHART_COLORS.purple,
                      },
                      {
                        label: "Débito",
                        value: reportRevenue.debit,
                        color: CHART_COLORS.warning,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col gap-1 p-3 rounded-[var(--radius-md)]"
                        style={{
                          backgroundColor: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <span
                          className="text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {item.label}
                        </span>
                        <span
                          className="text-base font-bold"
                          style={{ color: item.color }}
                        >
                          {fmtCurrency(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div
                    className="grid grid-cols-3 gap-3 p-4 rounded-[var(--radius-md)]"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Subtotal
                      </span>
                      <span
                        className="font-semibold text-sm"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {fmtCurrency(reportRevenue.subtotal)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Taxa de serviço
                      </span>
                      <span
                        className="font-semibold text-sm"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {fmtCurrency(reportRevenue.serviceFee)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-xs font-bold"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Total
                      </span>
                      <span
                        className="font-bold text-lg"
                        style={{ color: "var(--color-success)" }}
                      >
                        {fmtCurrency(reportRevenue.total)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  {reportItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Itens vendidos
                      </p>
                      <div
                        className="rounded-[var(--radius-md)] overflow-hidden"
                        style={{ border: "1px solid var(--color-border)" }}
                      >
                        {reportItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 px-4 p-2.5"
                            style={{
                              borderBottom:
                                i < reportItems.length - 1
                                  ? "1px solid var(--color-border)"
                                  : undefined,
                              backgroundColor:
                                i % 2 === 0
                                  ? "var(--color-bg-elevated)"
                                  : "transparent",
                            }}
                          >
                            <span
                              className="text-sm font-bold w-10 flex-shrink-0 text-center"
                              style={{ color: "var(--color-primary)" }}
                            >
                              {item.quantity}x
                            </span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                              style={{
                                backgroundColor: "var(--color-primary-light)",
                                color: "var(--color-primary)",
                              }}
                            >
                              {item.codItem || "—"} (código)
                            </span>
                            <span
                              className="text-sm flex-1 min-w-0 truncate"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Print button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm cursor-pointer transition-opacity hover:opacity-70"
                      style={{
                        backgroundColor: "var(--color-bg-elevated)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <FiPrinter size={14} />
                      Imprimir
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Row 4: Charts */}
      {stats.length === 0 && !loadingStats ? (
        <div
          className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] py-16 gap-3"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <FiTrendingUp
            size={32}
            style={{ color: "var(--color-text-muted)", opacity: 0.4 }}
          />
          <div className="text-center">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              Nenhum dado histórico ainda
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--color-text-muted)", opacity: 0.7 }}
            >
              Execute &ldquo;Fechar Expediente&rdquo; ao fim do dia para gerar
              os gráficos
            </p>
          </div>
        </div>
      ) : (
        stats.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue chart */}
              <ChartCard
                title="Faturamento por dia"
                range={revenueRange}
                onRangeChange={setRevenueRange}
                onClearClick={canDeleteChartData ? () =>
                  setClearModal({
                    label: "Faturamento por dia",
                    range: revenueRange,
                  })
                : undefined}
                count={revenueStats.length}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={revenueData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="gradTotal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.primary}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.primary}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_COLORS.border}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={CHART_COLORS.text}
                      tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.text}
                      tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                      tickFormatter={(v) => `R$${v}`}
                      width={55}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v) => fmtCurrency(Number(v ?? 0))}
                    />
                    <Area
                      type="monotone"
                      dataKey="Total"
                      stroke={CHART_COLORS.primary}
                      fill="url(#gradTotal)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Orders chart */}
              <ChartCard
                title="Pedidos finalizados vs cancelados"
                range={ordersRange}
                onRangeChange={setOrdersRange}
                onClearClick={canDeleteChartData ? () =>
                  setClearModal({ label: "Pedidos", range: ordersRange })
                : undefined}
                count={ordersStats.length}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={ordersData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    barGap={2}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_COLORS.border}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={CHART_COLORS.text}
                      tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.text}
                      tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                      width={30}
                    />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend
                      wrapperStyle={{ color: CHART_COLORS.text, fontSize: 12 }}
                    />
                    <Bar
                      dataKey="Finalizados"
                      fill={CHART_COLORS.success}
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="Cancelados"
                      fill={CHART_COLORS.error}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top items chart */}
              <ChartCard
                title="Itens mais vendidos"
                range={topItemsRange}
                onRangeChange={setTopItemsRange}
                onClearClick={canDeleteChartData ? () =>
                  setClearModal({
                    label: "Itens mais vendidos",
                    range: topItemsRange,
                  })
                : undefined}
                count={topItemsStats.length}
              >
                {topItemsData.length === 0 ? (
                  <p
                    className="text-sm text-center py-8"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Sem dados no período
                  </p>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={topItemsData.length * 36 + 20}
                  >
                    <BarChart
                      data={topItemsData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART_COLORS.border}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke={CHART_COLORS.text}
                        tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={160}
                        stroke={CHART_COLORS.text}
                        tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                        tickLine={false}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [`${Number(v ?? 0)}x`, "Vendidos"]}
                      />
                      <Bar
                        dataKey="value"
                        fill={CHART_COLORS.teal}
                        radius={[0, 3, 3, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Payment pie chart */}
              <ChartCard
                title="Distribuição por pagamento"
                range={paymentRange}
                onRangeChange={setPaymentRange}
                onClearClick={canDeleteChartData ? () =>
                  setClearModal({
                    label: "Distribuição por pagamento",
                    range: paymentRange,
                  })
                : undefined}
                count={paymentStats.length}
              >
                {paymentPieData.length === 0 ? (
                  <p
                    className="text-sm text-center py-8"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Sem dados no período
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={paymentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                        fontSize={11}
                        fill={CHART_COLORS.text}
                      >
                        {paymentPieData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => fmtCurrency(Number(v ?? 0))}
                      />
                      <Legend
                        wrapperStyle={{
                          color: CHART_COLORS.text,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )
      )}

      {/* Close Day Modal */}
      {showCloseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-xl)] overflow-hidden flex flex-col"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <p
                className="font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Fechar Expediente
              </p>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-1.5 cursor-pointer transition-opacity hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(245,158,11,0.12)",
                    color: "var(--color-warning)",
                  }}
                >
                  <FiAlertTriangle size={18} />
                </div>
                <div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Arquivar {archivableCount} pedido
                    {archivableCount !== 1 ? "s" : ""}
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Os pedidos finalizados e cancelados serão agrupados por dia
                    nas estatísticas e removidos da fila. Esta ação não pode ser
                    desfeita.
                  </p>
                </div>
              </div>

              <div
                className="p-3 rounded-[var(--radius-md)] text-xs"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                ✓ Pedidos agrupados por data nas estatísticas
                <br />
                ✓ Dados disponíveis nos gráficos do dashboard
                <br />✓ Pedidos ativos não são afetados
              </div>
            </div>

            <div
              className="flex gap-2 px-5 py-4"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={closingDay}
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
                onClick={handleCloseDay}
                disabled={closingDay}
                className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: "var(--color-warning)",
                  color: "white",
                }}
              >
                {closingDay ? "Arquivando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear chart data modal */}
      {clearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-xl)] overflow-hidden flex flex-col"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <p
                className="font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Zerar dados do gráfico
              </p>
              <button
                onClick={() => setClearModal(null)}
                className="p-1.5 cursor-pointer transition-opacity hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.12)",
                    color: "var(--color-error)",
                  }}
                >
                  <FiAlertTriangle size={18} />
                </div>
                <div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Ação irreversível
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Os dados de{" "}
                    <strong style={{ color: "var(--color-text-secondary)" }}>
                      {clearModal.label}
                    </strong>{" "}
                    {clearModal.range.from || clearModal.range.to
                      ? `do período ${clearModal.range.from || "início"} → ${clearModal.range.to || "fim"}`
                      : "de todos os períodos"}{" "}
                    serão excluídos permanentemente e não poderão ser
                    recuperados.
                  </p>
                </div>
              </div>
              {!clearModal.range.from && !clearModal.range.to && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "var(--color-error)",
                  }}
                >
                  <FiAlertTriangle size={12} />
                  Nenhum período selecionado — todos os dados serão apagados.
                </div>
              )}
            </div>

            <div
              className="flex gap-2 px-5 py-4"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                onClick={() => setClearModal(null)}
                disabled={clearing}
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
                onClick={() => handleClearStats(clearModal.range)}
                disabled={clearing}
                className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
                style={{
                  backgroundColor: "var(--color-error)",
                  color: "white",
                }}
              >
                {clearing ? "Zerando..." : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
