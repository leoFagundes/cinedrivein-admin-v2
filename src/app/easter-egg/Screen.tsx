"use client";

import { useState } from "react";
import { motion, AnimatePresence, type MotionValue } from "motion/react";
import { FiFilm, FiZap, FiStar, FiEye, FiKey } from "react-icons/fi";
import CineDriveInLogo from "@/components/ui/CineDriveInLogo";

interface ScreenProps {
  reducedMotion: boolean;
  showTitle: boolean;
  visitCount: number;
  screenX: MotionValue<number>;
  screenY: MotionValue<number>;
}

interface FunFact {
  icon: React.ReactNode;
  label: string;
  text: string;
  code?: string;
}

export default function Screen({
  reducedMotion,
  showTitle,
  visitCount,
  screenX,
  screenY,
}: ScreenProps) {
  const [cardIndex, setCardIndex] = useState(0);

  const facts: FunFact[] = [
    {
      icon: <FiFilm size={20} />,
      label: "Curiosidade",
      text: "Essa sessão roda 100% em Next.js, React e Firebase.",
    },
    {
      icon: <FiZap size={20} />,
      label: "Dica",
      text: "Um dos carros pisca Morse nos faróis: flash curto = ponto, flash longo = traço.",
    },
    {
      icon: <FiKey size={20} />,
      label: "Pista",
      text: "Decodificou a mensagem? Ela é o caminho de uma página secreta.",
      code: "https://admin.cinedrivein.com/admin/<código>/",
    },
    {
      icon: <FiStar size={20} />,
      label: "Dica",
      text: "Tente clicar numa estrela cadente.",
    },
  ];

  if (visitCount >= 3) {
    facts.push({
      icon: <FiEye size={20} />,
      label: "Psiu",
      text: `Essa é sua ${visitCount}ª vez aqui. Determinação de dev raiz.`,
    });
  }

  const total = facts.length + 1;
  const activeFact = cardIndex > 0 ? facts[cardIndex - 1] : null;

  return (
    <motion.div
      className="absolute left-1/2"
      style={{
        top: "10%",
        width: "min(46vw, 480px)",
        height: "min(26vw, 270px)",
        x: screenX,
        y: screenY,
        translateX: "-50%",
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: reducedMotion ? 0.2 : 0.7 }}
    >
      <div
        onClick={() => setCardIndex((i) => (i + 1) % total)}
        className="w-full h-full rounded-[8px] flex items-center justify-center relative cursor-pointer"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10,16,26,0.55) 0%, rgba(8,12,20,0.85) 75%)",
          border: "2px solid rgba(180,220,255,0.18)",
          boxShadow:
            "0 0 60px 12px rgba(120,190,255,0.10), inset 0 0 40px rgba(0,0,0,0.5)",
          animation: reducedMotion
            ? undefined
            : "screenFlicker 3.4s ease-in-out infinite",
        }}
      >
        <AnimatePresence mode="wait">
          {activeFact ? (
            <motion.div
              key={cardIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center text-center px-6 gap-2"
            >
              <div style={{ color: "#0088C2" }}>{activeFact.icon}</div>
              <p
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "rgba(139,146,168,0.9)" }}
              >
                {activeFact.label}
              </p>
              <p
                className="text-sm font-medium leading-snug"
                style={{ color: "#eaf6ff" }}
              >
                {activeFact.text}
              </p>
              {activeFact.code && (
                <p
                  className="text-[11px] px-2.5 py-1 rounded"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    color: "#7dd3fc",
                    backgroundColor: "rgba(0,136,194,0.12)",
                    border: "1px solid rgba(0,136,194,0.3)",
                  }}
                >
                  {activeFact.code}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{ transform: "scale(0.42)" }}
            >
              <CineDriveInLogo glow />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === cardIndex ? 5 : 4,
                height: i === cardIndex ? 5 : 4,
                backgroundColor:
                  i === cardIndex
                    ? "rgba(0,136,194,0.9)"
                    : "rgba(234,246,255,0.25)",
              }}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showTitle && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute left-1/2 -translate-x-1/2 text-center px-2"
            style={{ top: "112%", width: "max(140%, 280px)" }}
          >
            <p
              className="font-bold uppercase"
              style={{
                color: "#eaf6ff",
                fontSize: "clamp(1.1rem, 2.4vw, 1.8rem)",
                letterSpacing: "0.3em",
                textShadow: "0 0 30px rgba(120,190,255,0.5)",
              }}
            >
              Cine Drive-in Admin
            </p>
            <p
              className="text-xs tracking-[0.3em] uppercase mt-2"
              style={{ color: "rgba(234,246,255,0.55)" }}
            >
              você encontrou a sessão secreta
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
