"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

interface CountdownLeaderProps {
  reducedMotion: boolean;
  onDone: () => void;
}

const NUMBERS = [3, 2, 1];

export default function CountdownLeader({
  reducedMotion,
  onDone,
}: CountdownLeaderProps) {
  const [index, setIndex] = useState(0);
  const stepMs = reducedMotion ? 500 : 850;

  useEffect(() => {
    if (index >= NUMBERS.length) {
      const t = setTimeout(onDone, reducedMotion ? 150 : 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIndex((i) => i + 1), stepMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#000" }}
    >
      <style>{`
        @keyframes leaderFlicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.82; }
          94% { opacity: 1; }
          97% { opacity: 0.9; }
          98% { opacity: 1; }
        }
        .leader-flicker { animation: leaderFlicker 2.6s steps(1) infinite; }

        @keyframes scratchDrift {
          from { transform: translateY(-8%); }
          to   { transform: translateY(8%); }
        }
        .leader-scratch {
          position: absolute;
          top: -10%;
          bottom: -10%;
          width: 1px;
          background: rgba(255,255,255,0.10);
          animation: scratchDrift 0.35s linear infinite alternate;
        }
      `}</style>

      {!reducedMotion && (
        <div className="leader-flicker absolute inset-0">
          <div className="leader-scratch" style={{ left: "18%" }} />
          <div
            className="leader-scratch"
            style={{ left: "63%", animationDuration: "0.5s" }}
          />
          <div
            className="leader-scratch"
            style={{ left: "81%", animationDuration: "0.28s" }}
          />
        </div>
      )}

      {/* Reticle */}
      <svg
        width="220"
        height="220"
        viewBox="0 0 220 220"
        className="absolute"
        style={{ opacity: 0.55 }}
      >
        <circle
          cx="110"
          cy="110"
          r="98"
          fill="none"
          stroke="#e8f4fb"
          strokeWidth="1.5"
        />
        <line x1="110" y1="4" x2="110" y2="216" stroke="#e8f4fb" strokeWidth="1" />
        <line x1="4" y1="110" x2="216" y2="110" stroke="#e8f4fb" strokeWidth="1" />
      </svg>

      <AnimatePresence mode="wait">
        {index < NUMBERS.length && (
          <motion.span
            key={NUMBERS[index]}
            initial={{ opacity: 0, scale: 1.35 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.32, ease: "easeOut" }}
            className="relative select-none"
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "7rem",
              fontWeight: 700,
              color: "#e8f4fb",
              textShadow: "0 0 24px rgba(232,244,251,0.35)",
            }}
          >
            {NUMBERS[index]}
          </motion.span>
        )}
      </AnimatePresence>

      <p
        className="absolute bottom-8 text-[10px] tracking-[0.4em] uppercase select-none"
        style={{ color: "rgba(232,244,251,0.35)" }}
      >
        Cine Drive-in · Bobina 1
      </p>
    </div>
  );
}
