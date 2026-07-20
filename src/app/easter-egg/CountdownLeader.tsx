"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

interface CountdownLeaderProps {
  reducedMotion: boolean;
  onDone: () => void;
}

const NUMBERS = [3, 2, 1];
const R = 100;
const CENTER = 110;
const CIRCUMFERENCE = 2 * Math.PI * R;

const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

function Tick({ angle }: { angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const major = angle % 90 === 0;
  const outer = R + 4;
  const inner = major ? R - 10 : R - 5;
  const x1 = CENTER + outer * Math.sin(rad);
  const y1 = CENTER - outer * Math.cos(rad);
  const x2 = CENTER + inner * Math.sin(rad);
  const y2 = CENTER - inner * Math.cos(rad);
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#e8f4fb"
      strokeWidth={major ? 1.4 : 0.7}
      opacity={major ? 0.45 : 0.2}
    />
  );
}

export default function CountdownLeader({
  reducedMotion,
  onDone,
}: CountdownLeaderProps) {
  const [index, setIndex] = useState(0);
  const stepMs = reducedMotion ? 500 : 900;

  useEffect(() => {
    if (index >= NUMBERS.length) {
      const t = setTimeout(onDone, reducedMotion ? 150 : 320);
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
          93% { opacity: 0.85; }
          94% { opacity: 1; }
          97% { opacity: 0.92; }
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
          background: rgba(255,255,255,0.08);
          animation: scratchDrift 0.35s linear infinite alternate;
        }
      `}</style>

      {/* Soft vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(20,26,38,0.4) 0%, rgba(0,0,0,0.85) 78%)",
        }}
      />

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

      {/* Frame flash on each beat — subtle nod to a real film countdown leader */}
      {!reducedMotion && (
        <motion.div
          key={`flash-${index}`}
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: "#fff" }}
          initial={{ opacity: 0.1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      )}

      {/* Countdown clock */}
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width={220} height={220} viewBox="0 0 220 220" className="absolute inset-0">
          {TICKS.map((a) => (
            <Tick key={a} angle={a} />
          ))}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            fill="none"
            stroke="#e8f4fb"
            strokeWidth={1}
            opacity={0.18}
          />
          {index < NUMBERS.length && (
            <motion.circle
              key={`ring-${index}`}
              cx={CENTER}
              cy={CENTER}
              r={R}
              fill="none"
              stroke="#e8f4fb"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              style={{ opacity: 0.85 }}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: CIRCUMFERENCE }}
              transition={{ duration: stepMs / 1000, ease: "linear" }}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {index < NUMBERS.length && (
              <motion.span
                key={NUMBERS[index]}
                initial={{ opacity: 0, scale: 1.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{
                  duration: reducedMotion ? 0.15 : 0.3,
                  ease: "easeOut",
                }}
                className="select-none"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "5.5rem",
                  fontWeight: 600,
                  color: "#e8f4fb",
                  textShadow: "0 0 26px rgba(232,244,251,0.4)",
                }}
              >
                {NUMBERS[index]}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p
        className="absolute bottom-8 text-[10px] tracking-[0.4em] uppercase select-none"
        style={{ color: "rgba(232,244,251,0.35)" }}
      >
        Cine Drive-in · Bobina 1
      </p>
    </div>
  );
}
