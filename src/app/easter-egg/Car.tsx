"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "motion";
import { buildMorseSchedule } from "./morse";
import { playHonk } from "./honk";

interface CarProps {
  index: number;
  morseActive: boolean;
  morseWord: string;
  reducedMotion: boolean;
}

function useMorseBlink(active: boolean, word: string) {
  const [on, setOn] = useState(true);
  const schedule = useMemo(() => buildMorseSchedule(word), [word]);

  useEffect(() => {
    if (!active) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const seg = schedule[i % schedule.length];
      setOn(seg.on);
      i += 1;
      timer = setTimeout(step, seg.duration);
    };
    step();

    return () => clearTimeout(timer);
  }, [active, schedule]);

  return on;
}

export default function Car({
  index,
  morseActive,
  morseWord,
  reducedMotion,
}: CarProps) {
  const morseOn = useMorseBlink(morseActive && !reducedMotion, morseWord);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastHonkRef = useRef(0);
  const [honkFlash, setHonkFlash] = useState(false);

  const lit = (morseActive ? (reducedMotion ? true : morseOn) : true) || honkFlash;
  const flickerDelay = (index * 0.37) % 1.6;

  function handleHonk() {
    const now = Date.now();
    if (now - lastHonkRef.current < 400) return;
    lastHonkRef.current = now;

    playHonk();
    setHonkFlash(true);
    setTimeout(() => setHonkFlash(false), 320);

    if (!reducedMotion && rootRef.current) {
      animate(
        rootRef.current,
        { scale: [1, 1.12, 0.94, 1.03, 1] },
        { duration: 0.45, ease: "easeOut" },
      );
    }
  }

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Buzinar"
      onClick={handleHonk}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleHonk();
        }
      }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.18)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
      className="relative flex-shrink-0 cursor-pointer"
      style={{ width: 84, height: 46, transformOrigin: "50% 100%" }}
    >
      {/* Body */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-[6px]"
        style={{ height: 26, background: "#0d1420", opacity: 0.92 }}
      />
      {/* Roof */}
      <div
        className="absolute left-3 right-3"
        style={{
          bottom: 22,
          height: 16,
          background: "#0d1420",
          opacity: 0.92,
          clipPath: "polygon(12% 100%, 22% 0%, 78% 0%, 88% 100%)",
        }}
      />
      {/* Headlights */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: 6,
          left: 4,
          width: 8,
          height: 8,
          background: lit ? "#fff4d6" : "#3a3626",
          opacity: lit ? 1 : 0.4,
          boxShadow: lit
            ? "0 0 10px 3px rgba(255,244,214,0.75), 0 0 26px 8px rgba(255,244,214,0.25)"
            : "none",
          transition:
            morseActive && !honkFlash
              ? "none"
              : "box-shadow 1.8s ease-in-out, opacity 1.8s ease-in-out",
          animation:
            !morseActive && !reducedMotion && !honkFlash
              ? `carGlowPulse 3.2s ease-in-out ${flickerDelay}s infinite`
              : undefined,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: 6,
          right: 4,
          width: 8,
          height: 8,
          background: lit ? "#fff4d6" : "#3a3626",
          opacity: lit ? 1 : 0.4,
          boxShadow: lit
            ? "0 0 10px 3px rgba(255,244,214,0.75), 0 0 26px 8px rgba(255,244,214,0.25)"
            : "none",
          transition:
            morseActive && !honkFlash
              ? "none"
              : "box-shadow 1.8s ease-in-out, opacity 1.8s ease-in-out",
          animation:
            !morseActive && !reducedMotion && !honkFlash
              ? `carGlowPulse 3.2s ease-in-out ${flickerDelay}s infinite`
              : undefined,
        }}
      />
    </div>
  );
}
