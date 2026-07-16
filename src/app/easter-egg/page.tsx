"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { FiX } from "react-icons/fi";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAuth } from "@/contexts/AuthContext";
import Starfield from "./Starfield";
import CountdownLeader from "./CountdownLeader";
import DriveInScene from "./DriveInScene";
import Credits from "./Credits";

type Phase = "vanity" | "leader" | "iris" | "scene" | "credits";

const RETURN_KEY = "cdi_ee_return";
const VISITS_KEY = "cdi_ee_visits";
const SCENE_HOLD_MS = 4800;
const VANITY_HOLD_MS = 1000;
const HOLE_DIAMETER = 6000;

export default function EasterEggPage() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const { appUser } = useAuth();
  const [phase, setPhase] = useState<Phase>("vanity");
  const [runId, setRunId] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [visitCount] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const stored = Number(localStorage.getItem(VISITS_KEY) ?? "0");
      const next = (Number.isFinite(stored) ? stored : 0) + 1;
      localStorage.setItem(VISITS_KEY, String(next));
      return next;
    } catch {
      return 1;
    }
  });

  const starringName = appUser?.username?.trim() || "Você";

  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), 700);
    return () => clearTimeout(t);
  }, [runId]);

  useEffect(() => {
    if (phase !== "vanity") return;
    const t = setTimeout(
      () => setPhase("leader"),
      reducedMotion ? 300 : VANITY_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "scene") return;
    const t = setTimeout(() => setPhase("credits"), SCENE_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const goBack = useCallback(() => {
    setLeaving(true);
    let target = "/admin/dashboard";
    try {
      target = sessionStorage.getItem(RETURN_KEY) || target;
    } catch {}
    setTimeout(() => router.push(target), reducedMotion ? 60 : 380);
  }, [router, reducedMotion]);

  const replay = useCallback(() => {
    setPhase("vanity");
    setRunId((id) => id + 1);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") goBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  return (
    <motion.main
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reducedMotion ? 0.06 : 0.38 }}
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background:
          "linear-gradient(to bottom, #04050a 0%, #070a13 55%, #0b0f1a 100%)",
      }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1 }}
        animate={{ scale: reducedMotion ? 1 : 1.05 }}
        transition={{ duration: 30, ease: "linear" }}
      >
        <Starfield reducedMotion={reducedMotion} />
        <DriveInScene
          key={`scene-${runId}`}
          reducedMotion={reducedMotion}
          showTitle={phase === "scene"}
          showScreen={phase !== "credits"}
          visitCount={visitCount}
        />
      </motion.div>

      {phase === "credits" && (
        <Credits
          reducedMotion={reducedMotion}
          starringName={starringName}
          visitCount={visitCount}
          onReplay={replay}
          onReturn={goBack}
        />
      )}

      {phase === "vanity" && (
        <motion.div
          key={`vanity-${runId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.4 }}
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ backgroundColor: "#000" }}
        >
          <p
            className="text-center uppercase"
            style={{
              color: "rgba(232,244,251,0.85)",
              fontSize: "clamp(0.9rem, 2.2vw, 1.4rem)",
              letterSpacing: "0.4em",
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
            }}
          >
            Cine Drive-in Pictures apresenta
          </p>
        </motion.div>
      )}

      {phase === "leader" && (
        <CountdownLeader
          key={`leader-${runId}`}
          reducedMotion={reducedMotion}
          onDone={() => setPhase("iris")}
        />
      )}

      {phase === "iris" && (
        <motion.div
          key={`iris-${runId}`}
          className="fixed rounded-full pointer-events-none z-40"
          style={{
            top: "50%",
            left: "50%",
            translateX: "-50%",
            translateY: "-50%",
            boxShadow: "0 0 0 100vmax #04050a",
          }}
          initial={{ width: 0, height: 0 }}
          animate={{ width: HOLE_DIAMETER, height: HOLE_DIAMETER }}
          transition={{
            duration: reducedMotion ? 0.4 : 1.15,
            ease: [0.76, 0, 0.24, 1],
          }}
          onAnimationComplete={() => setPhase("scene")}
        />
      )}

      {showSkip && phase !== "credits" && (
        <button
          onClick={goBack}
          className="fixed top-5 right-5 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-opacity hover:opacity-100"
          style={{
            backgroundColor: "rgba(10,14,22,0.55)",
            color: "rgba(234,246,255,0.55)",
            border: "1px solid rgba(234,246,255,0.15)",
            backdropFilter: "blur(6px)",
            opacity: 0.7,
          }}
        >
          <FiX size={12} />
          Sair
        </button>
      )}
    </motion.main>
  );
}
