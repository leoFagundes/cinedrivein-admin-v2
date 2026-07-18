"use client";

import { useCallback, useState } from "react";
import { FiZap, FiMonitor, FiAward, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import Starfield from "@/components/ui/Starfield";
import SnakeGame from "./SnakeGame";
import { useSnakeHighScore } from "./useSnakeHighScore";

function SmallScreenNotice() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="flex flex-col items-center text-center gap-3 max-w-xs px-6 py-8 rounded-[var(--radius-xl)]"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <FiMonitor size={28} style={{ color: "var(--color-primary)" }} />
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Tela pequena demais
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Essa sessão secreta precisa de uma tela maior. Abra em um computador
          ou notebook para jogar.
        </p>
      </div>
    </div>
  );
}

export default function SnakePage() {
  const { appUser } = useAuth();
  const { success } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [score, setScore] = useState(0);
  const { highScore, leaderboard, rank, submitScore } = useSnakeHighScore(
    appUser?.uid,
    appUser?.username,
  );
  const isInTopFive = leaderboard.some((e) => e.uid === appUser?.uid);

  const handleGameOver = useCallback(
    async (finalScore: number) => {
      const isRecord = await submitScore(finalScore);
      if (isRecord) {
        success("Novo recorde!", `${finalScore} pontos — seu melhor até agora.`);
      }
    },
    [submitScore, success],
  );

  if (!isLargeScreen) {
    return <SmallScreenNotice />;
  }

  return (
    <div
      className="flex-1 relative overflow-hidden flex items-center justify-center p-6"
      style={{
        background:
          "linear-gradient(to bottom, #04050a 0%, #070a13 55%, #0b0f1a 100%)",
      }}
    >
      <div className="absolute inset-0" style={{ opacity: 0.5 }}>
        <Starfield reducedMotion={reducedMotion} />
      </div>

      <div className="relative z-10 flex flex-wrap items-start justify-center gap-8">
        <SnakeGame onScoreChange={setScore} onGameOver={handleGameOver} />

        <div className="flex flex-col gap-5 w-56 pt-2">
          <div className="flex items-center gap-2">
            <FiZap size={18} style={{ color: "#0088C2" }} />
            <h1
              className="text-lg font-bold uppercase"
              style={{ color: "#eaf6ff", letterSpacing: "0.08em" }}
            >
              Snake
            </h1>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "rgba(139,146,168,0.9)" }}
              >
                Pontuação
              </p>
              <p className="text-2xl font-bold" style={{ color: "#eaf6ff" }}>
                {score}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "rgba(139,146,168,0.9)" }}
              >
                Seu recorde
              </p>
              <p
                className="text-lg font-semibold flex items-center gap-1.5"
                style={{ color: "#0088C2" }}
              >
                <FiAward size={15} />
                {Math.max(highScore, score)}
              </p>
            </div>
          </div>

          {leaderboard.length > 0 && (
            <div
              className="rounded-[var(--radius-md)] px-3 py-3"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(234,246,255,0.1)",
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.3em] mb-2 flex items-center gap-1.5"
                style={{ color: "rgba(139,146,168,0.9)" }}
              >
                <FiTrendingUp size={11} />
                Melhores
              </p>
              <div className="flex flex-col gap-1.5">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.uid}
                    className="flex items-center justify-between text-xs"
                    style={{
                      color:
                        entry.uid === appUser?.uid
                          ? "#eaf6ff"
                          : "rgba(139,146,168,0.9)",
                      fontWeight: entry.uid === appUser?.uid ? 600 : 400,
                    }}
                  >
                    <span className="truncate">
                      {i + 1}. {entry.username}
                    </span>
                    <span className="flex-shrink-0 ml-2">{entry.highScore}</span>
                  </div>
                ))}
              </div>

              {!isInTopFive && rank != null && (
                <p
                  className="text-xs mt-2 pt-2"
                  style={{
                    color: "#eaf6ff",
                    fontWeight: 600,
                    borderTop: "1px solid rgba(234,246,255,0.1)",
                  }}
                >
                  Você está em #{rank}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
