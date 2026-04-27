"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiHome, FiFilm } from "react-icons/fi";

function FilmStrip() {
  return (
    <>
      <div
        className="fixed left-0 top-0 bottom-0 w-12 flex flex-col justify-around items-center py-4 pointer-events-none select-none"
        style={{
          borderRight: "2px solid var(--color-border)",
          opacity: 0.15,
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="w-5 h-4 rounded-sm"
            style={{ backgroundColor: "var(--color-text-secondary)" }}
          />
        ))}
      </div>
      <div
        className="fixed right-0 top-0 bottom-0 w-12 flex flex-col justify-around items-center py-4 pointer-events-none select-none"
        style={{
          borderLeft: "2px solid var(--color-border)",
          opacity: 0.15,
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="w-5 h-4 rounded-sm"
            style={{ backgroundColor: "var(--color-text-secondary)" }}
          />
        ))}
      </div>
    </>
  );
}

export default function NotFound() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative px-4 overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <FilmStrip />

      {/* Glow behind 404 */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,136,194,0.12) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-md">
        {/* Logo */}
        <Image
          src="/images/logo-drivein.svg"
          alt="Cine Drive-in"
          width={56}
          height={56}
          priority
        />

        {/* 404 */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <FiFilm
              size={32}
              style={{ color: "var(--color-primary)", opacity: 0.7 }}
            />
            <span
              className="font-black"
              style={{
                fontSize: "clamp(5rem, 20vw, 8rem)",
                lineHeight: 1,
                color: "var(--color-primary)",
                letterSpacing: "-4px",
                textShadow: "0 0 40px rgba(0,136,194,0.4)",
              }}
            >
              404
            </span>
            <FiFilm
              size={32}
              style={{
                color: "var(--color-primary)",
                opacity: 0.7,
                transform: "scaleX(-1)",
              }}
            />
          </div>

          <div
            className="h-px w-48"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <p
            className="text-xl font-semibold mt-1"
            style={{ color: "var(--color-text-primary)" }}
          >
            Cena não encontrada
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            A página que você está procurando não existe ou foi removida.
            <br />
            Verifique o endereço ou volte ao painel.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all"
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
            <FiArrowLeft size={15} />
            Voltar
          </button>
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary)", color: "white" }}
          >
            <FiHome size={15} />
            Ir para o painel
          </Link>
        </div>

        {/* Footer label */}
        <p
          className="text-xs mt-4"
          style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
        >
          Cine Drive-in · Painel Administrativo
        </p>
      </div>
    </main>
  );
}
