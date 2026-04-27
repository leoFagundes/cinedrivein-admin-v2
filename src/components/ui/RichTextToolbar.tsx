"use client";

interface Props {
  onFormat: (prefix: string, suffix: string) => void;
}

const TOOLS = [
  { label: "B", title: "Negrito (**texto**)", prefix: "**", suffix: "**", style: { fontWeight: 700 } },
  { label: "I", title: "Itálico (_texto_)", prefix: "_", suffix: "_", style: { fontStyle: "italic" } },
  { label: "S", title: "Sublinhado (__texto__)", prefix: "__", suffix: "__", style: { textDecoration: "underline" } },
  { label: "H1", title: "Título grande (# texto)", prefix: "# ", suffix: "", style: { fontSize: 11, fontWeight: 600 } },
  { label: "H2", title: "Título médio (## texto)", prefix: "## ", suffix: "", style: { fontSize: 11 } },
];

export default function RichTextToolbar({ onFormat }: Props) {
  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 flex-shrink-0"
      style={{
        backgroundColor: "var(--color-bg-base)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {TOOLS.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onFormat(t.prefix, t.suffix)}
          title={t.title}
          className="w-7 h-7 rounded flex items-center justify-center text-xs cursor-pointer transition-all"
          style={{
            color: "var(--color-text-secondary)",
            ...t.style,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)";
            e.currentTarget.style.color = "var(--color-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
        >
          {t.label}
        </button>
      ))}
      <div
        className="h-4 w-px mx-1"
        style={{ backgroundColor: "var(--color-border)" }}
      />
      <span
        className="text-[10px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        **negrito** &nbsp; _itálico_ &nbsp; __sublinhado__ &nbsp; # título
      </span>
    </div>
  );
}
