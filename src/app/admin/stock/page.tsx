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
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
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
} from "react-icons/fi";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/access";
import { log } from "@/lib/logger";
import { StockItem, Subitem, AdditionalGroup } from "@/types";
import Input from "@/components/ui/Input";

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

  const filtered = allSubitems.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
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
                    {s.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photo}
                        alt={s.name}
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                      />
                    )}
                    <span className="flex-1 truncate">{s.name}</span>
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
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
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
            style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-surface)" }}
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
  onSave: (data: SubitemForm, file: File | null) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubitemForm>({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    isVisible: existing?.isVisible ?? true,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
      <button
        onClick={handleSave}
        disabled={loading}
        className="h-10 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {loading
          ? "Salvando..."
          : existing
            ? "Salvar alterações"
            : "Criar subitem"}
      </button>
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
  onSave,
  onClose,
}: {
  existing?: StockItem;
  allSubitems: Subitem[];
  categories: string[];
  onSave: (data: ItemForm, file: File | null) => Promise<void>;
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
    additionals: existing?.additionals ?? [],
    additionals_sauce: existing?.additionals_sauce ?? [],
    additionals_drink: existing?.additionals_drink ?? [],
    additionals_sweet: existing?.additionals_sweet ?? [],
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal
      title={existing ? "Editar item" : "Novo item"}
      onClose={onClose}
      wide
    >
      <Section title="Informações básicas" />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Código do item"
          placeholder="Ex: 001"
          value={form.codItem}
          onChange={(e) => set("codItem", e.target.value)}
          error={errors.codItem}
          autoFocus
        />
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
      <CategoryInput
        value={form.category}
        onChange={(v) => set("category", v)}
        categories={categories}
      />
      <Input
        label="Descrição"
        placeholder="Descrição do item"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
      />

      <Section title="Preço" />
      <div className="grid grid-cols-2 gap-3">
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
      <div className="flex gap-3">
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

      <button
        onClick={handleSave}
        disabled={loading}
        className="h-10 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50 mt-2"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {loading
          ? "Salvando..."
          : existing
            ? "Salvar alterações"
            : "Criar item"}
      </button>
    </Modal>
  );
}

// ─── Subitem Card ─────────────────────────────────────────────────────────────

function SubitemCard({
  subitem,
  onToggleVisibility,
  onEdit,
  onDelete,
}: {
  subitem: Subitem;
  onToggleVisibility: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] transition-all"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: `1px solid ${subitem.isVisible ? "var(--color-border)" : "var(--color-border)"}`,
        opacity: subitem.isVisible ? 1 : 0.45,
      }}
    >
      <div
        className="w-10 h-10 rounded-[var(--radius-md)] overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        {subitem.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={subitem.photo}
            alt={subitem.name}
            className="w-full h-full object-cover"
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
        <ToggleBtn active={subitem.isVisible} onToggle={onToggleVisibility} />
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
      </div>
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onToggleVisibility,
  onToggleFeatured,
  onEdit,
  onDelete,
}: {
  item: StockItem;
  onToggleVisibility: () => void;
  onToggleFeatured: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden flex"
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        opacity: item.isVisible ? 1 : 0.55,
      }}
    >
      {/* Photo — proeminente, lado esquerdo */}
      <div className="w-28 flex-shrink-0 relative" style={{ minHeight: 128 }}>
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo}
            alt={item.name}
            className="w-full h-full object-cover"
            style={{ minHeight: 128 }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              minHeight: 128,
              backgroundColor: "var(--color-bg-surface)",
            }}
          >
            <FiBox size={28} style={{ color: "var(--color-text-muted)" }} />
          </div>
        )}
        {/* Destaque badge */}
        {item.isFeatured && (
          <div
            className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "var(--color-warning)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }}
          >
            <FiStar size={9} color="white" />
          </div>
        )}
        {/* Invisível badge */}
        {!item.isVisible && (
          <div
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <FiEyeOff size={9} color="white" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col p-3">
        {/* Nome */}
        <p
          className="text-sm font-bold leading-snug mb-2.5"
          style={{ color: "var(--color-text-primary)" }}
        >
          {item.name}
        </p>

        {/* Dados */}
        <div className="flex flex-col gap-1 flex-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span style={{ color: "var(--color-text-muted)" }}>Código:</span>
            <span
              className="font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              #{item.codItem}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ color: "var(--color-text-muted)" }}>
              Quantidade:
            </span>
            <span
              className="font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {item.quantity}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ color: "var(--color-text-muted)" }}>Tipo:</span>
            <span
              className="font-medium truncate"
              style={{ color: "var(--color-primary)" }}
            >
              {item.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="font-bold text-sm"
              style={{ color: "var(--color-text-primary)" }}
            >
              {formatBRL(item.value)}
            </span>
            {item.visibleValue != null && item.visibleValue !== item.value && (
              <span style={{ color: "var(--color-text-muted)" }}>
                (cliente: {formatBRL(item.visibleValue)})
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div
          className="flex items-center gap-1 mt-2.5 pt-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {/* Destaque */}
          <button
            onClick={onToggleFeatured}
            title={item.isFeatured ? "Remover destaque" : "Destacar"}
            className="w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all"
            style={{
              color: item.isFeatured
                ? "var(--color-warning)"
                : "var(--color-text-muted)",
              backgroundColor: item.isFeatured
                ? "rgba(245,158,11,0.15)"
                : "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.15)";
              e.currentTarget.style.color = "var(--color-warning)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = item.isFeatured
                ? "rgba(245,158,11,0.15)"
                : "transparent";
              e.currentTarget.style.color = item.isFeatured
                ? "var(--color-warning)"
                : "var(--color-text-muted)";
            }}
          >
            <FiStar size={13} />
          </button>

          {/* Visibilidade */}
          <button
            onClick={onToggleVisibility}
            title={item.isVisible ? "Ocultar" : "Exibir"}
            className="w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all"
            style={{
              color: item.isVisible
                ? "var(--color-success)"
                : "var(--color-text-muted)",
              backgroundColor: item.isVisible
                ? "rgba(34,197,94,0.12)"
                : "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(34,197,94,0.12)";
              e.currentTarget.style.color = "var(--color-success)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = item.isVisible
                ? "rgba(34,197,94,0.12)"
                : "transparent";
              e.currentTarget.style.color = item.isVisible
                ? "var(--color-success)"
                : "var(--color-text-muted)";
            }}
          >
            {item.isVisible ? <FiEye size={13} /> : <FiEyeOff size={13} />}
          </button>

          <div className="flex-1" />

          {/* Editar */}
          <button
            onClick={onEdit}
            title="Editar"
            className="w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-primary)";
              e.currentTarget.style.backgroundColor =
                "var(--color-primary-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FiEdit2 size={13} />
          </button>

          {/* Excluir */}
          <button
            onClick={onDelete}
            title="Excluir"
            className="w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-error)";
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Utilitários de módulo (fora de qualquer componente) ─────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="var(--color-primary)" strokeWidth="3" />
        <path className="opacity-80" fill="var(--color-primary)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
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
  const canAccess = can(appUser, "manage_stock");
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
  const [deleteItem, setDeleteItem] = useState<StockItem | null>(null);
  const [deleteSubitem, setDeleteSubitem] = useState<Subitem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);

  // ── Load data ──
  useEffect(() => {
    async function load() {
      setLoadingItems(true);
      try {
        const snap = await getDocs(
          query(collection(db, "items"), orderBy("createdAt", "desc")),
        );
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
              additionals: data.additionals ?? [],
              additionals_sauce: data.additionals_sauce ?? [],
              additionals_drink: data.additionals_drink ?? [],
              additionals_sweet: data.additionals_sweet ?? [],
              createdAt: data.createdAt?.toDate() ?? new Date(),
            } as StockItem;
          }),
        );
      } catch {
        error("Erro ao carregar itens", "Tente recarregar.");
      } finally {
        setLoadingItems(false);
      }
    }
    load();
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
        i.codItem.toLowerCase().includes(search.toLowerCase());
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
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
  );


  // ── Item actions ──
  async function handleSaveItem(form: ItemForm, file: File | null) {
    try {
      let photoUrl: string | undefined = itemModal.editing?.photo;
      if (file)
        photoUrl = await uploadPhoto(file, "items");

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
        additionals: form.additionals,
        additionals_sauce: form.additionals_sauce,
        additionals_drink: form.additionals_drink,
        additionals_sweet: form.additionals_sweet,
      };

      if (itemModal.editing) {
        await updateDoc(doc(db, "items", itemModal.editing.id), data);
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemModal.editing!.id
              ? ({ ...i, ...data } as StockItem)
              : i,
          ),
        );
        success("Item atualizado", `"${data.name}" foi salvo.`);
        log({
          action: "update_item",
          category: "stock",
          description: `Atualizou o item "${data.name}"`,
          performedBy: actor,
          target: { type: "item", id: itemModal.editing.id, name: data.name },
        });
      } else {
        const ref = await addDoc(collection(db, "items"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        const newItem: StockItem = {
          id: ref.id,
          ...data,
          visibleValue: data.visibleValue ?? undefined,
          photo: data.photo ?? undefined,
          createdAt: new Date(),
        };
        setItems((prev) => [newItem, ...prev]);
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
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isVisible: next } : i)),
      );
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
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isFeatured: next } : i)),
      );
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
      await deleteDoc(doc(db, "items", item.id));
      setItems((prev) => prev.filter((i) => i.id !== item.id));
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
    file: File | null,
    editing?: Subitem,
  ) {
    try {
      let photoUrl: string | undefined = editing?.photo;
      if (file)
        photoUrl = await uploadPhoto(file, "subitems");

      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        isVisible: form.isVisible,
        photo: photoUrl ?? null,
      };

      if (editing) {
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

      // Update local state
      setSubitems((prev) => prev.filter((s) => s.id !== subitem.id));
      setItems((prev) =>
        prev.map((i) => ({
          ...i,
          additionals: i.additionals.filter((id) => id !== subitem.id),
          additionals_sauce: i.additionals_sauce.filter(
            (id) => id !== subitem.id,
          ),
          additionals_drink: i.additionals_drink.filter(
            (id) => id !== subitem.id,
          ),
          additionals_sweet: i.additionals_sweet.filter(
            (id) => id !== subitem.id,
          ),
        })),
      );

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
    { key: "categories", label: "Categorias", icon: <FiList size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full max-w-5xl">
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
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Gerencie itens, subitens e categorias do cardápio.
          </p>
        </div>
        {canAccess && tab === "items" && (
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
        {canAccess && tab === "subitems" && (
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
            className="flex gap-1"
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
                    placeholder="Buscar por nome ou código..."
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      onToggleVisibility={() =>
                        handleToggleSubitemVisibility(s)
                      }
                      onEdit={() => setSubitemModal({ open: true, editing: s })}
                      onDelete={() => setDeleteSubitem(s)}
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
                <button
                  onClick={handleSaveCategoryOrder}
                  disabled={savingCategories}
                  className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <FiCheck size={14} />
                  {savingCategories ? "Salvando..." : "Salvar ordem"}
                </button>
              </div>

              {/* Add category */}
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
                    (e.currentTarget.style.borderColor = "var(--color-primary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "var(--color-border)")
                  }
                >
                  <FiPlus size={14} /> Adicionar
                </button>
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
    </div>
  );
}
