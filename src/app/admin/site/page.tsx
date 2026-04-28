"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiCopy,
  FiX,
  FiAlertTriangle,
  FiGlobe,
  FiImage,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiSave,
  FiLock,
  FiDollarSign,
} from "react-icons/fi";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/access";
import { log } from "@/lib/logger";
import Input from "@/components/ui/Input";
import {
  Film,
  FilmClassification,
  EventType,
  SessionKey,
  SiteConfig,
  PriceRule,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_CONFIG_DOC = "main";

const SESSIONS: { key: SessionKey; label: string }[] = [
  { key: "session1", label: "Sessão 1" },
  { key: "session2", label: "Sessão 2" },
  { key: "session3", label: "Sessão 3" },
  { key: "session4", label: "Sessão 4" },
];

const CLASSIFICATIONS: {
  value: FilmClassification;
  label: string;
  bg: string;
  text: string;
}[] = [
  { value: "L", label: "L", bg: "#12caae", text: "#fff" },
  { value: "6", label: "6", bg: "#B5336F", text: "#fff" },
  { value: "10", label: "10", bg: "#0088C2", text: "#fff" },
  { value: "12", label: "12", bg: "#C9A421", text: "#fff" },
  { value: "14", label: "14", bg: "#C97121", text: "#212121" },
  { value: "16", label: "16", bg: "#FF5555", text: "#fff" },
  { value: "18", label: "18", bg: "#000000", text: "#fff" },
];

const EVENTS: {
  value: EventType;
  label: string;
  emoji: string;
  color: string;
}[] = [
  {
    value: "",
    label: "Nenhum",
    emoji: "🎬",
    color: "var(--color-bg-elevated)",
  },
  { value: "christmas", label: "Natal", emoji: "🎄", color: "#1b5e20" },
  { value: "halloween", label: "Halloween", emoji: "🎃", color: "#bf360c" },
  { value: "easter", label: "Páscoa", emoji: "🐣", color: "#6a1b9a" },
];

const LANGUAGES = ["Dublado", "Legendado", "Nacional", "Original"];

const EMPTY_FILM: Film = {
  title: "",
  showtime: "",
  image: "",
  classification: "",
  synopsis: "",
  director: "",
  writer: [],
  cast: [],
  genres: [],
  duration: "",
  language: "Dublado",
  displayDate: "",
  trailer: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arrToStr(arr: string[]) {
  return arr.join(", ");
}
function strToArr(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function uploadSitePhoto(file: File, path: string): Promise<string> {
  const uid = crypto.randomUUID();
  const sRef = storageRef(storage, `${path}/${uid}_${file.name}`);
  await uploadBytes(sRef, file);
  return getDownloadURL(sRef);
}

// ─── Access Denied ────────────────────────────────────────────────────────────

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
        <FiGlobe size={24} />
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
          Você precisa da permissão {'"'}Gerenciar site{'"'}.
        </p>
      </div>
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
        style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      />
      <div
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[var(--radius-xl)] flex flex-col max-h-[92vh]`}
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-4">
          {children}
        </div>
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

// ─── Classification Picker ────────────────────────────────────────────────────

function ClassificationPicker({
  value,
  onChange,
}: {
  value: FilmClassification;
  onChange: (v: FilmClassification) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-medium"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Classificação indicativa
      </label>
      <div className="flex flex-wrap gap-2">
        {CLASSIFICATIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(value === c.value ? "" : c.value)}
            className="w-10 h-10 rounded-[var(--radius-md)] text-sm font-black cursor-pointer transition-all"
            style={{
              backgroundColor: c.bg,
              color: c.text,
              opacity: value && value !== c.value ? 0.35 : 1,
              boxShadow: value === c.value ? `0 0 0 3px ${c.bg}50` : "none",
              transform: value === c.value ? "scale(1.1)" : "scale(1)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Film Modal ───────────────────────────────────────────────────────────────

interface FilmFormState {
  title: string;
  showtime: string;
  image: string;
  imageFile: File | null;
  classification: FilmClassification;
  synopsis: string;
  director: string;
  writer: string;
  cast: string;
  genres: string;
  duration: string;
  language: string;
  displayDate: string;
  trailer: string;
}

function FilmModal({
  sessionLabel,
  existing,
  onSave,
  onClose,
}: {
  sessionLabel: string;
  existing?: Film | null;
  onSave: (film: Film) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FilmFormState>({
    title: existing?.title ?? "",
    showtime: existing?.showtime ?? "",
    image: existing?.image ?? "",
    imageFile: null,
    classification: existing?.classification ?? "",
    synopsis: existing?.synopsis ?? "",
    director: existing?.director ?? "",
    writer: arrToStr(existing?.writer ?? []),
    cast: arrToStr(existing?.cast ?? []),
    genres: arrToStr(existing?.genres ?? []),
    duration: existing?.duration ?? "",
    language: existing?.language ?? "Dublado",
    displayDate: existing?.displayDate ?? "",
    trailer: existing?.trailer ?? "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FilmFormState, string>>
  >({});
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(
    existing?.image || null,
  );

  function set<K extends keyof FilmFormState>(k: K, v: FilmFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("imageFile", file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = "Título obrigatório";
    if (!form.showtime.trim()) errs.showtime = "Horário obrigatório";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      let imageUrl = form.image.trim();
      if (form.imageFile) {
        imageUrl = await uploadSitePhoto(form.imageFile, "site/films");
      }

      const film: Film = {
        title: form.title.trim(),
        showtime: form.showtime.trim(),
        image: imageUrl,
        classification: form.classification,
        synopsis: form.synopsis.trim(),
        director: form.director.trim(),
        writer: strToArr(form.writer),
        cast: strToArr(form.cast),
        genres: strToArr(form.genres),
        duration: form.duration.trim(),
        language: form.language,
        displayDate: form.displayDate.trim(),
        trailer: form.trailer.trim(),
      };
      await onSave(film);
    } finally {
      setLoading(false);
    }
  }

  const saveBtn = (
    <button
      onClick={handleSave}
      disabled={loading}
      className="w-full h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50 transition-all"
      style={{ backgroundColor: "var(--color-primary)" }}
    >
      {loading
        ? "Salvando..."
        : existing
          ? "Salvar alterações"
          : "Adicionar sessão"}
    </button>
  );

  return (
    <Modal
      title={existing ? `Editar — ${sessionLabel}` : sessionLabel}
      onClose={onClose}
      wide
      footer={saveBtn}
    >
      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Título"
          placeholder="Nome do filme"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          error={errors.title}
          autoFocus
        />
        <Input
          label="Horário"
          placeholder="Ex: 18:20"
          value={form.showtime}
          onChange={(e) => set("showtime", e.target.value)}
          error={errors.showtime}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Duração"
          placeholder="Ex: 99 min."
          value={form.duration}
          onChange={(e) => set("duration", e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Idioma
          </label>
          <select
            value={form.language}
            onChange={(e) => set("language", e.target.value)}
            className="h-11 px-3 text-sm rounded-[var(--radius-md)] outline-none cursor-pointer"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Direção"
          placeholder="Diretor(es)"
          value={form.director}
          onChange={(e) => set("director", e.target.value)}
        />
        <Input
          label="Roteiro (separado por vírgula)"
          placeholder="Roteiristas"
          value={form.writer}
          onChange={(e) => set("writer", e.target.value)}
        />
      </div>
      <Input
        label="Elenco (separado por vírgula)"
        placeholder="Atores principais"
        value={form.cast}
        onChange={(e) => set("cast", e.target.value)}
      />
      <Input
        label="Gêneros (separado por vírgula)"
        placeholder="Ação, Aventura..."
        value={form.genres}
        onChange={(e) => set("genres", e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Data de exibição"
          placeholder="Ex: 23 a 29/04/2026"
          value={form.displayDate}
          onChange={(e) => set("displayDate", e.target.value)}
        />
        <Input
          label="Trailer (URL do YouTube)"
          placeholder="https://youtube.com/..."
          value={form.trailer}
          onChange={(e) => set("trailer", e.target.value)}
        />
      </div>
      <Input
        label="Sinopse"
        placeholder="Breve descrição do filme..."
        value={form.synopsis}
        onChange={(e) => set("synopsis", e.target.value)}
      />

      {/* Image */}
      <div className="flex flex-col gap-1.5">
        <label
          className="text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Imagem do pôster
        </label>
        <div className="flex gap-3 items-start">
          {imagePreview && (
            <div
              className="w-16 h-24 rounded-[var(--radius-md)] overflow-hidden flex-shrink-0"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Poster"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 flex flex-col gap-2">
            <Input
              placeholder="URL da imagem..."
              value={form.image}
              onChange={(e) => {
                set("image", e.target.value);
                setImagePreview(e.target.value || null);
              }}
            />
            <label
              className="flex items-center gap-2 h-8 px-3 text-xs rounded-[var(--radius-md)] cursor-pointer w-fit"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              <FiImage size={13} /> Upload de arquivo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
            </label>
          </div>
        </div>
      </div>

      <ClassificationPicker
        value={form.classification}
        onChange={(v) => set("classification", v)}
      />
    </Modal>
  );
}

// ─── Copy Session Modal ───────────────────────────────────────────────────────

function CopyModal({
  sourceLabel,
  onCopy,
  onClose,
}: {
  sourceLabel: string;
  onCopy: (target: SessionKey) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<SessionKey | "">("");
  return (
    <Modal title={`Copiar dados de ${sourceLabel}`} onClose={onClose}>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Selecione a sessão de destino:
      </p>
      <div className="flex flex-col gap-1.5">
        <label
          className="text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Sessão destino
        </label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as SessionKey)}
          className="h-11 px-3 text-sm rounded-[var(--radius-md)] outline-none cursor-pointer"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            color: target
              ? "var(--color-text-primary)"
              : "var(--color-text-muted)",
          }}
        >
          <option value="">Selecione...</option>
          {SESSIONS.filter((s) => s.label !== sourceLabel).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
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
          onClick={() => target && onCopy(target as SessionKey)}
          disabled={!target}
          className="flex-1 h-10 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-40"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Copiar
        </button>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  label,
  onConfirm,
  onClose,
  loading,
}: {
  label: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Modal title="Remover sessão" onClose={onClose}>
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
          Tem certeza que deseja remover o filme da <strong>{label}</strong>?
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
          {loading ? "Removendo..." : "Remover"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  film,
  onEdit,
  onCopy,
  onDelete,
}: {
  session: { key: SessionKey; label: string };
  film?: Film | null;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const classInfo = CLASSIFICATIONS.find(
    (c) => c.value === film?.classification,
  );

  return (
    <div
      className="group relative rounded-[var(--radius-lg)] overflow-hidden cursor-pointer"
      style={{
        aspectRatio: "2/3",
        backgroundColor: "var(--color-bg-elevated)",
        border: film
          ? "1px solid var(--color-border)"
          : "2px dashed var(--color-border)",
      }}
      onClick={film ? undefined : onEdit}
    >
      {film ? (
        <>
          {/* Poster */}
          {film.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={film.image}
              alt={film.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            >
              <FiImage size={32} style={{ color: "var(--color-text-muted)" }} />
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)",
            }}
          />

          {/* Session label + classification */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold text-white"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              {session.label}
            </span>
            {classInfo && (
              <span
                className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{ backgroundColor: classInfo.bg, color: classInfo.text }}
              >
                {classInfo.label}
              </span>
            )}
          </div>

          {/* Film info at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-sm font-bold text-white leading-tight line-clamp-2">
              {film.title}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {film.showtime} · {film.language}
            </p>
          </div>

          {/* Actions — visible on hover */}
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              title="Copiar para outra sessão"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "white",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.3)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.15)")
              }
            >
              <FiCopy size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Editar"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-primary-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--color-primary)")
              }
            >
              <FiEdit2 size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remover"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
              style={{ backgroundColor: "rgba(239,68,68,0.8)", color: "white" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--color-error)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.8)")
              }
            >
              <FiTrash2 size={15} />
            </button>
          </div>
        </>
      ) : (
        /* Empty session */
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              border: "2px dashed var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <FiPlus size={20} />
          </div>
          <div className="text-center">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {session.label}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Clique para adicionar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Popup Image Gallery ──────────────────────────────────────────────────────

function PopupImageGallery({
  history,
  selected,
  onSelect,
  onDelete,
}: {
  history: string[];
  selected: string;
  onSelect: (url: string) => void;
  onDelete: (url: string) => void;
}) {
  const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);

  if (history.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        Imagens anteriores — clique para reutilizar
      </p>
      <div className="flex flex-wrap gap-3">
        {history.map((url) => {
          const isActive = url === selected;
          const isHovered = hoveredUrl === url;

          return (
            <div
              key={url}
              className="relative flex-shrink-0"
              style={{ width: 60, height: 60 }}
              onMouseEnter={() => setHoveredUrl(url)}
              onMouseLeave={() => setHoveredUrl(null)}
            >
              {/* Thumbnail */}
              <button
                type="button"
                onClick={() => onSelect(url)}
                title="Usar esta imagem"
                className="w-full h-full rounded-[var(--radius-md)] overflow-hidden cursor-pointer transition-all"
                style={{
                  border: isActive
                    ? "2.5px solid var(--color-primary)"
                    : isHovered
                      ? "2.5px solid var(--color-border-focus)"
                      : "2px solid var(--color-border)",
                  padding: 0,
                  opacity: isHovered && !isActive ? 0.85 : 1,
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>

              {/* Active checkmark — bottom-right */}
              {isActive && (
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "2px solid var(--color-bg-surface)",
                  }}
                >
                  <FiCheck size={10} strokeWidth={3} />
                </div>
              )}

              {/* Delete button — top-left, shown on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(url);
                }}
                title="Remover da galeria"
                className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-all"
                style={{
                  backgroundColor: "var(--color-error)",
                  color: "white",
                  border: "2px solid var(--color-bg-surface)",
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? "auto" : "none",
                  transform: isHovered ? "scale(1)" : "scale(0.5)",
                  transition: "opacity 0.15s ease, transform 0.15s ease",
                }}
              >
                <FiX size={12} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Extra Settings ───────────────────────────────────────────────────────────

function ExtraSettings({
  config,
  onSave,
  saving,
}: {
  config: SiteConfig;
  onSave: (
    updates: Partial<SiteConfig>,
    popupFile: File | null,
  ) => Promise<void>;
  saving: boolean;
}) {
  const [isClosed, setIsClosed] = useState(config.isClosed ?? false);
  const [isEvent, setIsEvent] = useState<EventType>(config.isEvent ?? "");
  const [popUpEnabled, setPopUpEnabled] = useState(
    config.popUpEnabled ?? false,
  );
  const [popUpImage, setPopUpImage] = useState(config.popUpImage ?? "");
  const [popUpFile, setPopUpFile] = useState<File | null>(null);
  const [popUpPreview, setPopUpPreview] = useState<string | null>(
    config.popUpImage || null,
  );
  const [popUpTitle, setPopUpTitle] = useState(config.popUpTitle ?? "");
  const [popUpDescs, setPopUpDescs] = useState(
    (config.popUpDescriptions ?? []).join("\n"),
  );
  const [popupExpanded, setPopupExpanded] = useState(false);
  const [prices, setPrices] = useState<PriceRule[]>(config.prices ?? []);

  // Local copy of image history — syncs from config when Firestore updates
  const [imageHistory, setImageHistory] = useState<string[]>(
    config.popUpImageHistory ?? [],
  );

  // Sync all fields when config changes (after save → persistConfig → setConfig)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClosed(config.isClosed ?? false);
    setIsEvent(config.isEvent ?? "");
    setPopUpEnabled(config.popUpEnabled ?? false);
    setPopUpTitle(config.popUpTitle ?? "");
    setPopUpDescs((config.popUpDescriptions ?? []).join("\n"));
    setImageHistory(config.popUpImageHistory ?? []);
    setPrices(config.prices ?? []);
    // Only update image/preview if there's no pending local file
    setPopUpFile((prev) => {
      if (prev === null) {
        setPopUpImage(config.popUpImage ?? "");
        setPopUpPreview(config.popUpImage || null);
      }
      return prev;
    });
  }, [config]);

  function handlePopupFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPopUpFile(file);
    setPopUpPreview(URL.createObjectURL(file));
  }

  function handleSelectHistoryImage(url: string) {
    // Toggle: clicking the active image deselects it
    if (popUpImage === url) {
      setPopUpImage("");
      setPopUpPreview(null);
    } else {
      setPopUpImage(url);
      setPopUpPreview(url);
    }
    setPopUpFile(null); // clear any pending file upload
  }

  function handleDeleteHistoryImage(url: string) {
    // Remove from local state immediately (optimistic)
    setImageHistory((prev) => prev.filter((u) => u !== url));
    if (popUpImage === url) {
      setPopUpImage("");
      setPopUpPreview(null);
    }

    // Delete from Firebase Storage (only works for files we uploaded)
    try {
      const fileRef = storageRef(storage, url);
      deleteObject(fileRef).catch((err) => {
        // Silently ignore "object not found" — may be an external URL
        if (err?.code !== "storage/object-not-found") {
          console.warn("Erro ao deletar imagem do Storage:", err);
        }
      });
    } catch {
      // storageRef throws if the URL is not a valid Firebase Storage path
    }
  }

  async function handleSave() {
    const updates: Partial<SiteConfig> = {
      isClosed,
      isEvent,
      popUpEnabled,
      popUpTitle,
      prices,
      popUpDescriptions: popUpDescs
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      popUpImageHistory: imageHistory,
    };

    // só inclui popUpImage se NÃO tiver upload novo
    if (!popUpFile) {
      updates.popUpImage = popUpImage;
    }

    await onSave(updates, popUpFile);

    setPopUpFile(null);
  }

  return (
    <div
      className="flex flex-col gap-5 p-6 rounded-[var(--radius-xl)]"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Configurações extras
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <FiCheck size={14} />
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Cinema closed toggle */}
      <div className="flex flex-col gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-muted)" }}
        >
          Status do cinema
        </p>
        <button
          onClick={() => setIsClosed((v) => !v)}
          className="flex items-center gap-3 h-12 px-4 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all w-fit"
          style={{
            backgroundColor: isClosed
              ? "rgba(239,68,68,0.1)"
              : "rgba(34,197,94,0.1)",
            border: `1px solid ${isClosed ? "var(--color-error)" : "var(--color-success)"}`,
            color: isClosed ? "var(--color-error)" : "var(--color-success)",
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isClosed
                ? "var(--color-error)"
                : "var(--color-success)",
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          {isClosed ? "Cinema fechado" : "Cinema aberto"}
        </button>
      </div>

      {/* Event toggles */}
      <div className="flex flex-col gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-muted)" }}
        >
          Tema sazonal
        </p>
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((ev) => (
            <button
              key={ev.value}
              onClick={() => setIsEvent(ev.value)}
              className="flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all"
              style={{
                backgroundColor:
                  isEvent === ev.value
                    ? `${ev.color}22`
                    : "var(--color-bg-elevated)",
                border: `1px solid ${isEvent === ev.value ? ev.color : "var(--color-border)"}`,
                color:
                  isEvent === ev.value
                    ? ev.value
                      ? ev.color
                      : "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
              }}
            >
              <span>{ev.emoji}</span> {ev.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prices */}
      <div
        className="flex flex-col gap-5 p-5 rounded-[var(--radius-xl)]"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Tabela de Preços
              </p>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: "rgba(34,197,94,0.12)",
                  color: "var(--color-success)",
                  border: "1px solid rgba(34,197,94,0.25)",
                }}
              >
                <FiGlobe size={9} />
                Exibido no site
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Esses preços aparecem na página pública do Cine Drive-in. Cada regra define os valores de meia e inteira para um período da semana.
            </p>
          </div>
          <button
            onClick={() =>
              setPrices([
                ...prices,
                { label: "", days: [], meia: 0, inteira: 0 },
              ])
            }
            className="flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer flex-shrink-0 transition-all"
            style={{
              backgroundColor: "var(--color-primary-light)",
              color: "var(--color-primary)",
              border: "1px solid rgba(0,136,194,0.35)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,136,194,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-primary-light)")}
          >
            <FiPlus size={14} />
            Nova regra
          </button>
        </div>

        {/* Rules */}
        <div className="flex flex-col gap-3">
          {prices.map((p, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-lg)] overflow-hidden"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    border: "1px solid rgba(0,136,194,0.3)",
                  }}
                >
                  {i + 1}
                </span>
                <input
                  value={p.label}
                  onChange={(e) => {
                    const copy = [...prices];
                    copy[i].label = e.target.value;
                    setPrices(copy);
                  }}
                  placeholder="Ex: Segunda e Terça"
                  className="flex-1 bg-transparent text-sm outline-none font-medium"
                  style={{
                    color: p.label ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  }}
                />
                <button
                  onClick={() => setPrices(prices.filter((_, idx) => idx !== i))}
                  className="w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-all flex-shrink-0"
                  style={{ color: "var(--color-text-muted)" }}
                  title="Remover regra"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
                    e.currentTarget.style.color = "var(--color-error)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--color-text-muted)";
                  }}
                >
                  <FiX size={14} />
                </button>
              </div>

              {/* Price fields */}
              <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex flex-col gap-1 p-4">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    Meia-entrada
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={p.meia}
                      onChange={(e) => {
                        const copy = [...prices];
                        copy[i].meia = Number(e.target.value);
                        setPrices(copy);
                      }}
                      className="flex-1 bg-transparent text-xl font-bold outline-none"
                      style={{ color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    Estudantes, idosos e similares
                  </p>
                </div>

                <div className="flex flex-col gap-1 p-4" style={{ borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: "var(--color-border)" }}>
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    Inteira
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={p.inteira}
                      onChange={(e) => {
                        const copy = [...prices];
                        copy[i].inteira = Number(e.target.value);
                        setPrices(copy);
                      }}
                      className="flex-1 bg-transparent text-xl font-bold outline-none"
                      style={{ color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    Preço padrão
                  </p>
                </div>
              </div>

              {/* Preview */}
              {(p.label || p.meia > 0 || p.inteira > 0) && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    backgroundColor: "rgba(0,136,194,0.04)",
                  }}
                >
                  <FiGlobe size={11} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Aparece no site como:{" "}
                    <span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      {p.label || "—"} · Meia R$ {p.meia.toFixed(2).replace(".", ",")} / Inteira R$ {p.inteira.toFixed(2).replace(".", ",")}
                    </span>
                  </p>
                </div>
              )}
            </div>
          ))}

          {prices.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-10 gap-3 rounded-[var(--radius-lg)]"
              style={{
                border: "1px dashed var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <FiDollarSign size={24} style={{ opacity: 0.4 }} />
              <div className="text-center">
                <p className="text-sm font-medium">Nenhuma regra de preço cadastrada</p>
                <p className="text-xs mt-0.5">Clique em &quot;Nova regra&quot; para adicionar uma tabela de preços.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popup */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-text-muted)" }}
          >
            Pop-up do site
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPopUpEnabled((v) => !v)}
              className="flex items-center gap-2 h-8 px-3 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: popUpEnabled
                  ? "var(--color-primary-light)"
                  : "var(--color-bg-elevated)",
                border: `1px solid ${popUpEnabled ? "var(--color-primary)" : "var(--color-border)"}`,
                color: popUpEnabled
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
              }}
            >
              {popUpEnabled ? "Ativo" : "Inativo"}
            </button>
            <button
              onClick={() => setPopupExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs cursor-pointer"
              style={{ color: "var(--color-text-muted)" }}
            >
              {popupExpanded ? (
                <FiChevronUp size={14} />
              ) : (
                <FiChevronDown size={14} />
              )}
              {popupExpanded ? "Recolher" : "Editar"}
            </button>
          </div>
        </div>

        {popupExpanded && (
          <div
            className="flex flex-col gap-3 pl-3"
            style={{ borderLeft: "2px solid var(--color-border)" }}
          >
            {/* Preview + upload */}
            <div className="flex items-start gap-3">
              {popUpPreview && (
                <div
                  className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden flex-shrink-0"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={popUpPreview}
                    alt="Pop-up"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <Input
                  placeholder="URL da imagem do pop-up..."
                  value={popUpImage}
                  onChange={(e) => {
                    setPopUpImage(e.target.value);
                    setPopUpPreview(e.target.value || null);
                    setPopUpFile(null);
                  }}
                />
                <label
                  className="flex items-center gap-2 h-8 px-3 text-xs rounded-[var(--radius-md)] cursor-pointer w-fit"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <FiImage size={13} /> Upload de imagem
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePopupFile}
                  />
                </label>
              </div>
            </div>

            {/* Image history gallery */}
            <PopupImageGallery
              history={imageHistory}
              selected={popUpImage}
              onSelect={handleSelectHistoryImage}
              onDelete={handleDeleteHistoryImage}
            />

            <Input
              label="Título do pop-up"
              placeholder="Ex: Novidades no Cine Drive-in!"
              value={popUpTitle}
              onChange={(e) => setPopUpTitle(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Descrições (uma por linha)
              </label>
              <textarea
                value={popUpDescs}
                onChange={(e) => setPopUpDescs(e.target.value)}
                placeholder="Cada linha vira um parágrafo no pop-up..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] outline-none resize-y"
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
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SitePage() {
  const { appUser } = useAuth();
  const { success, error } = useToast();
  const canAccess = can(appUser, "view_site");
  const canManageMovies = can(appUser, "manage_movies");
  const canManageSiteSettings = can(appUser, "manage_site_settings");
  const actor = appUser
    ? { uid: appUser.uid, username: appUser.username }
    : { uid: "?", username: "?" };

  const [config, setConfig] = useState<SiteConfig>({
    siteUrl: "https://cinedrivein.com/",
    isClosed: false,
    isEvent: "",
    popUpEnabled: false,
    session1: null,
    session2: null,
    session3: null,
    session4: null,
  });
  const [loading, setLoading] = useState(true);
  const [savingExtra, setSavingExtra] = useState(false);
  const [siteUrl, setSiteUrl] = useState("https://cinedrivein.com/");
  const [savingUrl, setSavingUrl] = useState(false);

  const [editModal, setEditModal] = useState<{
    session: (typeof SESSIONS)[0];
  } | null>(null);
  const [copyModal, setCopyModal] = useState<{
    session: (typeof SESSIONS)[0];
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    session: (typeof SESSIONS)[0];
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load config
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "siteConfig", SITE_CONFIG_DOC));
        if (snap.exists()) {
          const data = snap.data() as SiteConfig;
          setConfig(data);
          if (data.siteUrl) setSiteUrl(data.siteUrl);
        }
      } catch (err) {
        console.error(err);
        error("Erro ao carregar configurações", "Tente recarregar.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Persist to Firestore
  async function persistConfig(updates: Partial<SiteConfig>) {
    const next = { ...config, ...updates };
    await setDoc(doc(db, "siteConfig", SITE_CONFIG_DOC), next, { merge: true });
    setConfig(next);
  }

  // Session: save film
  async function handleSaveFilm(
    sessionKey: SessionKey,
    film: Film,
    existing: Film | null | undefined,
  ) {
    const sessionLabel =
      SESSIONS.find((s) => s.key === sessionKey)?.label ?? sessionKey;
    try {
      await persistConfig({ [sessionKey]: film });
      success(
        existing ? "Sessão atualizada" : "Sessão adicionada",
        `Filme "${film.title}" salvo com sucesso.`,
      );

      if (existing) {
        // Compute film diff
        type C = { field: string; from: string | null; to: string | null };
        const changes: C[] = [];
        const str = (v: unknown) => (v == null || v === "" ? null : String(v));
        const arrStr = (a: string[]) => (a.length === 0 ? null : a.join(", "));

        if (film.title !== existing.title)
          changes.push({
            field: "Título",
            from: str(existing.title),
            to: str(film.title),
          });
        if (film.showtime !== existing.showtime)
          changes.push({
            field: "Horário",
            from: str(existing.showtime),
            to: str(film.showtime),
          });
        if (film.duration !== existing.duration)
          changes.push({
            field: "Duração",
            from: str(existing.duration),
            to: str(film.duration),
          });
        if (film.language !== existing.language)
          changes.push({
            field: "Idioma",
            from: str(existing.language),
            to: str(film.language),
          });
        if (film.classification !== existing.classification)
          changes.push({
            field: "Classificação",
            from: str(existing.classification),
            to: str(film.classification),
          });
        if (film.director !== existing.director)
          changes.push({
            field: "Direção",
            from: str(existing.director),
            to: str(film.director),
          });
        if (film.displayDate !== existing.displayDate)
          changes.push({
            field: "Exibição",
            from: str(existing.displayDate),
            to: str(film.displayDate),
          });
        if (film.trailer !== existing.trailer)
          changes.push({
            field: "Trailer",
            from: existing.trailer || null,
            to: film.trailer || null,
          });
        if (film.synopsis !== existing.synopsis)
          changes.push({
            field: "Sinopse",
            from: str(existing.synopsis),
            to: str(film.synopsis),
          });
        if (film.image !== existing.image)
          changes.push({
            field: "Imagem",
            from: existing.image ? "anterior" : null,
            to: "atualizada",
          });
        if (arrStr(film.writer) !== arrStr(existing.writer))
          changes.push({
            field: "Roteiro",
            from: arrStr(existing.writer),
            to: arrStr(film.writer),
          });
        if (arrStr(film.cast) !== arrStr(existing.cast))
          changes.push({
            field: "Elenco",
            from: arrStr(existing.cast),
            to: arrStr(film.cast),
          });
        if (arrStr(film.genres) !== arrStr(existing.genres))
          changes.push({
            field: "Gêneros",
            from: arrStr(existing.genres),
            to: arrStr(film.genres),
          });

        log({
          action: "update_film",
          category: "site",
          description: `Atualizou o filme "${film.title}" na ${sessionLabel}`,
          performedBy: actor,
          target: { type: "session", id: sessionKey, name: film.title },
          ...(changes.length > 0 && { changes }),
        });
      } else {
        log({
          action: "create_film",
          category: "site",
          description: `Adicionou o filme "${film.title}" na ${sessionLabel}`,
          performedBy: actor,
          target: { type: "session", id: sessionKey, name: film.title },
        });
      }
      setEditModal(null);
    } catch (err) {
      console.error(err);
      error("Erro ao salvar sessão", "Tente novamente.");
    }
  }

  // Session: copy
  async function handleCopySession(
    sourceKey: SessionKey,
    targetKey: SessionKey,
  ) {
    const film = config[sourceKey];
    if (!film) return;
    try {
      await persistConfig({ [targetKey]: film });
      const srcLabel =
        SESSIONS.find((s) => s.key === sourceKey)?.label ?? sourceKey;
      const dstLabel =
        SESSIONS.find((s) => s.key === targetKey)?.label ?? targetKey;
      success(
        "Sessão copiada",
        `Dados copiados de ${srcLabel} para ${dstLabel}.`,
      );
      log({
        action: "copy_session",
        category: "site",
        description: `Copiou os dados da ${srcLabel} para a ${dstLabel}`,
        performedBy: actor,
      });
      setCopyModal(null);
    } catch (err) {
      console.error(err);
      error("Erro ao copiar", "Tente novamente.");
    }
  }

  // Session: delete
  async function handleDeleteSession(
    sessionKey: SessionKey,
    sessionLabel: string,
  ) {
    setDeleteLoading(true);
    try {
      await persistConfig({ [sessionKey]: null });
      success("Sessão removida", `${sessionLabel} foi limpa.`);
      log({
        action: "delete_film",
        category: "site",
        description: `Removeu o filme da ${sessionLabel}`,
        performedBy: actor,
      });
      setDeleteModal(null);
    } catch (err) {
      console.error(err);
      error("Erro ao remover", "Tente novamente.");
    } finally {
      setDeleteLoading(false);
    }
  }

  // Save site URL
  async function handleSaveUrl() {
    const url = siteUrl.trim() || "https://cinedrivein.com/";
    setSavingUrl(true);
    try {
      await persistConfig({ siteUrl: url });
      success("URL salva", `Site configurado para ${url}`);
      log({
        action: "update_site_url",
        category: "site",
        description: `Atualizou a URL do site`,
        performedBy: actor,
        changes: [{ field: "URL", from: config.siteUrl || null, to: url }],
      });
    } catch (err) {
      console.error(err);
      error("Erro ao salvar URL", "Tente novamente.");
    } finally {
      setSavingUrl(false);
    }
  }

  // Extra settings save — merges uploaded image URL into history
  async function handleSaveExtra(
    updates: Partial<SiteConfig>,
    popupFile: File | null,
  ) {
    setSavingExtra(true);
    try {
      let popUpImageUrl = updates.popUpImage;
      if (popupFile) {
        popUpImageUrl = await uploadSitePhoto(popupFile, "site/popup");
      }

      // Build deduplicated history: new URL at front, keep existing non-deleted ones
      const existingHistory: string[] =
        updates.popUpImageHistory ?? config.popUpImageHistory ?? [];
      let nextHistory = existingHistory;
      if (popUpImageUrl && !existingHistory.includes(popUpImageUrl)) {
        nextHistory = [popUpImageUrl, ...existingHistory];
      }

      const final: Partial<SiteConfig> = {
        ...updates,
        popUpImage: popUpImageUrl,
        popUpImageHistory: nextHistory,
      };

      await persistConfig(final);
      success("Configurações salvas", "Alterações aplicadas ao site.");

      // Compute config diff
      type C = { field: string; from: string | null; to: string | null };
      const changes: C[] = [];
      const boolStr = (v: boolean | undefined) => (v ? "Sim" : "Não");
      const eventLabel = (v: EventType | undefined) =>
        EVENTS.find((e) => e.value === (v ?? ""))?.label ?? "Nenhum";

      if (final.isClosed !== config.isClosed)
        changes.push({
          field: "Cinema fechado",
          from: boolStr(config.isClosed),
          to: boolStr(final.isClosed),
        });
      if (final.isEvent !== config.isEvent)
        changes.push({
          field: "Tema sazonal",
          from: eventLabel(config.isEvent),
          to: eventLabel(final.isEvent),
        });
      if (final.popUpEnabled !== config.popUpEnabled)
        changes.push({
          field: "Pop-up",
          from: boolStr(config.popUpEnabled),
          to: boolStr(final.popUpEnabled),
        });
      if (final.popUpTitle !== config.popUpTitle)
        changes.push({
          field: "Título pop-up",
          from: config.popUpTitle || null,
          to: final.popUpTitle || null,
        });
      if (
        popupFile ||
        (final.popUpImage !== config.popUpImage && final.popUpImage)
      )
        changes.push({
          field: "Imagem pop-up",
          from: config.popUpImage ? "anterior" : null,
          to: "atualizada",
        });
      const oldDescs = (config.popUpDescriptions ?? []).join("|");
      const newDescs = (final.popUpDescriptions ?? []).join("|");
      if (oldDescs !== newDescs)
        changes.push({
          field: "Descrições pop-up",
          from: config.popUpDescriptions?.length
            ? `${config.popUpDescriptions.length} linha(s)`
            : null,
          to: final.popUpDescriptions?.length
            ? `${final.popUpDescriptions.length} linha(s)`
            : null,
        });

      function formatPrices(p?: PriceRule[]) {
        if (!p) return null;
        return p.map((r) => `${r.label}: M${r.meia}/I${r.inteira}`).join(" | ");
      }

      if (formatPrices(config.prices) !== formatPrices(final.prices)) {
        changes.push({
          field: "Preços",
          from: formatPrices(config.prices),
          to: formatPrices(final.prices),
        });
      }

      log({
        action: "update_site_config",
        category: "site",
        description: "Atualizou as configurações extras do site",
        performedBy: actor,
        ...(changes.length > 0 && { changes }),
      });
    } catch (err) {
      console.error(err);
      error("Erro ao salvar", "Tente novamente.");
    } finally {
      setSavingExtra(false);
    }
  }

  // ── Render ──
  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Configurações do Site
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Gerencie filmes em cartaz, eventos e configurações do site
            principal.
          </p>
        </div>

        {/* URL do site */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-[var(--radius-lg)]"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <FiGlobe
            size={16}
            className="flex-shrink-0 mt-0.5 sm:mt-0"
            style={{ color: "var(--color-primary)" }}
          />
          <div className="flex-1 min-w-0 w-full">
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              URL do site principal
            </p>
            <div className="flex gap-2">
              <input
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveUrl();
                }}
                placeholder="https://cinedrivein.com/"
                className="flex-1 h-9 px-3 text-sm rounded-[var(--radius-md)] outline-none min-w-0"
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
              <button
                onClick={handleSaveUrl}
                disabled={
                  savingUrl ||
                  siteUrl.trim() ===
                    (config.siteUrl ?? "https://cinedrivein.com/")
                }
                title="Salvar URL"
                className="h-9 px-3 rounded-[var(--radius-md)] text-sm cursor-pointer transition-all disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
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
                <FiSave size={14} />
                <span className="hidden sm:inline">
                  {savingUrl ? "Salvando..." : "Salvar"}
                </span>
              </button>
            </div>
          </div>
          <div className="flex justify-center items-end h-full w-full sm:w-fit">
            <a
              href={siteUrl || "https://cinedrivein.com/"}
              target="_blank"
              rel="noopener noreferrer"
              className=" flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all flex-shrink-0 w-full sm:w-auto justify-center"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-primary-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--color-primary)")
              }
            >
              <FiExternalLink size={15} />
              Ver site
            </a>
          </div>
        </div>
      </div>

      {!canAccess ? (
        <AccessDenied />
      ) : loading ? (
        <div className="flex justify-center py-20">
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
      ) : (
        <>
          {/* Sessions */}
          {canManageMovies ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Sessões em cartaz
                </h2>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Clique em uma sessão vazia para adicionar um filme ou passe o
                  mouse para editar.
                </p>
              </div>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                {SESSIONS.map((session) => (
                  <SessionCard
                    key={session.key}
                    session={session}
                    film={config[session.key]}
                    onEdit={() => setEditModal({ session })}
                    onCopy={() => setCopyModal({ session })}
                    onDelete={() => setDeleteModal({ session })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 p-4 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
            >
              <FiLock size={16} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Você não tem permissão para gerenciar filmes.
              </p>
            </div>
          )}

          {/* Extra settings */}
          {canManageSiteSettings ? (
            <ExtraSettings
              config={config}
              onSave={handleSaveExtra}
              saving={savingExtra}
            />
          ) : (
            <div
              className="flex items-center gap-3 p-4 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
            >
              <FiLock size={16} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Você não tem permissão para gerenciar configurações extras.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {editModal && (
        <FilmModal
          sessionLabel={editModal.session.label}
          existing={config[editModal.session.key]}
          onSave={(film) =>
            handleSaveFilm(
              editModal.session.key,
              film,
              config[editModal.session.key],
            )
          }
          onClose={() => setEditModal(null)}
        />
      )}
      {copyModal && (
        <CopyModal
          sourceLabel={copyModal.session.label}
          onCopy={(target) => handleCopySession(copyModal.session.key, target)}
          onClose={() => setCopyModal(null)}
        />
      )}
      {deleteModal && (
        <DeleteConfirm
          label={deleteModal.session.label}
          loading={deleteLoading}
          onConfirm={() =>
            handleDeleteSession(
              deleteModal.session.key,
              deleteModal.session.label,
            )
          }
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
