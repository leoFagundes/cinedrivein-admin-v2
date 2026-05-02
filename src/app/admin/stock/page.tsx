/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayRemove,
  serverTimestamp,
  query,
  orderBy,
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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
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
}

function SubitemModal({
  existing,
  onSave,
  onClose,
}: {
  existing?: Subitem;
  onSave: (data: SubitemForm, file: File | null | undefined) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubitemForm>({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    isVisible: existing?.isVisible ?? true,
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
    </Modal>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function suggestNextCode(existingCodes: string[]): string {
  const nums = existingCodes
    .map((c) => parseInt(c.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n) && n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(3, "0");
}

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
  trackStock: boolean;
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

function ItemModal({
  existing,
  allSubitems,
  categories,
  existingCodes,
  onSave,
  onClose,
}: {
  existing?: StockItem;
  allSubitems: Subitem[];
  categories: string[];
  existingCodes: string[];
  onSave: (data: ItemForm, file: File | null | undefined) => Promise<void>;
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
    trackStock: existing?.trackStock ?? false,
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

  function generateRandomCode(existingCodes: string[]): string {
    let code = "";

    do {
      const length = Math.floor(Math.random() * 5) + 1; // 1 a 5 dígitos
      const num = Math.floor(Math.random() * Math.pow(10, length));
      code = String(num).padStart(length, "0");
    } while (existingCodes.includes(code));

    return code;
  }

  return (
    <Modal
      title={existing ? "Editar item" : "Novo item"}
      onClose={onClose}
      wide
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
              : "Criar item"}
        </button>
      }
    >
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
                  (e.currentTarget.style.borderColor = "var(--color-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--color-border)")
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

      <Section title="Configurações" />
      <div className="flex w-full flex-col sm:flex-row gap-3">
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
        <button
          type="button"
          onClick={() => set("isFeatured", !form.isFeatured)}
          className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all"
          style={{
            backgroundColor: form.isFeatured
              ? "rgba(245,158,11,0.12)"
              : "var(--color-bg-elevated)",
            border: `1px solid ${form.isFeatured ? "var(--color-warning)" : "var(--color-border)"}`,
            color: form.isFeatured
              ? "var(--color-warning)"
              : "var(--color-text-secondary)",
          }}
        >
          <FiStar size={14} />
          {form.isFeatured ? "Destaque" : "Sem destaque"}
        </button>
        <button
          type="button"
          onClick={() => set("trackStock", !form.trackStock)}
          title="Se ativado, cada pedido deste item reduz 1 do estoque. Ao cancelar, o estoque é restaurado. Ao atingir 0, o item fica invisível."
          className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all"
          style={{
            backgroundColor: form.trackStock
              ? "rgba(0,136,194,0.12)"
              : "var(--color-bg-elevated)",
            border: `1px solid ${form.trackStock ? "var(--color-primary)" : "var(--color-border)"}`,
            color: form.trackStock
              ? "var(--color-primary)"
              : "var(--color-text-secondary)",
          }}
        >
          <FiPackage size={14} />
          {form.trackStock ? "Controle de estoque" : "Sem controle"}
        </button>
      </div>

      <Section title="Foto" />
      <PhotoUpload current={existing?.photo} onFileSelected={setPhotoFile} />

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
    </Modal>
  );
}

// ─── Subitem Card ─────────────────────────────────────────────────────────────

function SubitemCard({
  subitem,
  usedByItems,
  onToggleVisibility,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  subitem: Subitem;
  usedByItems: StockItem[];
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

        {/* Featured badge */}
        {item.isFeatured && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
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

        {/* Hidden badge */}
        {!item.isVisible && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "rgba(0,0,0,0.72)", color: "white" }}
          >
            <FiEyeOff size={9} />
            Oculto
          </div>
        )}

        {/* Track stock badge */}
        {item.trackStock && item.isVisible && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
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
            <span
              className="text-base font-bold leading-tight"
              style={{ color: "var(--color-primary)" }}
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
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
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
    "all" | "visible" | "hidden"
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
  const [savingCategories, setSavingCategories] = useState(false);

  // ── Load data ──
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingItems(true);
    const unsub = onSnapshot(
      query(collection(db, "items"), orderBy("createdAt", "desc")),
      (snap) => {
        setItems(
          snap.docs.map((d) => {
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
              trackStock: data.trackStock ?? false,
              additionals: data.additionals ?? [],
              additionals_sauce: data.additionals_sauce ?? [],
              additionals_drink: data.additionals_drink ?? [],
              additionals_sweet: data.additionals_sweet ?? [],
              createdAt: data.createdAt?.toDate() ?? new Date(),
            } as StockItem;
          }),
        );
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
        if (snap.exists()) setCategoryOrder(snap.data().categories ?? []);
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
      const matchVis =
        filterVisibility === "all" ||
        (filterVisibility === "visible" ? i.isVisible : !i.isVisible);
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
        trackStock: form.trackStock,
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

        await updateDoc(doc(db, "subitems", editing.id), data);
        setSubitems((prev) =>
          prev.map((s) =>
            s.id === editing.id
              ? { ...s, ...data, photo: data.photo ?? undefined }
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
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <option value="all">Visibilidade: Todos</option>
                    <option value="visible">Apenas visíveis</option>
                    <option value="hidden">Apenas ocultos</option>
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
                  <button
                    onClick={handleSaveCategoryOrder}
                    disabled={savingCategories}
                    className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    <FiCheck size={14} />
                    {savingCategories ? "Salvando..." : "Salvar ordem"}
                  </button>
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
                  {categoryOrder.map((cat, i) => (
                    <div
                      key={cat}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        backgroundColor: "var(--color-bg-surface)",
                        borderBottom:
                          i < categoryOrder.length - 1
                            ? "1px solid var(--color-border)"
                            : "none",
                      }}
                    >
                      <span
                        className="text-xs font-bold w-6 text-center flex-shrink-0"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {i + 1}
                      </span>
                      <p
                        className="flex-1 text-sm font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {cat}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveCategoryUp(i)}
                          disabled={i === 0}
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
                  ))}
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
          onClose={() => setItemModal({ open: false })}
        />
      )}
      {subitemModal.open && (
        <SubitemModal
          existing={subitemModal.editing}
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
    </div>
  );
}
