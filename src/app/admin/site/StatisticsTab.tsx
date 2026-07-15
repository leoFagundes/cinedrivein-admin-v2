"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { log } from "@/lib/logger";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiBarChart2,
  FiDownload,
  FiInfo,
  FiMonitor,
  FiMousePointer,
  FiRefreshCw,
  FiSmartphone,
  FiUsers,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  visits: number;
  devices: { mobile: number; desktop: number };
  filmClicks: Record<string, number>;
  pageClicks: Record<string, number>;
  sessionClicks: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_LABELS: Record<string, string> = {
  screening1: "Sessão 1",
  screening2: "Sessão 2",
  screening3: "Sessão 3",
  screening4: "Sessão 4",
};

const PAGE_LABELS: Record<string, string> = {
  cardapio: "Ver Cardápio",
  vendasOnline: "Vendas Online",
  historia: "Nossa História",
  mapa: "Mapa",
  comoFunciona: "Como Funciona",
  anunciante: "Seja Anunciante",
  avaliacao: "Avaliação",
};

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PRESETS = [
  { label: "Hoje", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;

const C = {
  primary: "#0ea5e9",
  violet: "#8b5cf6",
  amber: "#f59e0b",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetKey(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function parseDoc(id: string, data: Record<string, unknown>): DayData {
  const filmClicks: Record<string, number> = {};
  const pageClicks: Record<string, number> = {};
  const sessionClicks: Record<string, number> = {};
  let mobile = 0;
  let desktop = 0;

  for (const [key, value] of Object.entries(data)) {
    if (key === "visits") continue;

    if (key === "devices" && typeof value === "object" && value !== null) {
      const d = value as Record<string, number>;
      mobile += d.mobile ?? 0;
      desktop += d.desktop ?? 0;
    } else if (key.startsWith("devices.")) {
      const sub = key.slice("devices.".length);
      if (sub === "mobile") mobile += value as number;
      else if (sub === "desktop") desktop += value as number;
    } else if (key === "filmClicks" && typeof value === "object" && value !== null) {
      for (const [film, count] of Object.entries(value as Record<string, number>))
        filmClicks[film] = (filmClicks[film] ?? 0) + count;
    } else if (key.startsWith("filmClicks.")) {
      const film = key.slice("filmClicks.".length);
      filmClicks[film] = (filmClicks[film] ?? 0) + (value as number);
    } else if (key === "pageClicks" && typeof value === "object" && value !== null) {
      for (const [page, count] of Object.entries(value as Record<string, number>))
        pageClicks[page] = (pageClicks[page] ?? 0) + count;
    } else if (key.startsWith("pageClicks.")) {
      const page = key.slice("pageClicks.".length);
      pageClicks[page] = (pageClicks[page] ?? 0) + (value as number);
    } else if (key === "sessionClicks" && typeof value === "object" && value !== null) {
      for (const [session, count] of Object.entries(value as Record<string, number>))
        sessionClicks[session] = (sessionClicks[session] ?? 0) + count;
    } else if (key.startsWith("sessionClicks.")) {
      const session = key.slice("sessionClicks.".length);
      sessionClicks[session] = (sessionClicks[session] ?? 0) + (value as number);
    }
  }

  return {
    date: id,
    visits: (data.visits as number) ?? 0,
    devices: { mobile, desktop },
    filmClicks,
    pageClicks,
    sessionClicks,
  };
}

function prevPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const spanDays = Math.round((e.getTime() - s.getTime()) / 86400000);
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - spanDays);
  return {
    prevStart: prevStart.toISOString().slice(0, 10),
    prevEnd: prevEnd.toISOString().slice(0, 10),
  };
}

function pctDelta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="var(--color-primary)" strokeWidth="3" />
        <path className="opacity-80" fill="var(--color-primary)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function KpiCard({ label, value, icon, delta }: { label: string; value: number; icon: React.ReactNode; delta?: number | null }) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-lg)]"
      style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          {value.toLocaleString("pt-BR")}
        </span>
        {delta !== null && delta !== undefined && (
          <span className={`text-xs font-semibold mb-0.5 ${delta >= 0 ? "text-green-500" : "text-red-400"}`}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-bg-surface)",
};

const axisTickStyle = { fontSize: 11, fill: "var(--color-text-muted)" };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StatisticsTab({ canManage }: { canManage: boolean }) {
  const { appUser } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "?", username: "?" };

  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => offsetKey(30));
  const [endDate, setEndDate] = useState(() => todayKey());
  const [days, setDays] = useState<DayData[]>([]);
  const [prevDays, setPrevDays] = useState<DayData[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Load enable flag once on mount
  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, "siteConfig", "analyticsConfig"));
        if (snap.exists()) setAnalyticsEnabled(snap.data().isEnabled ?? true);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "analytics"));
      const allDocs = snap.docs;

      const filtered = allDocs
        .filter((d) => d.id >= startDate && d.id <= endDate)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => parseDoc(d.id, d.data() as Record<string, unknown>));
      setDays(filtered);

      const { prevStart, prevEnd } = prevPeriod(startDate, endDate);
      const prevFiltered = allDocs
        .filter((d) => d.id >= prevStart && d.id <= prevEnd)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => parseDoc(d.id, d.data() as Record<string, unknown>));
      setPrevDays(prevFiltered);
    } catch (e) {
      console.error(e);
      toastError("Erro ao carregar estatísticas", "Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    if (!canManage || toggleLoading) return;
    setToggleLoading(true);
    const next = !analyticsEnabled;
    try {
      await setDoc(doc(db, "siteConfig", "analyticsConfig"), { isEnabled: next }, { merge: true });
      setAnalyticsEnabled(next);
      toastSuccess(
        next ? "Coleta ativada" : "Coleta desativada",
        next ? "Interações do site serão registradas." : "Nenhum dado novo será salvo.",
      );
      log({
        action: next ? "enable_analytics" : "disable_analytics",
        category: "site",
        description: next
          ? "Ativou a coleta de estatísticas do site"
          : "Desativou a coleta de estatísticas do site",
        performedBy: actor,
        target: { type: "config", id: "analyticsConfig", name: "Coleta de Estatísticas" },
        changes: [{ field: "isEnabled", from: String(!next), to: String(next) }],
      });
    } catch (e) {
      console.error(e);
      toastError("Erro ao salvar", "Tente novamente.");
    } finally {
      setToggleLoading(false);
    }
  }

  // ── Aggregates ────────────────────────────────────────────────────────────────

  const totalVisits = days.reduce((s, d) => s + d.visits, 0);
  const totalMobile = days.reduce((s, d) => s + d.devices.mobile, 0);
  const totalDesktop = days.reduce((s, d) => s + d.devices.desktop, 0);

  const pageClickTotals = Object.entries(PAGE_LABELS)
    .map(([key, label]) => ({ label, value: days.reduce((s, d) => s + (d.pageClicks[key] ?? 0), 0) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalPageClicks = pageClickTotals.reduce((s, p) => s + p.value, 0);

  const prevTotalVisits = prevDays.reduce((s, d) => s + d.visits, 0);
  const prevTotalMobile = prevDays.reduce((s, d) => s + d.devices.mobile, 0);
  const prevTotalDesktop = prevDays.reduce((s, d) => s + d.devices.desktop, 0);
  const prevTotalPageClicks = Object.keys(PAGE_LABELS)
    .reduce((s, k) => s + prevDays.reduce((ss, d) => ss + (d.pageClicks[k] ?? 0), 0), 0);

  const dowData = DOW_LABELS.map((label, i) => ({
    label,
    value: days
      .filter((d) => new Date(d.date + "T12:00:00").getDay() === i)
      .reduce((s, d) => s + d.visits, 0),
  }));

  function exportCSV() {
    const escape = (v: string | number) =>
      typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v;
    const allFilms = Array.from(new Set(days.flatMap((d) => Object.keys(d.filmClicks)))).sort();
    const header = [
      "Data", "Visitas", "Mobile", "Desktop",
      ...Object.entries(PAGE_LABELS).map(([, v]) => `Seção: ${v}`),
      ...Object.entries(SESSION_LABELS).map(([, v]) => v),
      ...allFilms.map((f) => `Filme: ${f}`),
    ].map(escape).join(",");
    const rows = days.map((d) =>
      [
        d.date, d.visits, d.devices.mobile, d.devices.desktop,
        ...Object.keys(PAGE_LABELS).map((k) => d.pageClicks[k] ?? 0),
        ...Object.keys(SESSION_LABELS).map((k) => d.sessionClicks[k] ?? 0),
        ...allFilms.map((f) => d.filmClicks[f] ?? 0),
      ].map(escape).join(","),
    );
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estatisticas-${startDate}-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sessionClickData = Object.entries(SESSION_LABELS)
    .map(([key, label]) => ({ label, value: days.reduce((s, d) => s + (d.sessionClicks[key] ?? 0), 0) }))
    .filter((s) => s.value > 0);

  const filmClickMap: Record<string, number> = {};
  for (const d of days)
    for (const [film, count] of Object.entries(d.filmClicks))
      filmClickMap[film] = (filmClickMap[film] ?? 0) + (count as number);

  const filmData = Object.entries(filmClickMap)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 6)
    .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, value }));

  const devicePieData = [
    { name: "Mobile", value: totalMobile },
    { name: "Desktop", value: totalDesktop },
  ].filter((d) => d.value > 0);

  const visitChartData = days.map((d) => ({ date: fmtLabel(d.date), Visitas: d.visits }));

  const hasData = totalVisits > 0 || totalPageClicks > 0 || filmData.length > 0 || sessionClickData.length > 0;

  // Highlight preset button when dates match
  const activePreset = PRESETS.find(
    (p) => startDate === offsetKey(p.days) && endDate === todayKey(),
  )?.days ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Estatísticas
          </h2>
          {!analyticsEnabled && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
              Coleta pausada
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasData && !loading && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
            >
              <FiDownload size={12} />
              Exportar
            </button>
          )}
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Analytics toggle */}
      <div className="flex items-center justify-between p-4 rounded-[var(--radius-lg)]"
        style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            Coleta de estatísticas
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Registra cliques e visitas no site público
          </p>
        </div>
        <button
          onClick={() => void handleToggle()}
          disabled={toggleLoading || !canManage}
          className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: analyticsEnabled ? "var(--color-primary)" : "var(--color-border)" }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: analyticsEnabled ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      {/* Period presets + date range row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick presets */}
        <div className="flex gap-2">
          {PRESETS.map(({ label, days: d }) => {
            const isActive = activePreset === d;
            return (
              <button
                key={d}
                onClick={() => { setStartDate(offsetKey(d)); setEndDate(todayKey()); }}
                className="h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
                style={{
                  backgroundColor: isActive ? "var(--color-primary-light)" : "var(--color-bg-elevated)",
                  border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
                  color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-5 w-px hidden sm:block" style={{ backgroundColor: "var(--color-border)" }} />

        {/* Custom date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>De</span>
          <input
            type="date"
            value={startDate}
            max={endDate || todayKey()}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 px-2.5 rounded-[var(--radius-md)] text-xs font-medium outline-none transition-all"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              colorScheme: "light dark",
            }}
          />
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>até</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayKey()}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 px-2.5 rounded-[var(--radius-md)] text-xs font-medium outline-none transition-all"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              colorScheme: "light dark",
            }}
          />
        </div>
      </div>

      {/* Comparison toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer"
          style={{ backgroundColor: showComparison ? "var(--color-primary)" : "var(--color-border)" }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: showComparison ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
        <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Comparar com período anterior
        </span>
        <span
          title="Mostra a variação percentual dos KPIs em relação ao mesmo intervalo imediatamente anterior. Ex: selecionando 7 dias, compara com os 7 dias anteriores a esse período."
          className="cursor-help"
          style={{ color: "var(--color-text-muted)" }}
        >
          <FiInfo size={13} />
        </span>
      </div>

      {loading ? (
        <Spinner />
      ) : !hasData ? (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: "var(--color-text-muted)" }}>
          <FiBarChart2 size={32} />
          <p className="text-sm font-medium">Nenhum dado para o período selecionado</p>
          <p className="text-xs text-center">
            Quando usuários interagirem com o site, os dados aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <KpiCard label="Visitas" value={totalVisits} icon={<FiUsers size={15} />}
              delta={showComparison ? pctDelta(totalVisits, prevTotalVisits) : undefined} />
            <KpiCard label="Interações" value={totalPageClicks} icon={<FiMousePointer size={15} />}
              delta={showComparison ? pctDelta(totalPageClicks, prevTotalPageClicks) : undefined} />
            <KpiCard label="Mobile" value={totalMobile} icon={<FiSmartphone size={15} />}
              delta={showComparison ? pctDelta(totalMobile, prevTotalMobile) : undefined} />
            <KpiCard label="Desktop" value={totalDesktop} icon={<FiMonitor size={15} />}
              delta={showComparison ? pctDelta(totalDesktop, prevTotalDesktop) : undefined} />
          </div>

          {/* Visits over time */}
          {totalVisits > 0 && (
            <div className="p-4 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Visitas por dia
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={visitChartData}>
                  <defs>
                    <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={axisTickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="Visitas" stroke={C.primary} fill="url(#visitGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Visits by day of week */}
          {totalVisits > 0 && (
            <div className="p-4 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Visitas por dia da semana
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Visitas" fill={C.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Page clicks */}
          {pageClickTotals.length > 0 && (
            <div className="p-4 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Cliques por seção
              </p>
              <ResponsiveContainer width="100%" height={Math.max(160, pageClickTotals.length * 38)}>
                <BarChart data={pageClickTotals} layout="vertical" margin={{ left: 8, right: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={axisTickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={118} tick={axisTickStyle} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Cliques" fill={C.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session clicks */}
          {sessionClickData.length > 0 && (
            <div className="p-4 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Cliques por sessão
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sessionClickData} margin={{ left: 8, right: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Cliques" fill={C.amber} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Films + Devices */}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {filmData.length > 0 && (
              <div className="p-4 rounded-[var(--radius-lg)]"
                style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                  Filmes mais clicados
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={filmData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Cliques" fill={C.violet} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {devicePieData.length > 0 && (
              <div className="p-4 rounded-[var(--radius-lg)]"
                style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                  Dispositivos
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={devicePieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                      dataKey="value" nameKey="name" paddingAngle={3}>
                      <Cell fill={C.amber} />
                      <Cell fill={C.primary} />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
