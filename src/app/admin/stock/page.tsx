/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
  query,
  orderBy,
  where,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  FiBox,
  FiPlus,
  FiSearch,
  FiBell,
  FiSettings,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiEdit2,
  FiTrash2,
  FiStar,
  FiCamera,
  FiX,
  FiChevronUp,
  FiChevronDown,
  FiAlertTriangle,
  FiCheck,
  FiPackage,
  FiList,
  FiTrendingDown,
  FiDownload,
  FiZap,
  FiPrinter,
  FiInfo,
  FiTag,
  FiUpload,
  FiRotateCcw,
} from "react-icons/fi";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/access";
import { log } from "@/lib/logger";
import { StockItem, Subitem, AdditionalGroup } from "@/types";
import Input from "@/components/ui/Input";
import Image from "next/image";
import itembg from "../../../../public/images/items-background.png";
// ─── Constants ────────────────────────────────────────────────────────────────

const ADDITIONAL_GROUPS: { key: AdditionalGroup; label: string }[] = [
  { key: "additionals", label: "Gerais" },
  { key: "additionals_sauce", label: "Molhos" },
  { key: "additionals_drink", label: "Bebidas" },
  { key: "additionals_sweet", label: "Doces" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: "rgba(239,68,68,0.1)",
          color: "var(--color-error)",
        }}
      >
        <FiBox size={24} />
      </div>
      <div className="text-center">
        <p
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Acesso negado
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Você precisa da permissão {'"'}Gerenciar estoque{'"'}.
        </p>
      </div>
    </div>
  );
}

// ─── Photo Upload ─────────────────────────────────────────────────────────────

function PhotoUpload({
  current,
  onFileSelected,
}: {
  current?: string;
  onFileSelected: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelected(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleRemove() {
    onFileSelected(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-medium"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Foto
      </label>
      <div className="flex items-center gap-3">
        <div
          className="w-20 h-20 rounded-[var(--radius-lg)] flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <FiCamera size={24} style={{ color: "var(--color-text-muted)" }} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-8 px-3 text-xs rounded-[var(--radius-md)] cursor-pointer transition-all"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-border)")
            }
          >
            {preview ? "Trocar foto" : "Selecionar foto"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              className="h-8 px-3 text-xs rounded-[var(--radius-md)] cursor-pointer"
              style={{ color: "var(--color-error)" }}
            >
              Remover
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

// ─── Subitem Picker ───────────────────────────────────────────────────────────

function SubitemPicker({
  label,
  allSubitems,
  selected,
  onChange,
}: {
  label: string;
  allSubitems: Subitem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = allSubitems.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedItems = allSubitems.filter((s) => selected.includes(s.id));

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs cursor-pointer"
          style={{ color: "var(--color-primary)" }}
        >
          <FiPlus size={12} /> Adicionar
        </button>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: s.isVisible
                  ? "var(--color-primary-light)"
                  : "rgba(82,88,112,0.2)",
                color: s.isVisible
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
                border: `1px solid ${s.isVisible ? "rgba(0,136,194,0.3)" : "var(--color-border)"}`,
              }}
            >
              {!s.isVisible && <FiEyeOff size={9} />}
              {s.name}
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <FiX size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div
          className="rounded-[var(--radius-md)] overflow-hidden"
          style={{
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-elevated)",
          }}
        >
          <div
            className="p-2"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="relative">
              <FiSearch
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar subitem..."
                className="w-full h-7 pl-7 pr-2 text-xs outline-none rounded"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p
                className="p-3 text-xs text-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                {allSubitems.length === 0
                  ? "Nenhum subitem cadastrado"
                  : "Nenhum resultado"}
              </p>
            ) : (
              filtered.map((s) => {
                const checked = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs cursor-pointer transition-colors"
                    style={{
                      color: "var(--color-text-primary)",
                      opacity: s.isVisible ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--color-bg-surface)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: checked
                          ? "var(--color-primary)"
                          : "transparent",
                        border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border)"}`,
                      }}
                    >
                      {checked && <FiCheck size={9} color="white" />}
                    </div>
                    {/* {s.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photo}
                        alt={s.name}
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                      />
                    )} */}
                    <div className="flex items-center gap-2">
                      <span className="">{s.name}</span>
                      {s.description && (
                        <span className="text-text-muted text-[10px] truncate">
                          ({s.description})
                        </span>
                      )}
                    </div>
                    {!s.isVisible && (
                      <span
                        className="inline-flex items-center gap-0.5 flex-shrink-0"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <FiEyeOff size={10} /> oculto
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div
            className="p-2 flex justify-end"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearch("");
              }}
              className="h-6 px-3 text-xs rounded cursor-pointer"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Input ───────────────────────────────────────────────────────────

function CategoryInput({
  value,
  onChange,
  categories,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = categories.filter(
    (c) => c.toLowerCase().includes(value.toLowerCase()) && c !== value,
  );

  return (
    <div className="relative">
      <Input
        label="Categoria"
        placeholder="Ex: Lanches, Bebidas..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        error={error}
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-10 w-full mt-1 rounded-[var(--radius-md)] shadow-lg overflow-hidden"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {suggestions.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={() => {
                onChange(c);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm cursor-pointer"
              style={{ color: "var(--color-text-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-bg-elevated)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  subheader,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  subheader?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />
      <div
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[var(--radius-xl)] flex flex-col max-h-[92vh]`}
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded cursor-pointer hover:opacity-60"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Subheader fixo — abas ou filtros */}
        {subheader && (
          <div
            className="flex-shrink-0"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            {subheader}
          </div>
        )}

        {/* Corpo scrollável */}
        <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-4">
          {children}
        </div>

        {/* Footer fixo com botão de ação */}
        {footer && (
          <div
            className="px-6 py-4 flex-shrink-0"
            style={{
              borderTop: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-surface)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteConfirm({
  name,
  onConfirm,
  onClose,
  loading,
}: {
  name: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Modal title="Confirmar exclusão" onClose={onClose}>
      <div
        className="flex items-start gap-3 p-4 rounded-[var(--radius-md)]"
        style={{
          backgroundColor: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <FiAlertTriangle
          size={18}
          className="flex-shrink-0 mt-0.5"
          style={{ color: "var(--color-error)" }}
        />
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Tem certeza que deseja excluir{" "}
          <strong>
            {'"'}
            {name}
            {'"'}
          </strong>
          ? Esta ação não pode ser desfeita.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-[var(--radius-md)] text-sm cursor-pointer"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: "var(--color-error)" }}
        >
          {loading ? "Excluindo..." : "Excluir"}
        </button>
      </div>
    </Modal>
  );
}

function DownloadConfirm({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Confirmar Download" onClose={onClose}>
      <div className="flex flex-col items-start gap-3 px-4 rounded-[var(--radius-md)]">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Baixe o <strong>fundo padrão</strong> das imagens do Cine Drive-in e
          utilize como base para criar novos itens com o mesmo estilo visual do
          cardápio.
        </p>
        <div className="flex items-center justify-center w-full py-2">
          <Image
            className="shadow-2xl"
            src={itembg.src}
            alt="background"
            width={300}
            height={300}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-[var(--radius-md)] text-sm cursor-pointer"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          Cancelar
        </button>
        <a href="/images/items-background.png" download="items-background.png">
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <FiDownload size={15} /> Download
          </button>
        </a>
      </div>
    </Modal>
  );
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function ToggleBtn({
  active,
  onToggle,
  trueColor = "var(--color-success)",
}: {
  active: boolean;
  onToggle: () => void;
  trueColor?: string;
}) {
  return (
    <button
      onClick={onToggle}
      title={
        active
          ? "Visível — clique para ocultar"
          : "Oculto — clique para mostrar"
      }
      className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
      style={{
        backgroundColor: active ? `${trueColor}18` : "var(--color-bg-elevated)",
        color: active ? trueColor : "var(--color-text-muted)",
        border: "1px solid var(--color-border)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {active ? <FiEye size={13} /> : <FiEyeOff size={13} />}
    </button>
  );
}

// ─── Subitem Modal ────────────────────────────────────────────────────────────

interface SubitemForm {
  name: string;
  description: string;
  isVisible: boolean;
  linkedItemId: string;
}

/* ────────────────────────────────────────────────────────────────────────
   SUGESTÃO INTELIGENTE — utilitários (name + description, scoring 0-100%)
   ──────────────────────────────────────────────────────────────────────── */

const PT_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ou",
  "com",
  "sem",
  "para",
  "a",
  "o",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "no",
  "na",
  "nos",
  "nas",
  "em",
  "ao",
  "aos",
  "à",
  "às",
  "por",
  "pra",
  "pro",
]);

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !PT_STOPWORDS.has(t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length < b.length) [a, b] = [b, a];
  let prev: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = new Array(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenMatchScore(qt: string, ct: string): number {
  if (qt === ct) return 1;
  if (qt.length < 3 || ct.length < 3) return 0;
  if (ct.startsWith(qt) || qt.startsWith(ct)) return 0.85;
  if (ct.includes(qt) || qt.includes(ct)) return 0.65;
  const sim = levenshteinSimilarity(qt, ct);
  return sim >= 0.7 ? sim * 0.8 : 0;
}

function fieldScore(queryTokens: string[], fieldText: string): number {
  if (!queryTokens.length) return 0;
  const fieldTokens = tokenize(fieldText);
  if (!fieldTokens.length) return 0;
  let total = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const ft of fieldTokens) {
      const s = tokenMatchScore(qt, ft);
      if (s > best) best = s;
      if (best === 1) break;
    }
    total += best;
  }
  return total / queryTokens.length;
}

interface SuggestionScore {
  score: number;
  strong: boolean;
  matchedOn: "nome" | "descrição" | "nome + descrição" | "aproximado";
}

function scoreItemForSubitem(
  subitemName: string,
  subitemDescription: string,
  item: StockItem,
): SuggestionScore {
  const nameTokens = tokenize(subitemName);
  const descTokens = tokenize(subitemDescription);

  if (nameTokens.length === 0 && descTokens.length === 0) {
    return { score: 0, strong: false, matchedOn: "aproximado" };
  }

  const WQ_NAME = 1.0;
  const WQ_DESC = 0.5;
  const WF_NAME = 1.0;
  const WF_DESC = 0.5;

  const itemName = item.name ?? "";
  const itemDesc = item.description ?? "";

  const sNameVsName = nameTokens.length ? fieldScore(nameTokens, itemName) : 0;
  const sNameVsDesc = nameTokens.length ? fieldScore(nameTokens, itemDesc) : 0;
  const sDescVsName = descTokens.length ? fieldScore(descTokens, itemName) : 0;
  const sDescVsDesc = descTokens.length ? fieldScore(descTokens, itemDesc) : 0;

  const qNameBest = Math.max(sNameVsName * WF_NAME, sNameVsDesc * WF_DESC);
  const qDescBest = Math.max(sDescVsName * WF_NAME, sDescVsDesc * WF_DESC);

  const totalWeight =
    (nameTokens.length ? WQ_NAME : 0) + (descTokens.length ? WQ_DESC : 0);
  if (totalWeight === 0) {
    return { score: 0, strong: false, matchedOn: "aproximado" };
  }
  const raw =
    (nameTokens.length ? qNameBest * WQ_NAME : 0) +
    (descTokens.length ? qDescBest * WQ_DESC : 0);
  const score = raw / totalWeight;

  let matchedOn: SuggestionScore["matchedOn"] = "aproximado";
  const nameHit = Math.max(sNameVsName, sDescVsName) >= 0.5;
  const descHit = Math.max(sNameVsDesc, sDescVsDesc) >= 0.5;
  if (nameHit && descHit) matchedOn = "nome + descrição";
  else if (nameHit) matchedOn = "nome";
  else if (descHit) matchedOn = "descrição";

  return { score, strong: score >= 0.6, matchedOn };
}

function LinkedItemPicker({
  value,
  onChange,
  allItems,
  subitemName,
  subitemDescription,
}: {
  value: string;
  onChange: (id: string) => void;
  allItems: StockItem[];
  subitemName: string;
  subitemDescription: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Sugestões memoizadas: mapa id → SuggestionScore
  const suggestions = useMemo(() => {
    const hasQuery =
      subitemName.trim().length >= 2 || subitemDescription.trim().length >= 3;
    const map = new Map<string, SuggestionScore>();
    if (!hasQuery) return map;
    for (const it of allItems) {
      const s = scoreItemForSubitem(subitemName, subitemDescription, it);
      if (s.score >= 0.25) map.set(it.id, s);
    }
    return map;
  }, [subitemName, subitemDescription, allItems]);

  const suggestedCount = suggestions.size;
  const strongCount = Array.from(suggestions.values()).filter(
    (s) => s.strong,
  ).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.codItem.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q),
    );
  }, [search, allItems]);

  const sorted = useMemo(() => {
    const withScore = filtered.map((i) => ({
      item: i,
      sug: suggestions.get(i.id),
    }));
    const sug = withScore
      .filter((x) => x.sug)
      .sort((a, b) => b.sug!.score - a.sug!.score);
    const rest = withScore.filter((x) => !x.sug);
    return [...sug, ...rest];
  }, [filtered, suggestions]);

  const selectedItem = allItems.find((i) => i.id === value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          className="text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Vincular a item do estoque
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--color-error)" }}
          >
            Remover vínculo
          </button>
        )}
      </div>

      {/* Selected item display */}
      {selectedItem ? (
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]"
          style={{
            backgroundColor: "rgba(0,136,194,0.08)",
            border: "1px solid rgba(0,136,194,0.3)",
          }}
        >
          {selectedItem.photo ? (
            <img
              src={selectedItem.photo}
              alt={selectedItem.name}
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: "var(--color-bg-base)",
                color: "var(--color-text-muted)",
              }}
            >
              <FiBox size={13} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {selectedItem.name}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              #{selectedItem.codItem} · estoque: {selectedItem.quantity}
              {!selectedItem.trackStock && (
                <span style={{ color: "var(--color-warning)" }}>
                  {" "}
                  · sem controle de estoque
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs px-2 py-1 rounded cursor-pointer transition-opacity hover:opacity-70 flex-shrink-0"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            Trocar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all text-left w-full"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--color-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--color-border)")
          }
        >
          <FiPackage size={14} style={{ flexShrink: 0 }} />
          <span>Selecionar item para vincular...</span>
          {suggestedCount > 0 && (
            <span
              className="ml-auto text-xs px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
              style={{
                backgroundColor:
                  strongCount > 0
                    ? "rgba(0,136,194,0.18)"
                    : "rgba(0,136,194,0.1)",
                color: "var(--color-primary)",
                fontWeight: 600,
              }}
            >
              <FiZap size={10} />
              {suggestedCount} sugerido{suggestedCount !== 1 ? "s" : ""}
              {strongCount > 0 &&
                ` · ${strongCount} forte${strongCount !== 1 ? "s" : ""}`}
            </span>
          )}
        </button>
      )}
      {/* Dropdown */}
      {open && (
        <div
          className="rounded-[var(--radius-md)] overflow-hidden"
          style={{
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-elevated)",
          }}
        >
          {/* Search */}
          <div
            className="p-2"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="relative">
              <FiSearch
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, código ou descrição..."
                className="w-full h-7 pl-7 pr-2 text-xs outline-none rounded"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--color-text-primary)",
                }}
                autoFocus
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {sorted.length === 0 ? (
              <p
                className="p-3 text-xs text-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nenhum item encontrado
              </p>
            ) : (
              sorted.map(({ item, sug }, idx) => {
                const isSuggested = !!sug;
                const isSelected = item.id === value;
                const prev = sorted[idx - 1];
                const showDivider = !isSuggested && idx > 0 && !!prev?.sug;

                return (
                  <div key={item.id}>
                    {showDivider && suggestedCount > 0 && (
                      <div
                        className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          color: "var(--color-text-muted)",
                          borderTop: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-bg-surface)",
                        }}
                      >
                        Outros itens
                      </div>
                    )}
                    {isSuggested && idx === 0 && (
                      <div
                        className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
                        style={{
                          color: "var(--color-primary)",
                          backgroundColor: "rgba(0,136,194,0.06)",
                          borderBottom: "1px solid rgba(0,136,194,0.12)",
                        }}
                      >
                        <FiZap size={10} /> Sugestões inteligentes
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs cursor-pointer transition-colors"
                      style={{
                        color: "var(--color-text-primary)",
                        backgroundColor: isSelected
                          ? "rgba(0,136,194,0.1)"
                          : sug?.strong
                            ? "rgba(0,136,194,0.06)"
                            : isSuggested
                              ? "rgba(0,136,194,0.03)"
                              : "transparent",
                        borderLeft: sug?.strong
                          ? "2px solid var(--color-primary)"
                          : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.backgroundColor =
                            "var(--color-bg-surface)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? "rgba(0,136,194,0.1)"
                          : sug?.strong
                            ? "rgba(0,136,194,0.06)"
                            : isSuggested
                              ? "rgba(0,136,194,0.03)"
                              : "transparent";
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: isSelected
                            ? "var(--color-primary)"
                            : "transparent",
                          border: `1.5px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"}`,
                        }}
                      >
                        {isSelected && <FiCheck size={9} color="white" />}
                      </div>

                      {/* Photo */}
                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt={item.name}
                          className="w-7 h-7 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: "var(--color-bg-base)",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          <FiBox size={11} />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium truncate">
                            {item.name}
                          </span>
                          {sug && (
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex-shrink-0 flex items-center gap-0.5"
                              style={{
                                backgroundColor: sug.strong
                                  ? "rgba(0,136,194,0.2)"
                                  : "rgba(0,136,194,0.1)",
                                color: "var(--color-primary)",
                              }}
                              title={`Similaridade: ${Math.round(sug.score * 100)}% — match em ${sug.matchedOn}`}
                            >
                              <FiZap size={9} />
                              {Math.round(sug.score * 100)}%
                            </span>
                          )}
                          {!item.trackStock && (
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[9px] flex-shrink-0"
                              style={{
                                backgroundColor: "rgba(245,158,11,0.12)",
                                color: "var(--color-warning)",
                              }}
                            >
                              sem controle
                            </span>
                          )}
                        </div>
                        <span
                          className="font-mono"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          #{item.codItem} · qtd: {item.quantity}
                          {sug && (
                            <>
                              {" · "}
                              <span style={{ color: "var(--color-primary)" }}>
                                match em {sug.matchedOn}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div
            className="p-2 flex justify-end"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearch("");
              }}
              className="h-6 px-3 text-xs rounded cursor-pointer"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Warning when linked item has no trackStock */}
      {selectedItem && !selectedItem.trackStock && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-[var(--radius-md)]"
          style={{
            backgroundColor: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <FiAlertTriangle
            size={13}
            style={{
              color: "var(--color-warning)",
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <p
            className="text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            O item <strong>{selectedItem.name}</strong> não tem controle de
            estoque ativo. O vínculo existe, mas o estoque não será alterado
            quando este subitem for pedido — ative o controle de estoque no item
            para que funcione.
          </p>
        </div>
      )}
    </div>
  );
}

function SubitemModal({
  existing,
  allItems,
  onSave,
  onClose,
}: {
  existing?: Subitem;
  allItems: StockItem[];
  onSave: (data: SubitemForm, file: File | null | undefined) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubitemForm>({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    isVisible: existing?.isVisible ?? true,
    linkedItemId: existing?.linkedItemId ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null | undefined>(
    undefined,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof SubitemForm, string>>
  >({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof SubitemForm>(k: K, v: SubitemForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  async function handleSave() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Nome obrigatório";
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    await onSave(form, photoFile);
    setLoading(false);
  }

  return (
    <Modal
      title={existing ? `Editar subitem` : "Novo subitem"}
      onClose={onClose}
      footer={
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full h-10 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50 transition-all"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading
            ? "Salvando..."
            : existing
              ? "Salvar alterações"
              : "Criar subitem"}
        </button>
      }
    >
      <Input
        label="Nome"
        placeholder="Nome do subitem"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        error={errors.name}
        autoFocus
      />
      <Input
        label="Descrição"
        placeholder="Descrição (opcional)"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <PhotoUpload current={existing?.photo} onFileSelected={setPhotoFile} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set("isVisible", !form.isVisible)}
          className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all"
          style={{
            backgroundColor: form.isVisible
              ? "rgba(34,197,94,0.1)"
              : "var(--color-bg-elevated)",
            border: `1px solid ${form.isVisible ? "var(--color-success)" : "var(--color-border)"}`,
            color: form.isVisible
              ? "var(--color-success)"
              : "var(--color-text-secondary)",
          }}
        >
          {form.isVisible ? <FiEye size={14} /> : <FiEyeOff size={14} />}
          {form.isVisible ? "Visível" : "Oculto"}
        </button>
      </div>

      {/* Separator */}
      <div
        style={{ borderTop: "1px solid var(--color-border)", paddingTop: 4 }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-1 pt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Vínculo de estoque
        </p>
        <p
          className="text-[8px] font-semibold uppercase tracking-wide mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          Ao ativar este vínculo, o estoque do item vinculado será reduzido
          automaticamente sempre que esse subitem{" "}
          {form.name ? <strong>`(${form.name})`</strong> : ""} for adicionado
          como adicional em um pedido. Funciona apenas se o controle de estoque
          estiver ativado no item principal vinculado.
        </p>
        <LinkedItemPicker
          value={form.linkedItemId}
          onChange={(id) => set("linkedItemId", id)}
          allItems={allItems}
          subitemName={form.name}
          subitemDescription={form.description}
        />
      </div>
    </Modal>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

interface ItemForm {
  codItem: string;
  name: string;
  category: string;
  description: string;
  value: string;
  visibleValue: string;
  quantity: string;
  isVisible: boolean;
  isFeatured: boolean;
  isPromotion: boolean;
  promotionOriginalPrice: string;
  trackStock: boolean;
  printTwice: boolean;
  additionals: string[];
  additionals_sauce: string[];
  additionals_drink: string[];
  additionals_sweet: string[];
}

function Section({ title }: { title: string }) {
  return (
    <div
      className="pt-2"
      style={{ borderTop: "1px solid var(--color-border)" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        {title}
      </p>
    </div>
  );
}

function InfoTooltip({
  text,
  align = "center",
}: {
  text: string;
  align?: "left" | "center" | "right";
}) {
  const [visible, setVisible] = useState(false);

  const tooltipStyle: React.CSSProperties =
    align === "right"
      ? { right: 0, transform: "none" }
      : align === "left"
        ? { left: 0, transform: "none" }
        : { left: "50%", transform: "translateX(-50%)" };

  const arrowStyle: React.CSSProperties =
    align === "right"
      ? { right: 6, left: "auto", transform: "none" }
      : align === "left"
        ? { left: 6, transform: "none" }
        : { left: "50%", transform: "translateX(-50%)" };

  return (
    <div className="relative flex items-center flex-shrink-0">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="flex items-center justify-center cursor-help"
        style={{ color: "var(--color-text-muted)" }}
      >
        <FiInfo size={13} />
      </button>
      {visible && (
        <div
          className="absolute z-50 bottom-full mb-2 w-56 rounded-[var(--radius-md)] px-3 py-2 text-xs leading-relaxed pointer-events-none"
          style={{
            ...tooltipStyle,
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {text}
          <div
            className="absolute top-full"
            style={{
              ...arrowStyle,
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid var(--color-border)",
            }}
          />
          <div
            className="absolute top-full"
            style={{
              ...arrowStyle,
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid var(--color-bg-elevated)",
              marginTop: "-1px",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── CSV Import helpers ───────────────────────────────────────────────────────

interface ParsedCsvItem {
  nome: string;
  categoria: string;
  descricao: string;
  codigo: string;
  preco: number;
  quantidade: number;
  controle_estoque: boolean;
  visivel: boolean;
}

interface CsvParseError {
  line: number;
  message: string;
}

const CSV_COLUMNS = [
  {
    name: "nome",
    label: "Nome",
    required: true,
    type: "Texto",
    example: "Hambúrguer Duplo",
    hint: "Nome exibido no cardápio",
  },
  {
    name: "categoria",
    label: "Categoria",
    required: true,
    type: "Texto",
    example: "Lanches",
    hint: "Agrupa os itens no cardápio",
  },
  {
    name: "preco",
    label: "Preço",
    required: true,
    type: "Número",
    example: "25.90",
    hint: "Use ponto como separador decimal",
  },
  {
    name: "codigo",
    label: "Código",
    required: false,
    type: "Texto",
    example: "001",
    hint: "Deixe vazio para gerar automaticamente",
  },
  {
    name: "descricao",
    label: "Descrição",
    required: false,
    type: "Texto",
    example: "Pão brioche com queijo",
    hint: "Texto descritivo abaixo do nome",
  },
  {
    name: "quantidade",
    label: "Quantidade",
    required: false,
    type: "Número inteiro",
    example: "50",
    hint: "Estoque inicial (padrão: 0)",
  },
  {
    name: "controle_estoque",
    label: "Controle estoque",
    required: false,
    type: "sim / não",
    example: "sim",
    hint: "Desconta do estoque a cada pedido",
  },
  {
    name: "visivel",
    label: "Visível",
    required: false,
    type: "sim / não",
    example: "sim",
    hint: "Se omitido, o item fica visível",
  },
] as const;

function generateRandomCode(existingCodes: string[] | Set<string>): string {
  const set =
    existingCodes instanceof Set ? existingCodes : new Set(existingCodes);
  let code = "";
  do {
    const length = Math.floor(Math.random() * 5) + 1;
    const num = Math.floor(Math.random() * Math.pow(10, length));
    code = String(num).padStart(length, "0");
  } while (set.has(code));
  return code;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvText(
  text: string,
  existingCodes: string[] = [],
): {
  rows: ParsedCsvItem[];
  errors: CsvParseError[];
  warnings: CsvParseError[];
} {
  const existingCodeSet = new Set(existingCodes.map((c) => c.toLowerCase()));
  const lines = text
    .replace(/^﻿/, "") // strip UTF-8 BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          message:
            "O arquivo está vazio ou não contém dados além do cabeçalho.",
        },
      ],
      warnings: [],
    };
  }
  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, "_"),
  );
  const missing = (["nome", "categoria", "preco"] as const).filter(
    (r) => !header.includes(r),
  );
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Colunas obrigatórias não encontradas: ${missing.map((m) => `"${m}"`).join(", ")}. Baixe o modelo e use-o como base.`,
        },
      ],
      warnings: [],
    };
  }
  const rows: ParsedCsvItem[] = [];
  const errors: CsvParseError[] = [];
  const warnings: CsvParseError[] = [];
  // tracks codes seen within this CSV to catch internal duplicates
  const seenCodes = new Map<string, number>(); // normalised code → line number
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = (vals[idx] ?? "").trim();
    });
    // Skip unfilled template rows — only the pre-generated code is present
    if (!row.nome && !row.categoria && !row.preco) continue;
    const errs: string[] = [];
    if (!row.nome) errs.push('"nome" é obrigatório');
    if (!row.categoria) errs.push('"categoria" é obrigatória');
    const preco = parseFloat((row.preco ?? "").replace(",", "."));
    if (!row.preco || isNaN(preco) || preco < 0)
      errs.push('"preco" inválido — use ponto como separador decimal (ex: 25.90)');
    if (errs.length) {
      errors.push({ line: i + 1, message: errs.join(" · ") });
      continue;
    }
    // Duplicate code within the CSV itself
    const codeKey = (row.codigo ?? "").toLowerCase();
    if (codeKey) {
      if (seenCodes.has(codeKey)) {
        errors.push({
          line: i + 1,
          message: `Código "${row.codigo}" repetido — já aparece na linha ${seenCodes.get(codeKey)}. Cada item deve ter um código único.`,
        });
        continue;
      }
      seenCodes.set(codeKey, i + 1);
      // Code already used by an existing system item
      if (existingCodeSet.has(codeKey)) {
        warnings.push({
          line: i + 1,
          message: `Código "${row.codigo}" já existe no sistema — um novo código será gerado automaticamente para este item.`,
        });
        row.codigo = ""; // cleared so handleSaveItemsBatch regenerates it
      }
    }
    const qty = parseInt(row.quantidade ?? "0");
    rows.push({
      nome: row.nome,
      categoria: row.categoria,
      descricao: row.descricao ?? "",
      codigo: row.codigo ?? "",
      preco,
      quantidade: isNaN(qty) ? 0 : Math.max(0, qty),
      controle_estoque: (row.controle_estoque ?? "").toLowerCase() === "sim",
      visivel: (row.visivel ?? "sim").toLowerCase() !== "não",
    });
  }
  return { rows, errors, warnings };
}

function downloadTemplateCsv(count: number, existingCodes: string[]) {
  // codigo comes first so the user can fill remaining columns left-to-right
  const TEMPLATE_COLUMNS = [
    "codigo",
    "nome",
    "categoria",
    "preco",
    "descricao",
    "quantidade",
    "controle_estoque",
    "visivel",
  ];
  const codeSet = new Set(existingCodes);
  const safeCount = Math.max(1, Math.min(500, count));
  const dataRows: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const code = generateRandomCode(codeSet);
    codeSet.add(code);
    // Only codigo is pre-filled; all other fields are empty
    const row = TEMPLATE_COLUMNS.map((col) => (col === "codigo" ? code : ""));
    dataRows.push(row.join(","));
  }
  const csv = `${TEMPLATE_COLUMNS.join(",")}\n${dataRows.join("\n")}`;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-itens.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({
  existing,
  allSubitems,
  categories,
  existingCodes,
  onSave,
  onBatchSave,
  onClose,
}: {
  existing?: StockItem;
  allSubitems: Subitem[];
  categories: string[];
  existingCodes: string[];
  onSave: (data: ItemForm, file: File | null | undefined) => Promise<void>;
  onBatchSave?: (
    rows: ParsedCsvItem[],
  ) => Promise<{ imported: number; failed: number }>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemForm>({
    codItem: existing?.codItem ?? "",
    name: existing?.name ?? "",
    category: existing?.category ?? "",
    description: existing?.description ?? "",
    value: existing?.value?.toString() ?? "",
    visibleValue: existing?.visibleValue?.toString() ?? "",
    quantity: existing?.quantity?.toString() ?? "0",
    isVisible: existing?.isVisible ?? true,
    isFeatured: existing?.isFeatured ?? false,
    isPromotion: existing?.isPromotion ?? false,
    promotionOriginalPrice: existing?.promotionOriginalPrice?.toString() ?? "",
    trackStock: existing?.trackStock ?? false,
    printTwice: existing?.printTwice ?? false,
    additionals: existing?.additionals ?? [],
    additionals_sauce: existing?.additionals_sauce ?? [],
    additionals_drink: existing?.additionals_drink ?? [],
    additionals_sweet: existing?.additionals_sweet ?? [],
  });
  const [photoFile, setPhotoFile] = useState<File | null | undefined>(
    undefined,
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  // CSV import tab state (only used when creating, not editing)
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsed, setCsvParsed] = useState<{
    rows: ParsedCsvItem[];
    errors: CsvParseError[];
    warnings: CsvParseError[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{
    imported: number;
    failed: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showExcelTip, setShowExcelTip] = useState(false);
  const [templateRowCount, setTemplateRowCount] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ItemForm>(k: K, v: ItemForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  async function handleSave() {
    const e: typeof errors = {};
    if (!form.codItem.trim()) e.codItem = "Código obrigatório";
    if (!form.name.trim()) e.name = "Nome obrigatório";
    if (!form.category.trim()) e.category = "Categoria obrigatória";
    if (!form.value || isNaN(parseFloat(form.value)))
      e.value = "Valor inválido";
    if (form.quantity === "" || isNaN(parseInt(form.quantity)))
      e.quantity = "Quantidade inválida";
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    await onSave(form, photoFile);
    setLoading(false);
  }

  function handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && !file.type.includes("csv"))
      return;
    setCsvFile(file);
    setCsvParsed(null);
    setImportDone(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvParsed(parseCsvText(text, existingCodes));
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (!onBatchSave || !csvParsed || csvParsed.rows.length === 0) return;
    setImporting(true);
    const result = await onBatchSave(csvParsed.rows);
    setImportDone(result);
    setImporting(false);
  }

  const isCreating = !existing;

  // Tab subheader — only shown when creating a new item
  const tabSubheader = isCreating ? (
    <div className="flex">
      {(["manual", "csv"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setActiveTab(t)}
          className="flex-1 py-3 text-sm font-medium cursor-pointer transition-colors"
          style={{
            color:
              activeTab === t
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
            borderBottom: `2px solid ${activeTab === t ? "var(--color-primary)" : "transparent"}`,
            backgroundColor: "transparent",
          }}
        >
          {t === "manual" ? "Criar manualmente" : "Importar via CSV"}
        </button>
      ))}
    </div>
  ) : undefined;

  // Footer — differs between tabs
  const footer = (() => {
    if (!isCreating || activeTab === "manual") {
      return (
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full h-10 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50 transition-all"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading
            ? "Salvando..."
            : existing
              ? "Salvar alterações"
              : "Criar item"}
        </button>
      );
    }
    // CSV tab footer
    if (importDone) {
      return (
        <button
          onClick={onClose}
          className="w-full h-10 rounded-md text-sm font-medium text-white cursor-pointer"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Fechar
        </button>
      );
    }
    const canImport =
      csvParsed && csvParsed.rows.length > 0 && csvParsed.errors.length === 0;
    return (
      <button
        onClick={handleImport}
        disabled={!canImport || importing}
        className="w-full h-10 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-40 transition-all"
        style={{
          backgroundColor: canImport
            ? "var(--color-primary)"
            : "var(--color-bg-elevated)",
          color: canImport ? "white" : "var(--color-text-muted)",
          border: canImport ? "none" : "1px solid var(--color-border)",
        }}
      >
        {importing
          ? "Importando..."
          : csvParsed && csvParsed.rows.length > 0
            ? `Importar ${csvParsed.rows.length} item${csvParsed.rows.length !== 1 ? "s" : ""}`
            : "Selecione um arquivo CSV para continuar"}
      </button>
    );
  })();

  return (
    <Modal
      title={existing ? "Editar item" : "Novo item"}
      onClose={onClose}
      wide
      subheader={tabSubheader}
      footer={footer}
    >
      {(!isCreating || activeTab === "manual") && (
        <>
          <Section title="Informações básicas" />
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    label="Código do item"
                    placeholder="Ex: 001"
                    value={form.codItem}
                    onChange={(e) => set("codItem", e.target.value)}
                    error={errors.codItem}
                    autoFocus
                  />
                </div>
                {!existing && (
                  <button
                    type="button"
                    onClick={() => {
                      const code = generateRandomCode([
                        ...existingCodes,
                        ...generatedCodes,
                      ]);

                      setGeneratedCodes((prev) => [...prev, code]);
                      set("codItem", code);
                    }}
                    className="h-10 px-3 text-xs font-medium rounded-[var(--radius-md)] cursor-pointer transition-all flex-shrink-0"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--color-primary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--color-border)")
                    }
                    title="Gerar próximo código disponível"
                  >
                    Gerar
                  </button>
                )}
              </div>
            </div>
            <Input
              label="Quantidade"
              type="number"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              error={errors.quantity}
            />
          </div>
          <Input
            label="Nome"
            placeholder="Nome do item"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
          />
          <Input
            label="Descrição"
            placeholder="Descrição do item"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
          <CategoryInput
            value={form.category}
            onChange={(v) => {
              set("category", v);
              setErrors((p) => ({ ...p, category: undefined }));
            }}
            categories={categories}
            error={errors.category}
          />

          <Section title="Preço" />
          <div className="grid grid-cols-2 items-end gap-3">
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              error={errors.value}
            />
            <Input
              label="Valor visível ao cliente (opcional)"
              type="number"
              step="0.01"
              placeholder="0,00 — deixe vazio para usar o valor acima"
              value={form.visibleValue}
              onChange={(e) => set("visibleValue", e.target.value)}
            />
          </div>

          {/* Promoção */}
          <div
            className="rounded-[var(--radius-md)] transition-all"
            style={{
              border: `1px solid ${form.isPromotion ? "rgba(239,68,68,0.4)" : "var(--color-border)"}`,
              backgroundColor: form.isPromotion
                ? "rgba(239,68,68,0.06)"
                : "var(--color-bg-elevated)",
            }}
          >
            <div className="flex items-center gap-2 px-3 py-3 select-none">
              <button
                type="button"
                onClick={() => set("isPromotion", !form.isPromotion)}
                className="flex items-center gap-2 flex-1 min-w-0 text-sm cursor-pointer"
                style={{
                  color: form.isPromotion
                    ? "var(--color-error)"
                    : "var(--color-text-secondary)",
                }}
              >
                <FiTag size={14} className="flex-shrink-0" />
                <span className="truncate">
                  {form.isPromotion ? "Em promoção" : "Sem promoção"}
                </span>
              </button>
              <InfoTooltip
                align="right"
                text="Marca o item como em promoção. Informe o preço original para que o cliente veja o desconto com o valor riscado."
              />
            </div>
            {form.isPromotion && (
              <div
                className="px-3 pt-3 pb-3"
                style={{ borderTop: "1px solid rgba(239,68,68,0.2)" }}
              >
                <Input
                  label="Preço original (antes da promoção)"
                  type="number"
                  step="0.01"
                  placeholder="0,00 — exibido riscado para o cliente"
                  value={form.promotionOriginalPrice}
                  onChange={(e) =>
                    set("promotionOriginalPrice", e.target.value)
                  }
                />
              </div>
            )}
          </div>

          <Section title="Configurações" />
          <div className="grid grid-cols-2 gap-2">
            {/* Visível */}
            <div
              className="flex items-center gap-2 h-10 px-3 rounded-[var(--radius-md)] cursor-pointer transition-all select-none"
              style={{
                backgroundColor: form.isVisible
                  ? "rgba(34,197,94,0.1)"
                  : "var(--color-bg-elevated)",
                border: `1px solid ${form.isVisible ? "var(--color-success)" : "var(--color-border)"}`,
              }}
            >
              <button
                type="button"
                onClick={() => set("isVisible", !form.isVisible)}
                className="flex items-center gap-2 flex-1 min-w-0 text-sm cursor-pointer"
                style={{
                  color: form.isVisible
                    ? "var(--color-success)"
                    : "var(--color-text-secondary)",
                }}
              >
                {form.isVisible ? (
                  <FiEye size={14} className="flex-shrink-0" />
                ) : (
                  <FiEyeOff size={14} className="flex-shrink-0" />
                )}
                <span className="truncate">
                  {form.isVisible ? "Visível" : "Oculto"}
                </span>
              </button>
              <InfoTooltip
                align="left"
                text="Controla se este item aparece ou não no cardápio. Itens ocultos não podem ser pedidos pelos clientes."
              />
            </div>

            {/* Destaque */}
            <div
              className="flex items-center gap-2 h-10 px-3 rounded-[var(--radius-md)] cursor-pointer transition-all select-none"
              style={{
                backgroundColor: form.isFeatured
                  ? "rgba(245,158,11,0.12)"
                  : "var(--color-bg-elevated)",
                border: `1px solid ${form.isFeatured ? "var(--color-warning)" : "var(--color-border)"}`,
              }}
            >
              <button
                type="button"
                onClick={() => set("isFeatured", !form.isFeatured)}
                className="flex items-center gap-2 flex-1 min-w-0 text-sm cursor-pointer"
                style={{
                  color: form.isFeatured
                    ? "var(--color-warning)"
                    : "var(--color-text-secondary)",
                }}
              >
                <FiStar size={14} className="flex-shrink-0" />
                <span className="truncate">
                  {form.isFeatured ? "Destaque" : "Sem destaque"}
                </span>
              </button>
              <InfoTooltip
                align="right"
                text="Itens em destaque aparecem no topo da sua própria seção no cardápio, com maior visibilidade."
              />
            </div>

            {/* Controle de estoque */}
            <div
              className="flex items-center gap-2 h-10 px-3 rounded-[var(--radius-md)] cursor-pointer transition-all select-none"
              style={{
                backgroundColor: form.trackStock
                  ? "rgba(0,136,194,0.12)"
                  : "var(--color-bg-elevated)",
                border: `1px solid ${form.trackStock ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              <button
                type="button"
                onClick={() => set("trackStock", !form.trackStock)}
                className="flex items-center gap-2 flex-1 min-w-0 text-sm cursor-pointer"
                style={{
                  color: form.trackStock
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                }}
              >
                <FiPackage size={14} className="flex-shrink-0" />
                <span className="truncate">
                  {form.trackStock ? "Com Ctrl. estoque" : "Sem controle"}
                </span>
              </button>
              <InfoTooltip
                align="left"
                text="Essa opção ativa o controle de estoque do item. Cada pedido desconta 1 da quantidade. Ao cancelar, o estoque é restaurado. Ao chegar a 0, o item é ocultado automaticamente."
              />
            </div>

            {/* Impressão 2x */}
            <div
              className="flex items-center gap-2 h-10 px-3 rounded-[var(--radius-md)] cursor-pointer transition-all select-none"
              style={{
                backgroundColor: form.printTwice
                  ? "rgba(168,85,247,0.12)"
                  : "var(--color-bg-elevated)",
                border: `1px solid ${form.printTwice ? "rgba(168,85,247,0.5)" : "var(--color-border)"}`,
              }}
            >
              <button
                type="button"
                onClick={() => set("printTwice", !form.printTwice)}
                className="flex items-center gap-2 flex-1 min-w-0 text-sm cursor-pointer"
                style={{
                  color: form.printTwice
                    ? "rgb(168,85,247)"
                    : "var(--color-text-secondary)",
                }}
              >
                <FiPrinter size={14} className="flex-shrink-0" />
                <span className="truncate">
                  {form.printTwice ? "Imprime 2x" : "Impressão normal"}
                </span>
              </button>
              <InfoTooltip
                align="right"
                text="Quando chega uma comanda que tenha ao menos UM item com essa opção ativa, a comanda é impressa em duas vias automaticamente. Caso tenha apenas itens com essa opção ativa, então ele imprime apenas uma via normalmente."
              />
            </div>
          </div>

          <Section title="Foto" />
          <PhotoUpload
            current={existing?.photo}
            onFileSelected={setPhotoFile}
          />

          <Section title="Adicionais / Subitens" />
          <div className="flex flex-col gap-4">
            {ADDITIONAL_GROUPS.map((g) => (
              <SubitemPicker
                key={g.key}
                label={g.label}
                allSubitems={allSubitems}
                selected={form[g.key] as string[]}
                onChange={(ids) => set(g.key, ids)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Aba CSV ── */}
      {isCreating && activeTab === "csv" && (
        <>
          {importDone ? (
            /* Resultado da importação */
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor:
                    importDone.imported > 0
                      ? "rgba(34,197,94,0.12)"
                      : "rgba(239,68,68,0.12)",
                }}
              >
                {importDone.imported > 0 ? (
                  <FiCheck
                    size={26}
                    style={{ color: "var(--color-success)" }}
                  />
                ) : (
                  <FiAlertCircle
                    size={26}
                    style={{ color: "var(--color-error)" }}
                  />
                )}
              </div>
              <div>
                <p
                  className="text-base font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {importDone.imported > 0
                    ? "Importação concluída!"
                    : "Nenhum item importado"}
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span
                    style={{ color: "var(--color-success)", fontWeight: 600 }}
                  >
                    {importDone.imported}
                  </span>{" "}
                  item{importDone.imported !== 1 ? "s" : ""} criado
                  {importDone.imported !== 1 ? "s" : ""} com sucesso
                  {importDone.failed > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <span
                        style={{ color: "var(--color-error)", fontWeight: 600 }}
                      >
                        {importDone.failed}
                      </span>{" "}
                      com falha
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : csvFile === null ? (
            /* Estado inicial: instruções + tabela + dropzone */
            <>
              {/* Intro */}
              <div
                className="flex items-start gap-3 p-4 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: "rgba(0,136,194,0.07)",
                  border: "1px solid rgba(0,136,194,0.2)",
                }}
              >
                <FiInfo
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--color-primary)" }}
                />
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Importe vários itens de uma só vez
                  </p>
                  <p
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Ideal para configurar o cardápio rapidamente. Monte uma
                    planilha no Excel ou Google Sheets usando o modelo abaixo e
                    importe todos os itens com um clique.
                  </p>
                </div>
              </div>

              {/* Passos */}
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Como funciona
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {(
                    [
                      {
                        n: 1,
                        title: "Baixe o modelo",
                        desc: "Planilha pronta com exemplos",
                      },
                      {
                        n: 2,
                        title: "Preencha os dados",
                        desc: "No Excel ou Google Sheets",
                      },
                      {
                        n: 3,
                        title: "Salve como CSV",
                        desc: "Arquivo → Salvar como → CSV",
                      },
                      {
                        n: 4,
                        title: "Carregue aqui",
                        desc: "Arraste ou clique abaixo",
                      },
                    ] as const
                  ).map(({ n, title, desc }) => (
                    <div
                      key={n}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          color: "white",
                        }}
                      >
                        {n}
                      </div>
                      <p
                        className="text-xs font-semibold leading-tight"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {title}
                      </p>
                      <p
                        className="text-[10px] leading-tight"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dica: como formatar no Excel / Google Sheets */}
              <div className="rounded">
                <button
                  onClick={() => setShowExcelTip((v) => !v)}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-left cursor-pointer transition-colors"
                  style={{ backgroundColor: "var(--color-bg-elevated)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-bg-surface)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-bg-elevated)")
                  }
                >
                  <span
                    className="flex items-center gap-2 text-xs font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    📊 Como abrir e salvar o CSV corretamente no Excel e Google
                    Sheets
                  </span>
                  <FiChevronDown
                    size={14}
                    className="shrink-0 transition-transform"
                    style={{
                      color: "var(--color-text-muted)",
                      transform: showExcelTip
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </button>

                {showExcelTip && (
                  <div
                    className="flex flex-col gap-4 px-4 py-4"
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    {/* Aviso */}
                    <div
                      className="flex items-start gap-2 p-3 rounded-[var(--radius-sm)]"
                      style={{
                        backgroundColor: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.25)",
                      }}
                    >
                      <FiAlertTriangle
                        size={13}
                        className="shrink-0 mt-0.5"
                        style={{ color: "var(--color-warning)" }}
                      />
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <strong style={{ color: "var(--color-warning)" }}>
                          Atenção:
                        </strong>{" "}
                        não abra o arquivo dando dois cliques nele. Isso pode
                        fazer o Excel usar <strong>ponto-e-vírgula (;)</strong>{" "}
                        como separador em vez de vírgula (,), o que vai causar
                        erro na importação.
                      </p>
                    </div>

                    {/* Google Sheets */}
                    <div>
                      <p
                        className="text-xs font-semibold mb-2"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        Google Sheets{" "}
                        <span
                          className="font-normal ml-1 px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            backgroundColor: "rgba(34,197,94,0.1)",
                            color: "var(--color-success)",
                          }}
                        >
                          Recomendado — mais simples
                        </span>
                      </p>
                      <ol className="flex flex-col gap-1.5">
                        {[
                          <>
                            Acesse <strong>sheets.google.com</strong> e crie uma
                            planilha em branco
                          </>,
                          <>
                            Arraste o arquivo CSV baixado para dentro da página
                            — ele abre automaticamente em colunas
                          </>,
                          <>Preencha os dados nas colunas</>,
                          <>
                            Para salvar:{" "}
                            <strong>
                              Arquivo → Fazer download → Valores separados por
                              vírgula (.csv)
                            </strong>
                          </>,
                        ].map((step, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            <span
                              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                              style={{
                                backgroundColor: "var(--color-bg-elevated)",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Divisor */}
                    <div
                      style={{ borderTop: "1px solid var(--color-border)" }}
                    />

                    {/* Excel */}
                    <div>
                      <p
                        className="text-xs font-semibold mb-2"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        Microsoft Excel
                      </p>
                      <ol className="flex flex-col gap-1.5">
                        {[
                          <>Abra o Excel e crie uma planilha em branco</>,
                          <>
                            Clique na aba <strong>Dados</strong> →{" "}
                            <strong>De Texto/CSV</strong> → selecione o arquivo
                            baixado
                          </>,
                          <>
                            Na janela que abrir, confirme que o{" "}
                            <strong>
                              Delimitador é {"'"}Vírgula{"'"}
                            </strong>{" "}
                            e clique em <strong>Carregar</strong>
                          </>,
                          <>Preencha os dados nas colunas</>,
                          <>
                            Para salvar: <strong>Arquivo → Salvar como</strong>{" "}
                            → escolha o tipo{" "}
                            <strong>
                              {"'"}CSV UTF-8 (delimitado por vírgulas){"'"}
                            </strong>
                          </>,
                        ].map((step, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            <span
                              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                              style={{
                                backgroundColor: "var(--color-bg-elevated)",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                      <p
                        className="text-[11px] mt-3 leading-relaxed"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        💡 Na dúvida sobre o tipo ao salvar, escolha sempre a
                        opção que menciona{" "}
                        <strong>
                          {"'"}vírgula{"'"}
                        </strong>{" "}
                        ou{" "}
                        <strong>
                          {"'"}comma{"'"}
                        </strong>{" "}
                        no nome.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela de colunas */}
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Estrutura do arquivo — nomes das colunas no cabeçalho
                </p>
                <div
                  className="rounded-[var(--radius-md)] overflow-hidden"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <div
                    className="grid gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: "1fr 1fr 1fr auto",
                      backgroundColor: "var(--color-bg-elevated)",
                      color: "var(--color-text-muted)",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <span>Coluna</span>
                    <span>Tipo de dado</span>
                    <span>Exemplo</span>
                    <span>Req.</span>
                  </div>
                  {CSV_COLUMNS.map((col, idx) => (
                    <div
                      key={col.name}
                      className="grid items-center gap-2 px-3 py-2 text-xs"
                      style={{
                        gridTemplateColumns: "1fr 1fr 1fr auto",
                        borderBottom:
                          idx < CSV_COLUMNS.length - 1
                            ? "1px solid var(--color-border)"
                            : "none",
                        backgroundColor:
                          idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                      }}
                    >
                      <code
                        className="px-1.5 py-0.5 rounded text-[11px] font-mono w-fit"
                        style={{
                          backgroundColor: "var(--color-bg-elevated)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {col.name}
                      </code>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {col.type}
                      </span>
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {col.example || "—"}
                      </span>
                      {col.required ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit"
                          style={{
                            backgroundColor: "rgba(239,68,68,0.1)",
                            color: "var(--color-error)",
                          }}
                        >
                          Sim
                        </span>
                      ) : (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] w-fit"
                          style={{
                            backgroundColor: "var(--color-bg-elevated)",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          Não
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p
                  className="text-[11px] mt-2 leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  💡 A <strong>primeira linha</strong> deve ter exatamente os
                  nomes de coluna acima. Campos marcados como{" "}
                  <span
                    style={{ color: "var(--color-error)", fontWeight: 600 }}
                  >
                    Sim
                  </span>{" "}
                  não podem ficar vazios.
                </p>
                <p
                  className="text-[11px] mt-1.5 leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ℹ️ Foto, promoções, destaque, adicionais e subitens não são
                  suportados no CSV — configure-os em cada item após a importação.
                </p>
              </div>

              {/* Botão baixar modelo */}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 px-3 h-10 rounded-[var(--radius-md)] shrink-0"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <span
                    className="text-xs whitespace-nowrap"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Linhas:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={templateRowCount}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) setTemplateRowCount(Math.max(1, Math.min(500, v)));
                    }}
                    className="w-14 text-sm text-center bg-transparent outline-none"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => downloadTemplateCsv(templateRowCount, existingCodes)}
                  className="flex flex-1 items-center justify-center gap-2 py-1 h-10 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-bg-elevated)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <FiDownload size={14} />
                  Baixar modelo CSV
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleCsvFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-10 rounded-[var(--radius-md)] cursor-pointer transition-all"
                style={{
                  border: `2px dashed ${dragOver ? "var(--color-primary)" : "var(--color-border)"}`,
                  backgroundColor: dragOver
                    ? "rgba(0,136,194,0.05)"
                    : "var(--color-bg-elevated)",
                }}
              >
                <FiUpload
                  size={22}
                  style={{
                    color: dragOver
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)",
                  }}
                />
                <p
                  className="text-sm font-medium"
                  style={{
                    color: dragOver
                      ? "var(--color-primary)"
                      : "var(--color-text-primary)",
                  }}
                >
                  Arraste o arquivo CSV aqui
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ou clique para selecionar do computador
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFile(f);
                  }}
                />
              </div>
            </>
          ) : csvParsed === null ? (
            /* Lendo arquivo */
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "var(--color-primary)",
                  borderTopColor: "transparent",
                }}
              />
              <p
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Lendo arquivo...
              </p>
            </div>
          ) : csvParsed.errors.length > 0 && csvParsed.rows.length === 0 ? (
            /* Erros fatais — nenhuma linha válida */
            <>
              <div
                className="flex items-start gap-3 p-4 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: "rgba(239,68,68,0.07)",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <FiAlertCircle
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--color-error)" }}
                />
                <div>
                  <p
                    className="text-sm font-semibold mb-1.5"
                    style={{ color: "var(--color-error)" }}
                  >
                    Arquivo inválido — não foi possível ler os dados
                  </p>
                  {csvParsed.errors.map((e, i) => (
                    <p
                      key={i}
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {e.line > 0 ? `Linha ${e.line}: ` : ""}
                      {e.message}
                    </p>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setCsvFile(null);
                  setCsvParsed(null);
                }}
                className="text-xs cursor-pointer transition-opacity hover:opacity-70 underline self-start"
                style={{ color: "var(--color-text-muted)" }}
              >
                Remover arquivo e tentar novamente
              </button>
            </>
          ) : (
            /* Preview dos itens válidos */
            <>
              {csvParsed.errors.length > 0 ? (
                <div
                  className="flex items-start gap-3 p-3 rounded-[var(--radius-md)]"
                  style={{
                    backgroundColor: "rgba(245,158,11,0.07)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <FiAlertTriangle
                    size={15}
                    className="shrink-0 mt-0.5"
                    style={{ color: "var(--color-warning)" }}
                  />
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--color-warning)" }}
                    >
                      {csvParsed.errors.length} linha
                      {csvParsed.errors.length !== 1 ? "s" : ""} com erro —
                      corrija e carregue novamente
                    </p>
                    {csvParsed.errors.map((e, i) => (
                      <p
                        key={i}
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Linha {e.line}: {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]"
                  style={{
                    backgroundColor: "rgba(34,197,94,0.07)",
                    border: "1px solid rgba(34,197,94,0.25)",
                  }}
                >
                  <FiCheck
                    size={15}
                    className="shrink-0"
                    style={{ color: "var(--color-success)" }}
                  />
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-success)" }}
                  >
                    {csvParsed.rows.length} item
                    {csvParsed.rows.length !== 1 ? "s" : ""} encontrado
                    {csvParsed.rows.length !== 1 ? "s" : ""} — prontos para
                    importar
                  </p>
                </div>
              )}

              {/* Avisos não-bloqueantes (ex: código já existente) */}
              {csvParsed.warnings.length > 0 && (
                <div
                  className="flex items-start gap-3 p-3 rounded-[var(--radius-md)]"
                  style={{
                    backgroundColor: "rgba(99,102,241,0.07)",
                    border: "1px solid rgba(99,102,241,0.25)",
                  }}
                >
                  <FiInfo
                    size={15}
                    className="shrink-0 mt-0.5"
                    style={{ color: "var(--color-primary)" }}
                  />
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {csvParsed.warnings.length} aviso
                      {csvParsed.warnings.length !== 1 ? "s" : ""} — a importação prosseguirá normalmente
                    </p>
                    {csvParsed.warnings.map((w, i) => (
                      <p
                        key={i}
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Linha {w.line}: {w.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela de preview */}
              <div
                className="rounded-[var(--radius-md)] overflow-hidden"
                style={{ border: "1px solid var(--color-border)" }}
              >
                {/* cabeçalho */}
                <div
                  className="grid text-[10px] font-semibold uppercase tracking-wider px-3 py-2"
                  style={{
                    gridTemplateColumns: "64px 1fr 1fr 80px 44px 56px 52px",
                    gap: "8px",
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text-muted)",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <span>Código</span>
                  <span>Nome</span>
                  <span>Categoria</span>
                  <span className="text-right">Preço</span>
                  <span className="text-right">Qtd.</span>
                  <span className="text-center">Estoque</span>
                  <span className="text-center">Visível</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {csvParsed.rows.map((row, i) => (
                    <div
                      key={i}
                      className="grid items-center px-3 py-2 text-xs"
                      style={{
                        gridTemplateColumns: "64px 1fr 1fr 80px 44px 56px 52px",
                        gap: "8px",
                        borderBottom:
                          i < csvParsed.rows.length - 1
                            ? "1px solid var(--color-border)"
                            : "none",
                      }}
                    >
                      <span
                        className="truncate font-mono"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {row.codigo || <span style={{ color: "var(--color-text-muted)", opacity: 0.4 }}>auto</span>}
                      </span>
                      <span
                        className="truncate font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {row.nome}
                      </span>
                      <span
                        className="truncate"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {row.categoria}
                      </span>
                      <span className="text-right" style={{ color: "var(--color-text-primary)" }}>
                        {formatBRL(row.preco)}
                      </span>
                      <span className="text-right" style={{ color: "var(--color-text-muted)" }}>
                        {row.quantidade}
                      </span>
                      <span className="flex justify-center">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={
                            row.controle_estoque
                              ? { backgroundColor: "rgba(34,197,94,0.1)", color: "var(--color-success)" }
                              : { backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }
                          }
                        >
                          {row.controle_estoque ? "Sim" : "Não"}
                        </span>
                      </span>
                      <span className="flex justify-center">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={
                            row.visivel
                              ? { backgroundColor: "rgba(34,197,94,0.1)", color: "var(--color-success)" }
                              : { backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }
                          }
                        >
                          {row.visivel ? "Sim" : "Não"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setCsvFile(null);
                  setCsvParsed(null);
                }}
                className="text-xs cursor-pointer transition-opacity hover:opacity-70 underline self-start"
                style={{ color: "var(--color-text-muted)" }}
              >
                Remover arquivo
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ─── Subitem Card ─────────────────────────────────────────────────────────────

function SubitemCard({
  subitem,
  usedByItems,
  linkedItemHidden,
  onToggleVisibility,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  subitem: Subitem;
  usedByItems: StockItem[];
  linkedItemHidden?: boolean;
  onToggleVisibility: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="flex flex-col rounded-[var(--radius-lg)] overflow-hidden transition-all"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: `1px solid var(--color-border)`,
        opacity: subitem.isVisible ? 1 : 0.45,
      }}
    >
      {/* Linha principal */}
      <div className="flex items-center gap-3 p-3">
        <div
          className="w-10 h-10 rounded-[var(--radius-md)] overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "var(--color-bg-elevated)" }}
        >
          {subitem.photo ? (
            <img
              src={subitem.photo}
              alt={subitem.name}
              className="w-full h-full object-contain"
              style={{ backgroundColor: "var(--color-bg-base)" }}
            />
          ) : (
            <FiPackage size={16} style={{ color: "var(--color-text-muted)" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {subitem.name}
            </p>
            {!subitem.isVisible && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                style={{
                  backgroundColor: "rgba(82,88,112,0.25)",
                  color: "var(--color-text-muted)",
                }}
              >
                <FiEyeOff size={10} /> oculto
              </span>
            )}
            {subitem.linkedItemId && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                style={{
                  backgroundColor: "rgba(0,136,194,0.12)",
                  color: "var(--color-primary)",
                  border: "1px solid rgba(0,136,194,0.25)",
                }}
                title={`Vinculado ao estoque`}
              >
                <FiPackage size={10} /> Vínculo de estoque
              </span>
            )}
            {linkedItemHidden && subitem.isVisible && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                style={{
                  backgroundColor: "rgba(245,158,11,0.12)",
                  color: "var(--color-warning)",
                  border: "1px solid rgba(245,158,11,0.3)",
                }}
                title="O item vinculado está oculto, mas este subitem ainda está visível"
              >
                <FiAlertTriangle size={10} /> Item oculto
              </span>
            )}
          </div>
          {subitem.description && (
            <p
              className="text-xs truncate"
              style={{ color: "var(--color-text-muted)" }}
            >
              {subitem.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Botão de expandir */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
            style={{
              backgroundColor: expanded
                ? "var(--color-primary-light)"
                : "var(--color-bg-elevated)",
              color: expanded
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
            title={`Usado em ${usedByItems.length} item(s)`}
          >
            <FiList size={13} />
          </button>
          <ToggleBtn active={subitem.isVisible} onToggle={onToggleVisibility} />
          {canEdit && (
            <button
              onClick={onEdit}
              title="Editar"
              className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-border)")
              }
            >
              <FiEdit2 size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              title="Excluir"
              className="w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                color: "var(--color-error)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")
              }
            >
              <FiTrash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Painel expansível — itens que usam este subitem */}
      {expanded && (
        <div
          className="flex flex-col gap-1 px-3 pb-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wide pt-2.5 pb-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Usado em {usedByItems.length} item
            {usedByItems.length !== 1 ? "s" : ""}
          </p>
          {usedByItems.length === 0 ? (
            <p
              className="text-xs italic"
              style={{ color: "var(--color-text-muted)" }}
            >
              Nenhum item do cardápio utiliza este subitem.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {usedByItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-md)]"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {item.photo ? (
                    <img
                      src={item.photo}
                      alt={item.name}
                      className="w-6 h-6 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: "var(--color-bg-base)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <FiBox size={11} />
                    </div>
                  )}
                  <span
                    className="text-xs font-mono flex-shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    #{item.codItem}
                  </span>
                  <span
                    className="text-xs flex-1 min-w-0 truncate font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {item.name}
                  </span>
                  {!item.isVisible && (
                    <FiEyeOff
                      size={11}
                      style={{
                        color: "var(--color-text-muted)",
                        flexShrink: 0,
                      }}
                      title="Item oculto"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Visibility Cascade Modal ─────────────────────────────────────────────────

function VisibilityCascadeModal({
  item,
  nextVisible,
  linkedSubitems,
  selectedIds,
  saving,
  allItems,
  onToggleSubitem,
  onConfirm,
  onSkip,
  onClose,
}: {
  item: StockItem;
  nextVisible: boolean;
  linkedSubitems: Subitem[];
  selectedIds: Set<string>;
  saving: boolean;
  allItems: StockItem[];
  onToggleSubitem: (id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const action = nextVisible ? "exibir" : "ocultar";
  const actionPast = nextVisible ? "exibido" : "ocultado";
  const allSelected = linkedSubitems.every((s) => selectedIds.has(s.id));

  return (
    <Modal
      title={nextVisible ? "Exibir item" : "Ocultar item"}
      onClose={onClose}
    >
      {/* Descrição */}
      <div
        className="flex items-start gap-3 p-3 rounded-[var(--radius-md)]"
        style={{
          backgroundColor: nextVisible
            ? "rgba(34,197,94,0.08)"
            : "rgba(245,158,11,0.08)",
          border: `1px solid ${nextVisible ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.25)"}`,
        }}
      >
        <FiAlertTriangle
          size={16}
          className="flex-shrink-0 mt-0.5"
          style={{
            color: nextVisible
              ? "var(--color-success)"
              : "var(--color-warning)",
          }}
        />
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          O item <strong>{`"${item.name}"`}</strong> será {actionPast}.{" "}
          {linkedSubitems.length === 1
            ? "Há 1 subitem vinculado"
            : `Há ${linkedSubitems.length} subitens vinculados`}{" "}
          que {linkedSubitems.length === 1 ? "está" : "estão"} com visibilidade
          diferente. Deseja {action}
          {linkedSubitems.length === 1 ? "-lo" : "-los"} junto?
        </p>
      </div>

      {/* Lista de subitens */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-1">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Subitens vinculados
          </p>
          <button
            onClick={() =>
              linkedSubitems.forEach((s) => {
                const shouldSelect = !allSelected;
                if (shouldSelect !== selectedIds.has(s.id))
                  onToggleSubitem(s.id);
              })
            }
            className="text-xs cursor-pointer"
            style={{ color: "var(--color-primary)" }}
          >
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        </div>
        {linkedSubitems.map((s) => {
          const usedIn = allItems.filter((i) =>
            [
              ...i.additionals,
              ...i.additionals_sauce,
              ...i.additionals_drink,
              ...i.additionals_sweet,
            ].includes(s.id),
          );
          const checked = selectedIds.has(s.id);
          return (
            <div
              key={s.id}
              onClick={() => onToggleSubitem(s.id)}
              className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] cursor-pointer transition-all"
              style={{
                backgroundColor: checked
                  ? "var(--color-bg-elevated)"
                  : "var(--color-bg-surface)",
                border: `1px solid ${checked ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              {/* Checkbox */}
              <div
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: checked
                    ? "var(--color-primary)"
                    : "transparent",
                  border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-text-muted)"}`,
                }}
              >
                {checked && <FiCheck size={10} color="white" />}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {s.name}
                </p>
                {usedIn.length > 0 && (
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Usado em: {usedIn.map((i) => i.name).join(", ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onSkip}
          disabled={saving}
          className="flex-1 h-10 rounded-[var(--radius-md)] text-sm cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          Só o item
        </button>
        <button
          onClick={onConfirm}
          disabled={saving || selectedIds.size === 0}
          className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: nextVisible
              ? "var(--color-success)"
              : "var(--color-warning)",
            color: "white",
          }}
        >
          {saving
            ? "Salvando..."
            : `${nextVisible ? "Exibir" : "Ocultar"} selecionados`}
        </button>
      </div>
    </Modal>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  title,
  active,
  activeColor,
  activeBg,
  hoverColor,
  hoverBg,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
  activeBg?: string;
  hoverColor: string;
  hoverBg: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex-1 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-all"
      style={{
        color: active ? activeColor : "var(--color-text-muted)",
        backgroundColor: active ? activeBg : "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hoverColor;
        e.currentTarget.style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = active
          ? (activeColor ?? "")
          : "var(--color-text-muted)";
        e.currentTarget.style.backgroundColor = active
          ? (activeBg ?? "transparent")
          : "transparent";
      }}
    >
      {children}
    </button>
  );
}

function ItemCard({
  item,
  onToggleVisibility,
  onToggleFeatured,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  item: StockItem;
  onToggleVisibility: () => void;
  onToggleFeatured: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const stockColor =
    item.quantity <= 0
      ? "var(--color-error)"
      : item.quantity <= 5
        ? "var(--color-warning)"
        : "var(--color-success)";
  const stockBg =
    item.quantity <= 0
      ? "rgba(239,68,68,0.12)"
      : item.quantity <= 5
        ? "rgba(245,158,11,0.12)"
        : "rgba(34,197,94,0.1)";

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden flex flex-col"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        opacity: item.isVisible ? 1 : 0.35,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-primary)";
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,136,194,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* ── Image area ── */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: "1 / 1",
          backgroundColor: "var(--color-bg-base)",
        }}
      >
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo}
            alt={item.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FiBox size={36} style={{ color: "var(--color-border)" }} />
          </div>
        )}

        {/* Category gradient + label */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
          }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {item.category}
          </span>
        </div>

        {/* Top-left badges: Destaque + Promoção */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {item.isFeatured && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: "var(--color-warning)",
                color: "white",
                boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
              }}
            >
              <FiStar size={9} />
              Destaque
            </div>
          )}
          {item.isPromotion && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: "var(--color-error)",
                color: "white",
                boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
              }}
            >
              <FiTag size={9} />
              Promoção
            </div>
          )}
        </div>

        {/* Hidden badge
        {!item.isVisible && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "rgba(0,0,0,0.72)", color: "white" }}
          >
            <FiEyeOff size={9} />
            Oculto
          </div>
        )} */}

        {/* Badges top-right: stack vertically */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {!item.isVisible && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: "rgba(0,0,0,0.72)", color: "white" }}
            >
              <FiEyeOff size={9} />
              Oculto
            </div>
          )}
          {item.trackStock && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: "rgba(0,136,194,0.85)",
                color: "white",
                boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
              }}
              title="Controle de estoque ativo"
            >
              <FiTrendingDown size={9} />
              Stock
            </div>
          )}
          {item.printTwice && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: "rgba(168,85,247,0.85)",
                color: "white",
                boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
              }}
              title="Imprime 2 vias por comanda"
            >
              <FiPrinter size={9} />
              2x
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-2 flex-1">
        <p
          className="text-[10px] font-mono"
          style={{ color: "var(--color-text-muted)" }}
        >
          #{item.codItem}
        </p>

        <p
          className="text-sm font-semibold leading-snug line-clamp-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          {item.name}
        </p>

        {item.description && (
          <p
            className="text-xs line-clamp-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {item.description}
          </p>
        )}

        {/* Price + stock */}
        <div className="flex items-end justify-between mt-1">
          <div className="flex flex-col gap-0">
            {item.isPromotion && item.promotionOriginalPrice != null && (
              <span
                className="text-[10px] line-through"
                style={{ color: "var(--color-text-muted)" }}
              >
                {formatBRL(item.promotionOriginalPrice)}
              </span>
            )}
            <span
              className="text-base font-bold leading-tight"
              style={{
                color: item.isPromotion
                  ? "var(--color-error)"
                  : "var(--color-primary)",
              }}
            >
              {formatBRL(item.visibleValue ?? item.value)}
            </span>
            {item.visibleValue != null && item.visibleValue !== item.value && (
              <span
                className="text-[10px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                interno: {formatBRL(item.value)}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: stockBg, color: stockColor }}
          >
            <FiPackage size={10} />
            {item.quantity}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <ActionBtn
          onClick={onToggleFeatured}
          title={item.isFeatured ? "Remover destaque" : "Destacar"}
          active={item.isFeatured}
          activeColor="var(--color-warning)"
          activeBg="rgba(245,158,11,0.12)"
          hoverColor="var(--color-warning)"
          hoverBg="rgba(245,158,11,0.15)"
        >
          <FiStar size={13} />
        </ActionBtn>

        <ActionBtn
          onClick={onToggleVisibility}
          title={item.isVisible ? "Ocultar" : "Exibir"}
          active={item.isVisible}
          activeColor="var(--color-success)"
          activeBg="rgba(34,197,94,0.1)"
          hoverColor="var(--color-success)"
          hoverBg="rgba(34,197,94,0.15)"
        >
          {item.isVisible ? <FiEye size={13} /> : <FiEyeOff size={13} />}
        </ActionBtn>

        {(canEdit || canDelete) && (
          <div
            className="w-px h-4 mx-0.5 flex-shrink-0"
            style={{ backgroundColor: "var(--color-border)" }}
          />
        )}

        {canEdit && (
          <ActionBtn
            onClick={onEdit}
            title="Editar"
            hoverColor="var(--color-primary)"
            hoverBg="var(--color-primary-light)"
          >
            <FiEdit2 size={13} />
          </ActionBtn>
        )}

        {canDelete && (
          <ActionBtn
            onClick={onDelete}
            title="Excluir"
            hoverColor="var(--color-error)"
            hoverBg="rgba(239,68,68,0.1)"
          >
            <FiTrash2 size={13} />
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

// ─── Utilitários de módulo (fora de qualquer componente) ─────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="var(--color-primary)"
          strokeWidth="3"
        />
        <path
          className="opacity-80"
          fill="var(--color-primary)"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

async function deletePhotoFromStorage(url: string | null | undefined) {
  if (!url) return;
  try {
    const path = decodeURIComponent(url.split("/o/")[1]?.split("?")[0] ?? "");
    if (path) await deleteObject(storageRef(storage, path));
  } catch {
    // silently ignore — photo may not exist or already deleted
  }
}

async function uploadPhoto(file: File, folder: string): Promise<string> {
  const uid = crypto.randomUUID();
  const sRef = storageRef(storage, `${folder}/${uid}_${file.name}`);
  await uploadBytes(sRef, file);
  return getDownloadURL(sRef);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "items" | "subitems" | "categories";

function timeAgo(date: Date | null | undefined): string {
  if (!date) return "agora mesmo";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (diff < 60_000) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  if (hr < 24) return `há ${hr}h`;
  return `há ${day} dia${day !== 1 ? "s" : ""}`;
}

interface StockAlert {
  id: string;
  type: "zero_stock" | "low_stock";
  itemId: string;
  itemName: string;
  itemPhoto?: string;
  quantity: number;
  resolved: boolean;
  dismissedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

function AlertRow({
  alert,
  type,
  onOpen,
  onDismiss,
}: {
  alert: StockAlert;
  type: "zero" | "low";
  onOpen: (alertId: string, itemId: string) => void;
  onDismiss: (alertId: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{
          backgroundColor:
            type === "zero" ? "var(--color-error)" : "var(--color-warning)",
        }}
      />

      <button
        onClick={() => onOpen(alert.id, alert.itemId)}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer transition-opacity hover:opacity-75"
      >
        {alert.itemPhoto ? (
          <img
            src={alert.itemPhoto}
            alt={alert.itemName}
            className="w-8 h-8 rounded-[var(--radius-sm)] object-cover shrink-0"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--color-bg-elevated)" }}
          >
            <FiBox size={13} style={{ color: "var(--color-text-muted)" }} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {alert.itemName}
          </p>
          <p
            className="text-[10px] mt-0.5"
            style={{
              color:
                type === "zero" ? "var(--color-error)" : "var(--color-warning)",
            }}
          >
            {type === "zero"
              ? "Estoque zerado — item ocultado"
              : `${alert.quantity} unidade${alert.quantity !== 1 ? "s" : ""} restante${alert.quantity !== 1 ? "s" : ""}`}
          </p>
          <p
            className="text-[10px] mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            {timeAgo(alert.updatedAt)}
          </p>
        </div>
      </button>

      <button
        onClick={() => onDismiss(alert.id)}
        className="shrink-0 p-1 rounded cursor-pointer transition-opacity hover:opacity-70"
        style={{ color: "var(--color-text-muted)" }}
        title="Dispensar"
      >
        <FiX size={13} />
      </button>
    </div>
  );
}

export default function StockPage() {
  const { appUser } = useAuth();
  const { success, error, info } = useToast();
  const canAccess = can(appUser, "view_stock");
  const canCreateItem = can(appUser, "create_item");
  const canCreateSubitem = can(appUser, "create_subitem");
  const canEditItem = can(appUser, "edit_item");
  const canEditSubitem = can(appUser, "edit_subitem");
  const canDeleteItem = can(appUser, "delete_item");
  const canDeleteSubitem = can(appUser, "delete_subitem");
  const canManageCategoryOrder = can(appUser, "manage_category_order");
  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "?", username: "?" };

  // ── State ──
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<StockItem[]>([]);
  const [subitems, setSubitems] = useState<Subitem[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [stockNotifSettings, setStockNotifSettings] = useState({
    notifyZeroStock: true,
    notifyLowStock: true,
    lowStockThreshold: 5,
    showBadge: true,
  });
  const [savingNotifSettings, setSavingNotifSettings] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("5");
  const notifRef = useRef<HTMLDivElement>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [savedCategoryOrder, setSavedCategoryOrder] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingSubitems, setLoadingSubitems] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortQuantity, setSortQuantity] = useState<"none" | "asc" | "desc">(
    "none",
  );
  const [filterVisibility, setFilterVisibility] = useState<
    | "all"
    | "visible"
    | "hidden"
    | "printTwice"
    | "featured"
    | "trackStock"
    | "noTrackStock"
    | "promotion"
  >("all");

  // ── Modals ──
  const [itemModal, setItemModal] = useState<{
    open: boolean;
    editing?: StockItem;
  }>({ open: false });
  const [subitemModal, setSubitemModal] = useState<{
    open: boolean;
    editing?: Subitem;
  }>({ open: false });
  const [downloadModal, setDownloadModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<StockItem | null>(null);
  const [deleteSubitem, setDeleteSubitem] = useState<Subitem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [visibilityCascadeModal, setVisibilityCascadeModal] = useState<{
    item: StockItem;
    nextVisible: boolean;
    linkedSubitems: Subitem[];
    selectedIds: Set<string>;
    saving: boolean;
  } | null>(null);
  const [savingCategories, setSavingCategories] = useState(false);

  // ── Close notif dropdown on outside click ──
  useEffect(() => {
    if (!notifOpen) return;
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // ── Cleanup resolved alerts older than 7 days (runs once on mount) ──
  useEffect(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    getDocs(
      query(
        collection(db, "stockAlerts"),
        where("resolved", "==", true),
        where("createdAt", "<=", cutoff),
      ),
    )
      .then((snap) => {
        if (snap.empty) return;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        batch.commit().catch(() => {});
      })
      .catch(() => {});
  }, []);

  // ── Load notification settings ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "storeConfig", "stockNotifications"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const s = {
            notifyZeroStock: d.notifyZeroStock ?? true,
            notifyLowStock: d.notifyLowStock ?? true,
            lowStockThreshold: d.lowStockThreshold ?? 5,
            showBadge: d.showBadge ?? true,
          };
          setStockNotifSettings(s);
          setThresholdInput(String(s.lowStockThreshold));
        }
      },
    );
    return unsub;
  }, []);

  // ── Load stock alerts (unresolved only) ──
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "stockAlerts"),
        where("resolved", "==", false),
        orderBy("createdAt", "desc"),
      ),
      (snap) => {
        setStockAlerts(
          snap.docs.map((d) => ({
            id: d.id,
            type: d.data().type as StockAlert["type"],
            itemId: d.data().itemId,
            itemName: d.data().itemName,
            itemPhoto: d.data().itemPhoto ?? undefined,
            quantity: d.data().quantity ?? 0,
            resolved: false,
            dismissedBy: d.data().dismissedBy ?? [],
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
            updatedAt:
              d.data().updatedAt?.toDate() ??
              d.data().createdAt?.toDate() ??
              new Date(),
          })),
        );
      },
    );
    return unsub;
  }, []);

  async function saveNotifSettings(patch: Partial<typeof stockNotifSettings>) {
    setSavingNotifSettings(true);
    const next = { ...stockNotifSettings, ...patch };
    try {
      await setDoc(doc(db, "storeConfig", "stockNotifications"), next, {
        merge: true,
      });
    } catch {
      /* ignore */
    } finally {
      setSavingNotifSettings(false);
    }
  }

  // ── Load data ──
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingItems(true);
    const unsub = onSnapshot(
      query(collection(db, "items"), orderBy("createdAt", "desc")),
      (snap) => {
        const newItems = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            codItem: data.codItem ?? "",
            name: data.name ?? "",
            category: data.category ?? "",
            description: data.description ?? "",
            value: data.value ?? 0,
            visibleValue: data.visibleValue ?? undefined,
            quantity: data.quantity ?? 0,
            photo: data.photo ?? undefined,
            isVisible: data.isVisible ?? true,
            isFeatured: data.isFeatured ?? false,
            isPromotion: data.isPromotion ?? false,
            promotionOriginalPrice: data.promotionOriginalPrice ?? undefined,
            trackStock: data.trackStock ?? false,
            printTwice: data.printTwice ?? false,
            additionals: data.additionals ?? [],
            additionals_sauce: data.additionals_sauce ?? [],
            additionals_drink: data.additionals_drink ?? [],
            additionals_sweet: data.additionals_sweet ?? [],
            createdAt: data.createdAt?.toDate() ?? new Date(),
          } as StockItem;
        });

        setItems(newItems);
        setLoadingItems(false);
      },
      () => {
        error("Erro ao carregar itens", "Tente recarregar.");
        setLoadingItems(false);
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    async function load() {
      setLoadingSubitems(true);
      try {
        const snap = await getDocs(
          query(collection(db, "subitems"), orderBy("createdAt", "asc")),
        );
        setSubitems(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name,
            description: d.data().description,
            isVisible: d.data().isVisible ?? true,
            photo: d.data().photo,
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
            linkedItemId: d.data().linkedItemId ?? undefined,
          })),
        );
      } catch {
        error("Erro ao carregar subitens", "Tente recarregar.");
      } finally {
        setLoadingSubitems(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function load() {
      setLoadingCategories(true);
      try {
        const snap = await getDoc(doc(db, "stockConfig", "categoryOrder"));
        if (snap.exists()) {
          const cats = snap.data().categories ?? [];
          setCategoryOrder(cats);
          setSavedCategoryOrder(cats);
        }
      } catch {
        /* silent */
      } finally {
        setLoadingCategories(false);
      }
    }
    load();
  }, []);

  // ── Computed ──
  const allCategories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean)),
  );
  const filteredItems = items
    .filter((i) => {
      const matchSearch =
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.codItem.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase());
      const matchCat =
        filterCategory === "all" || i.category === filterCategory;
      const matchVis = (() => {
        switch (filterVisibility) {
          case "visible":
            return i.isVisible;
          case "hidden":
            return !i.isVisible;
          case "printTwice":
            return i.printTwice === true;
          case "featured":
            return i.isFeatured === true;
          case "trackStock":
            return i.trackStock === true;
          case "noTrackStock":
            return i.trackStock !== true;
          case "promotion":
            return i.isPromotion === true;
          default:
            return true;
        }
      })();
      return matchSearch && matchCat && matchVis;
    })
    .sort((a, b) => {
      if (sortQuantity === "asc") return a.quantity - b.quantity;
      if (sortQuantity === "desc") return b.quantity - a.quantity;
      return 0;
    });
  const filteredSubitems = subitems.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Item actions ──
  async function handleSaveItem(form: ItemForm, file: File | null | undefined) {
    try {
      const codConflict = items.find(
        (i) =>
          i.codItem === form.codItem.trim() &&
          i.id !== (itemModal.editing?.id ?? ""),
      );
      if (codConflict) {
        error(
          "Código duplicado",
          `"${form.codItem}" já pertence a "${codConflict.name}".`,
        );
        return;
      }

      const oldPhoto = itemModal.editing?.photo;
      let photoUrl: string | null | undefined = oldPhoto;
      if (file instanceof File) {
        if (oldPhoto) await deletePhotoFromStorage(oldPhoto);
        photoUrl = await uploadPhoto(file, "items");
      } else if (file === null) {
        await deletePhotoFromStorage(oldPhoto);
        photoUrl = null;
      }
      // file === undefined means no change — keep photoUrl as-is

      const data = {
        codItem: form.codItem.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        value: parseFloat(form.value),
        visibleValue: form.visibleValue ? parseFloat(form.visibleValue) : null,
        quantity: parseInt(form.quantity),
        photo: photoUrl ?? null,
        isVisible: form.isVisible,
        isFeatured: form.isFeatured,
        isPromotion: form.isPromotion,
        promotionOriginalPrice:
          form.isPromotion && form.promotionOriginalPrice
            ? parseFloat(form.promotionOriginalPrice)
            : null,
        trackStock: form.trackStock,
        printTwice: form.printTwice,
        additionals: form.additionals,
        additionals_sauce: form.additionals_sauce,
        additionals_drink: form.additionals_drink,
        additionals_sweet: form.additionals_sweet,
      };

      if (itemModal.editing) {
        const old = itemModal.editing;

        // Compute diff
        const changes: {
          field: string;
          from: string | null;
          to: string | null;
        }[] = [];
        if (data.codItem !== old.codItem)
          changes.push({
            field: "Código",
            from: old.codItem,
            to: data.codItem,
          });
        if (data.name !== old.name)
          changes.push({ field: "Nome", from: old.name, to: data.name });
        if (data.category !== old.category)
          changes.push({
            field: "Tipo",
            from: old.category,
            to: data.category,
          });
        if (data.description !== old.description)
          changes.push({
            field: "Descrição",
            from: old.description || null,
            to: data.description || null,
          });
        if (data.value !== old.value)
          changes.push({
            field: "Valor",
            from: formatBRL(old.value),
            to: formatBRL(data.value),
          });
        if ((data.visibleValue ?? null) !== (old.visibleValue ?? null))
          changes.push({
            field: "Valor cliente",
            from: old.visibleValue != null ? formatBRL(old.visibleValue) : null,
            to: data.visibleValue != null ? formatBRL(data.visibleValue) : null,
          });
        if (data.quantity !== old.quantity)
          changes.push({
            field: "Quantidade",
            from: String(old.quantity),
            to: String(data.quantity),
          });
        if (data.isVisible !== old.isVisible)
          changes.push({
            field: "Visível",
            from: old.isVisible ? "Sim" : "Não",
            to: data.isVisible ? "Sim" : "Não",
          });
        if (data.isFeatured !== old.isFeatured)
          changes.push({
            field: "Destaque",
            from: old.isFeatured ? "Sim" : "Não",
            to: data.isFeatured ? "Sim" : "Não",
          });
        if (data.trackStock !== old.trackStock)
          changes.push({
            field: "Controle de estoque",
            from: old.trackStock ? "Sim" : "Não",
            to: data.trackStock ? "Sim" : "Não",
          });

        if (data.printTwice !== old.printTwice)
          changes.push({
            field: "Impressão 2x",
            from: old.printTwice ? "Sim" : "Não",
            to: data.printTwice ? "Sim" : "Não",
          });
        if (data.isPromotion !== (old.isPromotion ?? false))
          changes.push({
            field: "Promoção",
            from: old.isPromotion ? "Sim" : "Não",
            to: data.isPromotion ? "Sim" : "Não",
          });
        if (
          (data.promotionOriginalPrice ?? null) !==
          (old.promotionOriginalPrice ?? null)
        )
          changes.push({
            field: "Preço original (promoção)",
            from:
              old.promotionOriginalPrice != null
                ? formatBRL(old.promotionOriginalPrice)
                : null,
            to:
              data.promotionOriginalPrice != null
                ? formatBRL(data.promotionOriginalPrice)
                : null,
          });
        if (file)
          changes.push({
            field: "Foto",
            from: old.photo ? "foto anterior" : null,
            to: "atualizada",
          });

        // Additionals diff
        const addGroups = [
          { key: "additionals" as const, label: "Gerais" },
          { key: "additionals_sauce" as const, label: "Molhos" },
          { key: "additionals_drink" as const, label: "Bebidas" },
          { key: "additionals_sweet" as const, label: "Doces" },
        ];
        for (const g of addGroups) {
          const oldIds = [...(old[g.key] ?? [])].sort().join(",");
          const newIds = [...(data[g.key] ?? [])].sort().join(",");
          if (oldIds !== newIds) {
            const oldCount = (old[g.key] ?? []).length;
            const newCount = (data[g.key] ?? []).length;
            changes.push({
              field: `Adicionais ${g.label}`,
              from: `${oldCount} item${oldCount !== 1 ? "s" : ""}`,
              to: `${newCount} item${newCount !== 1 ? "s" : ""}`,
            });
          }
        }

        await updateDoc(doc(db, "items", old.id), data);
        success("Item atualizado", `"${data.name}" foi salvo.`);
        log({
          action: "update_item",
          category: "stock",
          description: `Atualizou o item "${data.name}"`,
          performedBy: actor,
          target: { type: "item", id: old.id, name: data.name },
          changes: changes.length > 0 ? changes : undefined,
        });
      } else {
        const ref = await addDoc(collection(db, "items"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        success("Item criado", `"${data.name}" foi adicionado ao estoque.`);
        log({
          action: "create_item",
          category: "stock",
          description: `Criou o item "${data.name}"`,
          performedBy: actor,
          target: { type: "item", id: ref.id, name: data.name },
        });
      }
      setItemModal({ open: false });
    } catch (err) {
      console.error(err);
      error("Erro ao salvar item", "Tente novamente.");
    }
  }

  async function handleToggleItemVisibility(item: StockItem) {
    const next = !item.isVisible;
    // Find linked subitems whose visibility would benefit from syncing
    const linked = subitems.filter(
      (s) => s.linkedItemId === item.id && s.isVisible !== next,
    );
    if (linked.length > 0) {
      setVisibilityCascadeModal({
        item,
        nextVisible: next,
        linkedSubitems: linked,
        selectedIds: new Set(linked.map((s) => s.id)),
        saving: false,
      });
      return;
    }
    try {
      await updateDoc(doc(db, "items", item.id), { isVisible: next });
      info(
        next ? "Item visível" : "Item oculto",
        `"${item.name}" foi ${next ? "exibido" : "ocultado"}.`,
      );
      log({
        action: "toggle_item_visibility",
        category: "stock",
        description: `${next ? "Exibiu" : "Ocultou"} o item "${item.name}"`,
        performedBy: actor,
        target: { type: "item", id: item.id, name: item.name },
        changes: [{ field: "visível", from: String(!next), to: String(next) }],
      });
    } catch {
      error("Erro", "Tente novamente.");
    }
  }

  async function handleConfirmVisibilityCascade(applyToSubitems: boolean) {
    if (!visibilityCascadeModal) return;
    const { item, nextVisible, linkedSubitems, selectedIds } =
      visibilityCascadeModal;
    setVisibilityCascadeModal((prev) => prev && { ...prev, saving: true });
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "items", item.id), { isVisible: nextVisible });
      if (applyToSubitems) {
        linkedSubitems
          .filter((s) => selectedIds.has(s.id))
          .forEach((s) =>
            batch.update(doc(db, "subitems", s.id), { isVisible: nextVisible }),
          );
      }
      await batch.commit();
      if (applyToSubitems) {
        const ids = new Set([...selectedIds]);
        setSubitems((prev) =>
          prev.map((s) =>
            ids.has(s.id) ? { ...s, isVisible: nextVisible } : s,
          ),
        );
      }
      const subCount = applyToSubitems ? selectedIds.size : 0;
      info(
        nextVisible ? "Item visível" : "Item oculto",
        `"${item.name}" foi ${nextVisible ? "exibido" : "ocultado"}${subCount > 0 ? ` junto com ${subCount} subitem(ns)` : ""}.`,
      );
      log({
        action: "toggle_item_visibility",
        category: "stock",
        description: `${nextVisible ? "Exibiu" : "Ocultou"} o item "${item.name}"${subCount > 0 ? ` e ${subCount} subitem(ns) vinculado(s)` : ""}`,
        performedBy: actor,
        target: { type: "item", id: item.id, name: item.name },
        changes: [
          { field: "visível", from: String(!nextVisible), to: String(nextVisible) },
        ],
      });
      setVisibilityCascadeModal(null);
    } catch {
      error("Erro", "Tente novamente.");
      setVisibilityCascadeModal((prev) => prev && { ...prev, saving: false });
    }
  }

  async function handleToggleItemFeatured(item: StockItem) {
    const next = !item.isFeatured;
    try {
      await updateDoc(doc(db, "items", item.id), { isFeatured: next });
      info(next ? "Item em destaque" : "Destaque removido", `"${item.name}".`);
      log({
        action: "toggle_item_featured",
        category: "stock",
        description: `${next ? "Colocou em destaque" : "Removeu destaque de"} "${item.name}"`,
        performedBy: actor,
        target: { type: "item", id: item.id, name: item.name },
      });
    } catch {
      error("Erro", "Tente novamente.");
    }
  }

  async function handleDeleteItem(item: StockItem) {
    setDeleteLoading(true);
    try {
      if (item.photo) await deletePhotoFromStorage(item.photo);
      await deleteDoc(doc(db, "items", item.id));
      success("Item excluído", `"${item.name}" foi removido.`);
      log({
        action: "delete_item",
        category: "stock",
        description: `Excluiu o item "${item.name}"`,
        performedBy: actor,
        target: { type: "item", id: item.id, name: item.name },
      });
      setDeleteItem(null);
    } catch {
      error("Erro ao excluir", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Subitem actions ──
  async function handleSaveSubitem(
    form: SubitemForm,
    file: File | null | undefined,
    editing?: Subitem,
  ) {
    try {
      const oldPhoto = editing?.photo;
      let photoUrl: string | null | undefined = oldPhoto;
      if (file instanceof File) {
        if (oldPhoto) await deletePhotoFromStorage(oldPhoto);
        photoUrl = await uploadPhoto(file, "subitems");
      } else if (file === null) {
        await deletePhotoFromStorage(oldPhoto);
        photoUrl = null;
      }

      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        isVisible: form.isVisible,
        photo: photoUrl ?? null,
        linkedItemId: form.linkedItemId || null,
      };

      if (editing) {
        // Compute diff
        const changes: {
          field: string;
          from: string | null;
          to: string | null;
        }[] = [];
        if (data.name !== editing.name)
          changes.push({ field: "Nome", from: editing.name, to: data.name });
        if (data.description !== editing.description)
          changes.push({
            field: "Descrição",
            from: editing.description || null,
            to: data.description || null,
          });
        if (data.isVisible !== editing.isVisible)
          changes.push({
            field: "Visível",
            from: editing.isVisible ? "Sim" : "Não",
            to: data.isVisible ? "Sim" : "Não",
          });
        if (file)
          changes.push({
            field: "Foto",
            from: editing.photo ? "foto anterior" : null,
            to: "atualizada",
          });
        if ((data.linkedItemId ?? null) !== (editing.linkedItemId ?? null))
          changes.push({
            field: "Item vinculado",
            from: editing.linkedItemId
              ? (items.find((i) => i.id === editing.linkedItemId)?.name ??
                editing.linkedItemId)
              : null,
            to: data.linkedItemId
              ? (items.find((i) => i.id === data.linkedItemId)?.name ??
                data.linkedItemId)
              : null,
          });

        await updateDoc(doc(db, "subitems", editing.id), data);
        setSubitems((prev) =>
          prev.map((s) =>
            s.id === editing.id
              ? {
                  ...s,
                  ...data,
                  photo: data.photo ?? undefined,
                  linkedItemId: data.linkedItemId ?? undefined,
                }
              : s,
          ),
        );
        success("Subitem atualizado", `"${data.name}" foi salvo.`);
        log({
          action: "update_subitem",
          category: "stock",
          description: `Atualizou o subitem "${data.name}"`,
          performedBy: actor,
          target: { type: "subitem", id: editing.id, name: data.name },
          changes: changes.length > 0 ? changes : undefined,
        });
      } else {
        const ref = await addDoc(collection(db, "subitems"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        const newSub: Subitem = {
          id: ref.id,
          ...data,
          photo: data.photo ?? undefined,
          linkedItemId: data.linkedItemId ?? undefined,
          createdAt: new Date(),
        };
        setSubitems((prev) => [...prev, newSub]);
        success(
          "Subitem criado",
          `"${data.name}" está disponível para adição em itens.`,
        );
        log({
          action: "create_subitem",
          category: "stock",
          description: `Criou o subitem "${data.name}"`,
          performedBy: actor,
          target: { type: "subitem", id: ref.id, name: data.name },
        });
      }
      setSubitemModal({ open: false });
    } catch (err) {
      console.error(err);
      error("Erro ao salvar subitem", "Tente novamente.");
    }
  }

  async function handleToggleSubitemVisibility(subitem: Subitem) {
    const next = !subitem.isVisible;
    try {
      await updateDoc(doc(db, "subitems", subitem.id), { isVisible: next });
      setSubitems((prev) =>
        prev.map((s) => (s.id === subitem.id ? { ...s, isVisible: next } : s)),
      );
      info(next ? "Subitem visível" : "Subitem oculto", `"${subitem.name}".`);
      log({
        action: "toggle_subitem_visibility",
        category: "stock",
        description: `${next ? "Exibiu" : "Ocultou"} o subitem "${subitem.name}"`,
        performedBy: actor,
        target: { type: "subitem", id: subitem.id, name: subitem.name },
        changes: [{ field: "visível", from: String(!next), to: String(next) }],
      });
    } catch {
      error("Erro", "Tente novamente.");
    }
  }

  async function handleDeleteSubitem(subitem: Subitem) {
    setDeleteLoading(true);
    try {
      // Remove referências em todos os itens (cascade)
      const itemsSnap = await getDocs(collection(db, "items"));
      const batch = writeBatch(db);
      itemsSnap.docs.forEach((d) => {
        const data = d.data();
        const referenced = [
          ...(data.additionals ?? []),
          ...(data.additionals_sauce ?? []),
          ...(data.additionals_drink ?? []),
          ...(data.additionals_sweet ?? []),
        ].includes(subitem.id);
        if (referenced) {
          batch.update(d.ref, {
            additionals: arrayRemove(subitem.id),
            additionals_sauce: arrayRemove(subitem.id),
            additionals_drink: arrayRemove(subitem.id),
            additionals_sweet: arrayRemove(subitem.id),
          });
        }
      });
      batch.delete(doc(db, "subitems", subitem.id));
      await batch.commit();
      if (subitem.photo) await deletePhotoFromStorage(subitem.photo);

      setSubitems((prev) => prev.filter((s) => s.id !== subitem.id));

      success(
        "Subitem excluído",
        `"${subitem.name}" foi removido de todos os itens.`,
      );
      log({
        action: "delete_subitem",
        category: "stock",
        description: `Excluiu o subitem "${subitem.name}" (removido de todos os itens vinculados)`,
        performedBy: actor,
        target: { type: "subitem", id: subitem.id, name: subitem.name },
      });
      setDeleteSubitem(null);
    } catch {
      error("Erro ao excluir subitem", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Category order actions ──
  async function handleSaveCategoryOrder() {
    setSavingCategories(true);
    try {
      await setDoc(doc(db, "stockConfig", "categoryOrder"), {
        categories: categoryOrder,
      });
      setSavedCategoryOrder(categoryOrder);
      success("Ordem salva", "A ordem das categorias foi atualizada.");
      log({
        action: "update_category_order",
        category: "stock",
        description: "Atualizou a ordem das categorias",
        performedBy: actor,
      });
    } catch {
      error("Erro ao salvar", "Tente novamente.");
    } finally {
      setSavingCategories(false);
    }
  }

  function moveCategoryUp(i: number) {
    if (i === 0) return;
    setCategoryOrder((prev) => {
      const a = [...prev];
      [a[i - 1], a[i]] = [a[i], a[i - 1]];
      return a;
    });
  }
  function moveCategoryDown(i: number) {
    if (i === categoryOrder.length - 1) return;
    setCategoryOrder((prev) => {
      const a = [...prev];
      [a[i], a[i + 1]] = [a[i + 1], a[i]];
      return a;
    });
  }
  function moveCategoryToTop(i: number) {
    if (i === 0) return;
    setCategoryOrder((prev) => {
      const a = [...prev];
      a.unshift(a.splice(i, 1)[0]);
      return a;
    });
  }
  function moveCategoryToBottom(i: number) {
    if (i === categoryOrder.length - 1) return;
    setCategoryOrder((prev) => {
      const a = [...prev];
      a.push(a.splice(i, 1)[0]);
      return a;
    });
  }
  function addCategory() {
    const val = newCategoryInput.trim();
    if (!val) return;
    if (categoryOrder.includes(val)) {
      info("Já existe", `"${val}" já está na lista.`);
      return;
    }
    setCategoryOrder((prev) => [...prev, val]);
    setNewCategoryInput("");
  }
  function removeCategory(i: number) {
    setCategoryOrder((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Stock notifications (derived from Firestore alerts) ──
  const visibleAlerts = stockAlerts.filter((a) => {
    if (a.dismissedBy.includes(appUser?.uid ?? "")) return false;
    if (a.type === "zero_stock" && !stockNotifSettings.notifyZeroStock)
      return false;
    if (a.type === "low_stock" && !stockNotifSettings.notifyLowStock)
      return false;
    return true;
  });

  const allNotifications = visibleAlerts.map((a) => ({
    alert: a,
    type: a.type === "zero_stock" ? ("zero" as const) : ("low" as const),
  }));

  const zeroNotifications = allNotifications.filter((n) => n.type === "zero");
  const lowNotifications = allNotifications.filter((n) => n.type === "low");

  async function dismissNotif(alertId: string) {
    if (!appUser) return;
    await updateDoc(doc(db, "stockAlerts", alertId), {
      dismissedBy: arrayUnion(appUser.uid),
    });
  }

  function openAlertItem(alertId: string, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    setNotifOpen(false);
    setTab("items");
    if (item) setItemModal({ open: true, editing: item });
  }

  async function handleSaveItemsBatch(
    rows: ParsedCsvItem[],
  ): Promise<{ imported: number; failed: number }> {
    const codeSet = new Set(items.map((i) => i.codItem));
    let imported = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const code = row.codigo.trim() || generateRandomCode(codeSet);
        codeSet.add(code);
        await addDoc(collection(db, "items"), {
          codItem: code,
          name: row.nome,
          category: row.categoria,
          description: row.descricao,
          value: row.preco,
          visibleValue: null,
          quantity: row.quantidade,
          isVisible: row.visivel,
          isFeatured: false,
          isPromotion: false,
          promotionOriginalPrice: null,
          trackStock: row.controle_estoque,
          printTwice: false,
          additionals: [],
          additionals_sauce: [],
          additionals_drink: [],
          additionals_sweet: [],
          createdAt: serverTimestamp(),
        });
        imported++;
      } catch {
        failed++;
      }
    }
    if (imported > 0) {
      log({
        action: "Importação CSV",
        category: "stock",
        description: `${imported} item(s) criado(s) via importação CSV`,
        performedBy: {
          uid: appUser?.uid ?? "",
          username: appUser?.username ?? "",
        },
      });
    }
    return { imported, failed };
  }

  function exportStockCSV() {
    const headers = [
      "Código",
      "Nome",
      "Categoria",
      "Descrição",
      "Preço",
      "Preço visível",
      "Em promoção",
      "Preço original",
      "Quantidade",
      "Controle estoque",
      "Visível",
      "Destaque",
      "Imprimir 2x",
    ];

    function cell(v: string | number | boolean | null | undefined): string {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }

    const rows = items.map((item) => [
      cell(item.codItem),
      cell(item.name),
      cell(item.category),
      cell(item.description),
      cell(formatBRL(item.value)),
      cell(item.visibleValue != null ? formatBRL(item.visibleValue) : ""),
      cell(item.isPromotion ? "Sim" : "Não"),
      cell(
        item.isPromotion && item.promotionOriginalPrice != null
          ? formatBRL(item.promotionOriginalPrice)
          : "",
      ),
      cell(item.trackStock ? item.quantity : ""),
      cell(item.trackStock ? "Sim" : "Não"),
      cell(item.isVisible ? "Sim" : "Não"),
      cell(item.isFeatured ? "Sim" : "Não"),
      cell(item.printTwice ? "Sim" : "Não"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    // UTF-8 BOM ensures Excel reads Portuguese characters correctly
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function dismissAllNotifs() {
    if (!appUser) return;
    const batch = writeBatch(db);
    for (const { alert } of allNotifications) {
      batch.update(doc(db, "stockAlerts", alert.id), {
        dismissedBy: arrayUnion(appUser.uid),
      });
    }
    await batch.commit();
    setNotifOpen(false);
  }

  // ── Render ──
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "items", label: "Itens", icon: <FiBox size={14} /> },
    { key: "subitems", label: "Subitens", icon: <FiPackage size={14} /> },
    {
      key: "categories",
      label: "Ordem das categorias",
      icon: <FiList size={14} className="min-w-[14px]" />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Estoque
          </h1>
          <p
            className="text-sm mt-1 text-wrap hidden lg:block"
            style={{ color: "var(--color-text-muted)" }}
          >
            Gerencie itens, subitens e categorias do cardápio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stock notifications bell — only on items tab */}
          {tab === "items" && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setShowNotifSettings(false);
                }}
                className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] cursor-pointer transition-colors"
                style={{
                  backgroundColor: notifOpen
                    ? "var(--color-bg-elevated)"
                    : "transparent",
                  border: "1px solid var(--color-border)",
                  color:
                    zeroNotifications.length > 0
                      ? "var(--color-error)"
                      : allNotifications.length > 0
                        ? "var(--color-warning)"
                        : "var(--color-text-muted)",
                }}
                title="Notificações de estoque"
              >
                <FiBell size={16} />
                {stockNotifSettings.showBadge &&
                  allNotifications.length > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 leading-none"
                      style={{
                        backgroundColor:
                          zeroNotifications.length > 0
                            ? "var(--color-error)"
                            : "var(--color-warning)",
                        color: "white",
                      }}
                    >
                      {allNotifications.length > 9
                        ? "9+"
                        : allNotifications.length}
                    </span>
                  )}
              </button>

              {notifOpen && (
                <div
                  className="absolute right-0 top-11 z-50 w-80 rounded-[var(--radius-lg)] overflow-hidden"
                  style={{
                    backgroundColor: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 gap-2"
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <span
                      className="text-sm font-semibold flex-1"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {showNotifSettings
                        ? "Configurações"
                        : "Notificações de estoque"}
                    </span>
                    {!showNotifSettings && allNotifications.length > 0 && (
                      <button
                        onClick={dismissAllNotifs}
                        className="text-xs cursor-pointer transition-opacity hover:opacity-70"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Limpar todas
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifSettings((v) => !v)}
                      className="p-1 rounded cursor-pointer transition-opacity hover:opacity-70"
                      style={{
                        color: showNotifSettings
                          ? "var(--color-primary)"
                          : "var(--color-text-muted)",
                      }}
                      title="Configurações"
                    >
                      <FiSettings size={14} />
                    </button>
                  </div>

                  {/* Painel de configurações */}
                  {showNotifSettings ? (
                    <div className="flex flex-col gap-4 px-4 py-4">
                      {/* Toggle badge */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <span
                          className="relative inline-flex items-center w-8 h-4 rounded-full shrink-0 mt-0.5 transition-colors"
                          style={{
                            backgroundColor: stockNotifSettings.showBadge
                              ? "var(--color-primary)"
                              : "var(--color-border)",
                          }}
                          onClick={() =>
                            saveNotifSettings({
                              showBadge: !stockNotifSettings.showBadge,
                            })
                          }
                        >
                          <span
                            className="absolute w-3 h-3 bg-white rounded-full shadow transition-transform"
                            style={{
                              transform: stockNotifSettings.showBadge
                                ? "translateX(18px)"
                                : "translateX(2px)",
                            }}
                          />
                        </span>
                        <div className="flex-1">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            Mostrar badge com contador
                          </p>
                          <p
                            className="text-[10px] mt-0.5"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Exibe o número de alertas ativos no ícone do sino
                          </p>
                        </div>
                      </label>

                      {/* Toggle estoque zerado */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <span
                          className="relative inline-flex items-center w-8 h-4 rounded-full shrink-0 mt-0.5 transition-colors"
                          style={{
                            backgroundColor: stockNotifSettings.notifyZeroStock
                              ? "var(--color-error)"
                              : "var(--color-border)",
                          }}
                          onClick={() =>
                            saveNotifSettings({
                              notifyZeroStock:
                                !stockNotifSettings.notifyZeroStock,
                            })
                          }
                        >
                          <span
                            className="absolute w-3 h-3 bg-white rounded-full shadow transition-transform"
                            style={{
                              transform: stockNotifSettings.notifyZeroStock
                                ? "translateX(18px)"
                                : "translateX(2px)",
                            }}
                          />
                        </span>
                        <div className="flex-1">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            Estoque zerado
                          </p>
                          <p
                            className="text-[10px] mt-0.5"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Item ficou sem estoque e foi ocultado
                            automaticamente
                          </p>
                        </div>
                      </label>

                      {/* Toggle estoque baixo */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <span
                          className="relative inline-flex items-center w-8 h-4 rounded-full shrink-0 mt-0.5 transition-colors"
                          style={{
                            backgroundColor: stockNotifSettings.notifyLowStock
                              ? "var(--color-warning)"
                              : "var(--color-border)",
                          }}
                          onClick={() =>
                            saveNotifSettings({
                              notifyLowStock:
                                !stockNotifSettings.notifyLowStock,
                            })
                          }
                        >
                          <span
                            className="absolute w-3 h-3 bg-white rounded-full shadow transition-transform"
                            style={{
                              transform: stockNotifSettings.notifyLowStock
                                ? "translateX(18px)"
                                : "translateX(2px)",
                            }}
                          />
                        </span>
                        <div className="flex-1">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            Estoque baixo
                          </p>
                          <p
                            className="text-[10px] mt-0.5"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Item com quantidade abaixo do limite configurado
                          </p>
                        </div>
                      </label>

                      {/* Limite de estoque baixo */}
                      {stockNotifSettings.notifyLowStock && (
                        <div className="flex flex-col gap-1.5">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Limite de estoque baixo
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={thresholdInput}
                              onChange={(e) =>
                                setThresholdInput(e.target.value)
                              }
                              className="w-20 px-3 py-1.5 text-sm rounded-[var(--radius-md)] outline-none"
                              style={{
                                backgroundColor: "var(--color-bg-elevated)",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-text-primary)",
                              }}
                              onFocus={(e) =>
                                (e.currentTarget.style.borderColor =
                                  "var(--color-border-focus)")
                              }
                              onBlur={(e) =>
                                (e.currentTarget.style.borderColor =
                                  "var(--color-border)")
                              }
                            />
                            <button
                              onClick={() => {
                                const v = parseInt(thresholdInput);
                                if (!isNaN(v) && v >= 1)
                                  saveNotifSettings({ lowStockThreshold: v });
                              }}
                              disabled={savingNotifSettings}
                              className="flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-md)] cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
                              style={{
                                backgroundColor: "var(--color-primary)",
                                color: "white",
                              }}
                            >
                              {savingNotifSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                          <p
                            className="text-[10px]"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Notifica quando quantidade ≤{" "}
                            {stockNotifSettings.lowStockThreshold}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Lista de notificações */
                    <div className="max-h-72 overflow-y-auto">
                      {allNotifications.length === 0 ? (
                        <div
                          className="flex flex-col items-center justify-center py-8 gap-2"
                          style={{ opacity: 0.45 }}
                        >
                          <FiCheck
                            size={22}
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <p
                            className="text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Tudo em ordem
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Seção: Estoque zerado */}
                          {zeroNotifications.length > 0 && (
                            <>
                              <div
                                className="px-3 py-1.5 flex items-center gap-1.5"
                                style={{
                                  backgroundColor: "rgba(239,68,68,0.07)",
                                  borderBottom: "1px solid var(--color-border)",
                                }}
                              >
                                <FiAlertCircle
                                  size={11}
                                  style={{ color: "var(--color-error)" }}
                                />
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                  style={{ color: "var(--color-error)" }}
                                >
                                  Sem estoque ({zeroNotifications.length})
                                </span>
                              </div>
                              {zeroNotifications.map(({ alert }) => (
                                <AlertRow
                                  key={alert.id}
                                  alert={alert}
                                  type="zero"
                                  onOpen={openAlertItem}
                                  onDismiss={dismissNotif}
                                />
                              ))}
                            </>
                          )}

                          {/* Seção: Estoque baixo */}
                          {lowNotifications.length > 0 && (
                            <>
                              <div
                                className="px-3 py-1.5 flex items-center gap-1.5"
                                style={{
                                  backgroundColor: "rgba(245,158,11,0.07)",
                                  borderBottom: "1px solid var(--color-border)",
                                  borderTop:
                                    zeroNotifications.length > 0
                                      ? "1px solid var(--color-border)"
                                      : undefined,
                                }}
                              >
                                <FiAlertTriangle
                                  size={11}
                                  style={{ color: "var(--color-warning)" }}
                                />
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                  style={{ color: "var(--color-warning)" }}
                                >
                                  Estoque baixo ({lowNotifications.length})
                                </span>
                              </div>
                              {lowNotifications.map(({ alert }) => (
                                <AlertRow
                                  key={alert.id}
                                  alert={alert}
                                  type="low"
                                  onOpen={openAlertItem}
                                  onDismiss={dismissNotif}
                                />
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "items" && (
            <button
              onClick={exportStockCSV}
              className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer flex-shrink-0 transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-bg-elevated)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              title="Exportar itens como CSV"
            >
              <FiDownload size={15} />
              <span className="hidden md:block">Exportar CSV</span>
            </button>
          )}

          {tab === "items" && (
            <button
              onClick={() => setDownloadModal(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0"
              style={{ backgroundColor: "var(--color-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-primary-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--color-primary)")
              }
            >
              <FiDownload size={15} />{" "}
              <span className="hidden md:block">Baixar background do item</span>
            </button>
          )}

          {canCreateItem && tab === "items" && (
            <button
              onClick={() => setItemModal({ open: true })}
              className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0"
              style={{ backgroundColor: "var(--color-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-primary-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--color-primary)")
              }
            >
              <FiPlus size={15} /> Novo item
            </button>
          )}
        </div>
        {canCreateSubitem && tab === "subitems" && (
          <button
            onClick={() => setSubitemModal({ open: true })}
            className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0"
            style={{ backgroundColor: "var(--color-primary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--color-primary-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-primary)")
            }
          >
            <FiPlus size={15} /> Novo subitem
          </button>
        )}
      </div>

      {!canAccess ? (
        <AccessDenied />
      ) : (
        <>
          {/* Tabs */}
          <div
            className="flex gap-1 overflow-x-auto overflow-y-hidden"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setSearch("");
                  setFilterCategory("all");
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px cursor-pointer transition-all"
                style={{
                  color:
                    tab === t.key
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)",
                  borderBottom: `2px solid ${tab === t.key ? "var(--color-primary)" : "transparent"}`,
                }}
              >
                {t.icon}
                {t.label}
                {t.key === "items" && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ({items.length})
                  </span>
                )}
                {t.key === "subitems" && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ({subitems.length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Items Tab ── */}
          {tab === "items" && (
            <div className="flex flex-col gap-4">
              {/* Filtros */}
              <div className="flex flex-col gap-2">
                {/* Busca */}
                <div className="relative">
                  <FiSearch
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome, descrição ou código..."
                    className="w-full h-9 pl-8 pr-3 text-sm rounded-[var(--radius-md)] outline-none"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--color-border-focus)")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--color-border)")
                    }
                  />
                </div>
                {/* Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Tipo/Categoria */}
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="h-9 px-3 text-sm rounded-[var(--radius-md)] outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <option value="all">Tipo: Todos</option>
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {/* Ordenar por quantidade */}
                  <select
                    value={sortQuantity}
                    onChange={(e) =>
                      setSortQuantity(e.target.value as typeof sortQuantity)
                    }
                    className="h-9 px-3 text-sm rounded-[var(--radius-md)] outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <option value="none">Ordenar Quantidade</option>
                    <option value="asc">Quantidade: Menor → Maior</option>
                    <option value="desc">Quantidade: Maior → Menor</option>
                  </select>
                  {/* Visibilidade */}
                  <select
                    value={filterVisibility}
                    onChange={(e) =>
                      setFilterVisibility(
                        e.target.value as typeof filterVisibility,
                      )
                    }
                    className="h-9 px-3 text-sm rounded-[var(--radius-md)] outline-none cursor-pointer"
                    style={{
                      backgroundColor:
                        filterVisibility !== "all"
                          ? "var(--color-primary-light)"
                          : "var(--color-bg-elevated)",
                      border: `1px solid ${filterVisibility !== "all" ? "rgba(0,136,194,0.4)" : "var(--color-border)"}`,
                      color:
                        filterVisibility !== "all"
                          ? "var(--color-primary)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    <option value="all">Filtro: Todos</option>
                    <option value="visible">Visíveis</option>
                    <option value="hidden">Ocultos</option>
                    <option value="featured">Em destaque</option>
                    <option value="printTwice">Impressão 2x</option>
                    <option value="trackStock">Com controle de estoque</option>
                    <option value="noTrackStock">
                      Sem controle de estoque
                    </option>
                    <option value="promotion">Em promoção</option>
                  </select>
                </div>
              </div>

              {loadingItems ? (
                <Spinner />
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <FiBox
                    size={32}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {items.length === 0
                      ? "Nenhum item cadastrado ainda."
                      : "Nenhum item encontrado."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onToggleVisibility={() =>
                        handleToggleItemVisibility(item)
                      }
                      onToggleFeatured={() => handleToggleItemFeatured(item)}
                      onEdit={() => setItemModal({ open: true, editing: item })}
                      onDelete={() => setDeleteItem(item)}
                      canEdit={canEditItem}
                      canDelete={canDeleteItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Subitems Tab ── */}
          {tab === "subitems" && (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <FiSearch
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar subitem..."
                  className="w-full h-9 pl-8 pr-3 text-sm rounded-[var(--radius-md)] outline-none"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "var(--color-border-focus)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--color-border)")
                  }
                />
              </div>

              {loadingSubitems ? (
                <Spinner />
              ) : filteredSubitems.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <FiPackage
                    size={32}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {subitems.length === 0
                      ? "Nenhum subitem cadastrado ainda."
                      : "Nenhum subitem encontrado."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredSubitems.map((s) => (
                    <SubitemCard
                      key={s.id}
                      subitem={s}
                      usedByItems={items.filter((item) =>
                        [
                          ...item.additionals,
                          ...item.additionals_sauce,
                          ...item.additionals_drink,
                          ...item.additionals_sweet,
                        ].includes(s.id),
                      )}
                      linkedItemHidden={
                        !!s.linkedItemId &&
                        items.find((i) => i.id === s.linkedItemId)
                          ?.isVisible === false
                      }
                      onToggleVisibility={() =>
                        handleToggleSubitemVisibility(s)
                      }
                      onEdit={() => setSubitemModal({ open: true, editing: s })}
                      onDelete={() => setDeleteSubitem(s)}
                      canEdit={canEditSubitem}
                      canDelete={canDeleteSubitem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Categories Tab ── */}
          {tab === "categories" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Defina a ordem de exibição das categorias no cardápio. A
                  primeira categoria terá maior prioridade.
                </p>
                {canManageCategoryOrder && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {categoryOrder.join(",") !== savedCategoryOrder.join(",") && (
                      <button
                        onClick={() => setCategoryOrder([...savedCategoryOrder])}
                        className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-colors"
                        style={{
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-secondary)",
                          backgroundColor: "transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <FiRotateCcw size={14} />
                        Desfazer
                      </button>
                    )}
                    <button
                      onClick={handleSaveCategoryOrder}
                      disabled={savingCategories || categoryOrder.join(",") === savedCategoryOrder.join(",")}
                      className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0 disabled:opacity-40"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      <FiCheck size={14} />
                      {savingCategories ? "Salvando..." : "Salvar ordem"}
                    </button>
                  </div>
                )}
              </div>

              {/* Add category — dropdown de existentes + campo livre */}
              <div className="flex flex-col gap-2">
                {/* Dropdown com categorias dos itens */}
                {allCategories.filter((c) => !categoryOrder.includes(c))
                  .length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Categorias dos itens
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="cat-select"
                        defaultValue=""
                        className="flex-1 h-11 px-3 text-sm rounded-[var(--radius-md)] outline-none cursor-pointer"
                        style={{
                          backgroundColor: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-secondary)",
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          if (!categoryOrder.includes(val)) {
                            setCategoryOrder((prev) => [...prev, val]);
                          }
                          e.target.value = "";
                        }}
                      >
                        <option value="" disabled>
                          Selecionar categoria existente...
                        </option>
                        {allCategories
                          .filter((c) => !categoryOrder.includes(c))
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Campo livre para categoria nova */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Adicionar nova categoria
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Nome da categoria..."
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCategory();
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={addCategory}
                      className="flex items-center gap-1.5 h-11 px-4 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer flex-shrink-0"
                      style={{
                        backgroundColor: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-secondary)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "var(--color-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor =
                          "var(--color-border)")
                      }
                    >
                      <FiPlus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {loadingCategories ? (
                <Spinner />
              ) : categoryOrder.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <FiList
                    size={32}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Nenhuma categoria adicionada. Digite acima para começar.
                  </p>
                  {allCategories.length > 0 && (
                    <div className="flex flex-col items-center gap-2">
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Categorias encontradas nos itens:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {allCategories.map((c) => (
                          <button
                            key={c}
                            onClick={() =>
                              setCategoryOrder((prev) => [...prev, c])
                            }
                            className="px-2.5 py-1 rounded-full text-xs cursor-pointer"
                            style={{
                              backgroundColor: "var(--color-primary-light)",
                              color: "var(--color-primary)",
                            }}
                          >
                            + {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex flex-col gap-2 rounded-[var(--radius-lg)] overflow-hidden"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  {categoryOrder.map((cat, i) => {
                    const originalIdx = savedCategoryOrder.indexOf(cat);
                    const isNew = originalIdx === -1;
                    const movedUp = !isNew && i < originalIdx;
                    const movedDown = !isNew && i > originalIdx;
                    const changed = isNew || movedUp || movedDown;
                    const delta = isNew ? 0 : Math.abs(originalIdx - i);
                    return (
                    <div
                      key={cat}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        backgroundColor: changed ? (movedUp ? "rgba(34,197,94,0.04)" : movedDown ? "rgba(239,68,68,0.04)" : "rgba(59,130,246,0.04)") : "var(--color-bg-surface)",
                        borderBottom: i < categoryOrder.length - 1 ? "1px solid var(--color-border)" : "none",
                        borderLeft: changed ? `3px solid ${movedUp ? "var(--color-success)" : movedDown ? "var(--color-error)" : "var(--color-primary)"}` : "3px solid transparent",
                        transition: "background-color 0.15s, border-color 0.15s",
                      }}
                    >
                      <div className="flex flex-col items-center w-8 flex-shrink-0 gap-0.5">
                        <span
                          className="text-xs font-bold"
                          style={{ color: changed ? (movedUp ? "var(--color-success)" : movedDown ? "var(--color-error)" : "var(--color-primary)") : "var(--color-text-muted)" }}
                        >
                          {i + 1}
                        </span>
                        {movedUp && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold leading-none" style={{ color: "var(--color-success)" }}>
                            <FiChevronUp size={10} />
                            {delta}
                          </span>
                        )}
                        {movedDown && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold leading-none" style={{ color: "var(--color-error)" }}>
                            <FiChevronDown size={10} />
                            {delta}
                          </span>
                        )}
                        {isNew && (
                          <span className="text-[9px] font-bold leading-none uppercase tracking-wide" style={{ color: "var(--color-primary)" }}>
                            novo
                          </span>
                        )}
                      </div>
                      <p
                        className="flex-1 text-sm font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {cat}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveCategoryToTop(i)}
                          disabled={i === 0}
                          title="Mover para o topo"
                          className="w-7 h-7 rounded flex items-center justify-center cursor-pointer disabled:opacity-30"
                          style={{ color: "var(--color-text-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--color-bg-elevated)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          <span className="flex flex-col">
                            <FiChevronUp size={12} style={{ marginBottom: -5 }} />
                            <FiChevronUp size={12} />
                          </span>
                        </button>
                        <button
                          onClick={() => moveCategoryUp(i)}
                          disabled={i === 0}
                          title="Mover uma posição acima"
                          className="w-7 h-7 rounded flex items-center justify-center cursor-pointer disabled:opacity-30"
                          style={{ color: "var(--color-text-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--color-bg-elevated)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          <FiChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveCategoryDown(i)}
                          disabled={i === categoryOrder.length - 1}
                          title="Mover uma posição abaixo"
                          className="w-7 h-7 rounded flex items-center justify-center cursor-pointer disabled:opacity-30"
                          style={{ color: "var(--color-text-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--color-bg-elevated)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          <FiChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => moveCategoryToBottom(i)}
                          disabled={i === categoryOrder.length - 1}
                          title="Mover para o fim"
                          className="w-7 h-7 rounded flex items-center justify-center cursor-pointer disabled:opacity-30"
                          style={{ color: "var(--color-text-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--color-bg-elevated)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          <span className="flex flex-col">
                            <FiChevronDown size={12} style={{ marginTop: -5 }} />
                            <FiChevronDown size={12} />
                          </span>
                        </button>
                        <button
                          onClick={() => removeCategory(i)}
                          className="w-7 h-7 rounded flex items-center justify-center cursor-pointer ml-1"
                          style={{ color: "var(--color-text-muted)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "rgba(239,68,68,0.1)";
                            e.currentTarget.style.color = "var(--color-error)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                            e.currentTarget.style.color =
                              "var(--color-text-muted)";
                          }}
                        >
                          <FiX size={13} />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {itemModal.open && (
        <ItemModal
          existing={itemModal.editing}
          allSubitems={subitems}
          categories={allCategories}
          existingCodes={items.map((i) => i.codItem)}
          onSave={handleSaveItem}
          onBatchSave={handleSaveItemsBatch}
          onClose={() => setItemModal({ open: false })}
        />
      )}
      {subitemModal.open && (
        <SubitemModal
          existing={subitemModal.editing}
          allItems={items}
          onSave={(form, file) =>
            handleSaveSubitem(form, file, subitemModal.editing)
          }
          onClose={() => setSubitemModal({ open: false })}
        />
      )}
      {deleteItem && (
        <DeleteConfirm
          name={deleteItem.name}
          loading={deleteLoading}
          onConfirm={() => handleDeleteItem(deleteItem)}
          onClose={() => setDeleteItem(null)}
        />
      )}
      {deleteSubitem && (
        <DeleteConfirm
          name={deleteSubitem.name}
          loading={deleteLoading}
          onConfirm={() => handleDeleteSubitem(deleteSubitem)}
          onClose={() => setDeleteSubitem(null)}
        />
      )}
      {downloadModal && (
        <DownloadConfirm
          onConfirm={() => setDownloadModal(false)}
          onClose={() => setDownloadModal(false)}
        />
      )}
      {visibilityCascadeModal && (
        <VisibilityCascadeModal
          item={visibilityCascadeModal.item}
          nextVisible={visibilityCascadeModal.nextVisible}
          linkedSubitems={visibilityCascadeModal.linkedSubitems}
          selectedIds={visibilityCascadeModal.selectedIds}
          saving={visibilityCascadeModal.saving}
          allItems={items}
          onToggleSubitem={(id) =>
            setVisibilityCascadeModal((prev) => {
              if (!prev) return prev;
              const next = new Set(prev.selectedIds);
              next.has(id) ? next.delete(id) : next.add(id);
              return { ...prev, selectedIds: next };
            })
          }
          onConfirm={() => handleConfirmVisibilityCascade(true)}
          onSkip={() => handleConfirmVisibilityCascade(false)}
          onClose={() => setVisibilityCascadeModal(null)}
        />
      )}
    </div>
  );
}
