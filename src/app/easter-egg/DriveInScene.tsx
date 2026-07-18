"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { MORSE_WORD } from "./morse";
import Car from "./Car";
import Screen from "./Screen";

interface DriveInSceneProps {
  reducedMotion: boolean;
  showTitle: boolean;
  showScreen: boolean;
  visitCount: number;
}

const MORSE_CAR_INDEX = 3;
const CAR_COUNT = 7;

export default function DriveInScene({
  reducedMotion,
  showTitle,
  showScreen,
  visitCount,
}: DriveInSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 40, damping: 18, mass: 0.6 });
  const smy = useSpring(my, { stiffness: 40, damping: 18, mass: 0.6 });

  const screenX = useTransform(smx, [-1, 1], [6, -6]);
  const screenY = useTransform(smy, [-1, 1], [4, -4]);
  const carsX = useTransform(smx, [-1, 1], [-14, 14]);

  useEffect(() => {
    if (reducedMotion) return;
    function onMove(e: MouseEvent) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      mx.set((e.clientX / w) * 2 - 1);
      my.set((e.clientY / h) * 2 - 1);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion, mx, my]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes carGlowPulse {
          0%, 100% { opacity: 0.55; box-shadow: 0 0 6px 2px rgba(255,244,214,0.35); }
          50% { opacity: 1; box-shadow: 0 0 10px 3px rgba(255,244,214,0.75), 0 0 26px 8px rgba(255,244,214,0.25); }
        }
        @keyframes screenFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.96; }
        }
      `}</style>

      {/* Projection beam */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          bottom: 0,
          width: 0,
          height: 0,
          transform: "translateX(-50%)",
          borderLeft: "3px solid transparent",
          borderRight: "3px solid transparent",
          borderBottom: "72vh solid rgba(180,220,255,0.05)",
          filter: "blur(2px)",
          borderLeftWidth: "38vw",
          borderRightWidth: "38vw",
        }}
      />

      <AnimatePresence>
        {showScreen && (
          <Screen
            key="screen"
            reducedMotion={reducedMotion}
            showTitle={showTitle}
            visitCount={visitCount}
            screenX={screenX}
            screenY={screenY}
          />
        )}
      </AnimatePresence>

      {/* Cars */}
      <motion.div
        className="absolute left-1/2 flex items-end gap-6"
        style={{
          bottom: "12%",
          x: carsX,
          translateX: "-50%",
        }}
      >
        {Array.from({ length: CAR_COUNT }).map((_, i) => (
          <Car
            key={i}
            index={i}
            morseActive={i === MORSE_CAR_INDEX}
            morseWord={MORSE_WORD}
            reducedMotion={reducedMotion}
          />
        ))}
      </motion.div>
    </div>
  );
}
