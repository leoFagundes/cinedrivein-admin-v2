"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { FiRotateCcw, FiArrowLeft } from "react-icons/fi";

interface CreditsProps {
  reducedMotion: boolean;
  starringName: string;
  visitCount: number;
  onReplay: () => void;
  onReturn: () => void;
}

function buildBlocks(
  starringName: string,
  visitCount: number,
): { role: string; value: string }[] {
  const blocks = [
    { role: "Estrelando", value: starringName },
    { role: "Direção", value: "A pessoa que clicou 5x no logo" },
    { role: "Produção", value: "CineDriveIn" },
    { role: "Efeitos especiais", value: "CSS, canvas e um pouco de café" },
    { role: "Trilha sonora", value: "O silêncio do painel às 3 da manhã" },
    {
      role: "Com apoio de",
      value: "Next.js · React · Firebase · Tailwind",
    },
    {
      role: "Agradecimentos especiais",
      value: "A você, que cuida desse sistema todos os dias",
    },
  ];

  if (visitCount >= 3) {
    blocks.push({
      role: "Reprise",
      value: `Você já viu essa sessão ${visitCount}x — obrigado por voltar`,
    });
  }

  return blocks;
}

function CreditBlock({ role, value }: { role: string; value: string }) {
  return (
    <div className="text-center mb-14">
      <p
        className="text-[11px] uppercase tracking-[0.35em] mb-2"
        style={{ color: "rgba(139,146,168,0.9)" }}
      >
        {role}
      </p>
      <p
        className="text-lg font-semibold"
        style={{ color: "#eaf6ff" }}
      >
        {value}
      </p>
    </div>
  );
}

export default function Credits({
  reducedMotion,
  starringName,
  visitCount,
  onReplay,
  onReturn,
}: CreditsProps) {
  const [showActions, setShowActions] = useState(reducedMotion);
  const blocks = buildBlocks(starringName, visitCount);

  useEffect(() => {
    if (reducedMotion) return;
    const t = setTimeout(() => setShowActions(true), 4000);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  const actions = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: showActions ? 1 : 0, y: showActions ? 0 : 12 }}
      transition={{ duration: 0.6 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-3"
      style={{ pointerEvents: showActions ? "auto" : "none" }}
    >
      <button
        onClick={onReplay}
        className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all"
        style={{
          backgroundColor: "rgba(24,28,37,0.85)",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border)",
          backdropFilter: "blur(6px)",
        }}
      >
        <FiRotateCcw size={14} />
        Assistir novamente
      </button>
      <button
        onClick={onReturn}
        className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-85"
        style={{ backgroundColor: "var(--color-primary)", color: "white" }}
      >
        <FiArrowLeft size={14} />
        Voltar à sessão
      </button>
    </motion.div>
  );

  if (reducedMotion) {
    return (
      <div className="absolute inset-0 overflow-y-auto pt-16 pb-32 px-4">
        <p
          className="text-center font-bold mb-12"
          style={{
            color: "#eaf6ff",
            fontSize: "2rem",
            letterSpacing: "0.2em",
          }}
        >
          FIM
        </p>
        {blocks.map((b) => (
          <CreditBlock key={b.role} {...b} />
        ))}
        {actions}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: "-135%" }}
        transition={{ duration: 20, ease: "linear" }}
        className="absolute left-0 right-0 px-4"
      >
        <p
          className="text-center font-bold mb-16"
          style={{
            color: "#eaf6ff",
            fontSize: "2.4rem",
            letterSpacing: "0.25em",
            textShadow: "0 0 30px rgba(120,190,255,0.4)",
          }}
        >
          FIM
        </p>
        {blocks.map((b) => (
          <CreditBlock key={b.role} {...b} />
        ))}
        <p
          className="text-center text-sm mb-4"
          style={{ color: "rgba(139,146,168,0.7)" }}
        >
          Obrigado por assistir.
        </p>
      </motion.div>
      {actions}
    </div>
  );
}
