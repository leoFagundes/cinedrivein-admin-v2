"use client";

import { useEffect, useRef, useState } from "react";
import { FiPlay, FiPause } from "react-icons/fi";
import {
  createInitialState,
  isOpposite,
  step,
  tickDurationForScore,
  type Direction,
  type GameState,
  type Point,
} from "./gameLogic";

const MAX_QUEUED_DIRECTIONS = 2;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const GRID_SIZE = 20;
const CELL = 22;
const SIZE = GRID_SIZE * CELL;

const KEY_TO_DIRECTION: Record<string, Direction> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

// Farol dianteiro (mesmo tom quente dos carros do easter egg) por direção.
const HEAD_LIGHTS: Record<Direction, [[number, number], [number, number]]> = {
  up: [
    [0.24, 0.1],
    [0.76, 0.1],
  ],
  down: [
    [0.24, 0.9],
    [0.76, 0.9],
  ],
  left: [
    [0.1, 0.24],
    [0.1, 0.76],
  ],
  right: [
    [0.9, 0.24],
    [0.9, 0.76],
  ],
};

type Status = "idle" | "playing" | "paused" | "over";

interface SnakeGameProps {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export default function SnakeGame({ onScoreChange, onGameOver }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatusState] = useState<Status>("idle");
  const [displayScore, setDisplayScore] = useState(0);

  const initialState = createInitialState(GRID_SIZE);
  const statusRef = useRef<Status>("idle");
  const stateRef = useRef<GameState>(initialState);
  const prevSnakeRef = useRef<Point[]>(initialState.snake);
  const directionQueueRef = useRef<Direction[]>([]);
  const lastTickRef = useRef<number | null>(null);
  const lastReportedScoreRef = useRef(0);
  const rafRef = useRef(0);

  // Sempre a versão mais recente dos callbacks, sem precisar reiniciar o loop.
  const onScoreChangeRef = useRef(onScoreChange);
  const onGameOverRef = useRef(onGameOver);
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange;
    onGameOverRef.current = onGameOver;
  }, [onScoreChange, onGameOver]);

  // Enfileira uma direção — validada contra a última pendente (não a atual),
  // pra não perder um giro de 90° só porque uma segunda tecla chegou logo
  // depois. Reversões de 180° seguem bloqueadas, e a fila tem um limite curto
  // pra não acumular teclas antigas que o jogador já esqueceu ter apertado.
  function queueDirection(dir: Direction) {
    const queue = directionQueueRef.current;
    const effectiveCurrent =
      queue.length > 0 ? queue[queue.length - 1] : stateRef.current.direction;
    if (dir === effectiveCurrent || isOpposite(effectiveCurrent, dir)) return;
    if (queue.length >= MAX_QUEUED_DIRECTIONS) return;
    queue.push(dir);
  }

  function reportScore(newScore: number) {
    lastReportedScoreRef.current = newScore;
    setDisplayScore(newScore);
    onScoreChangeRef.current(newScore);
  }

  function setStatus(next: Status) {
    statusRef.current = next;
    setStatusState(next);
  }

  function startGame() {
    setStatus("playing");
    lastTickRef.current = null;
  }

  function pauseGame() {
    if (statusRef.current !== "playing") return;
    directionQueueRef.current = []; // não deixa giros "envelhecerem" durante a pausa
    setStatus("paused");
  }

  function resumeGame() {
    if (statusRef.current !== "paused") return;
    prevSnakeRef.current = stateRef.current.snake; // evita "pulo" ao retomar em plena transição
    setStatus("playing");
    lastTickRef.current = null;
  }

  function restartGame() {
    stateRef.current = createInitialState(GRID_SIZE);
    prevSnakeRef.current = stateRef.current.snake;
    directionQueueRef.current = [];
    lastTickRef.current = null;
    reportScore(0);
    setStatus("playing");
  }

  function handlePrimaryAction() {
    switch (statusRef.current) {
      case "idle":
        startGame();
        break;
      case "playing":
        pauseGame();
        break;
      case "paused":
        resumeGame();
        break;
      case "over":
        restartGame();
        break;
    }
  }

  // ── Loop principal (rAF único, com acumulador de tempo) ──
  useEffect(() => {
    function draw(progress: number, timestamp: number) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const s = stateRef.current;
      const prevSnake = prevSnakeRef.current;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Grid sutil
      ctx.strokeStyle = "rgba(234,246,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(SIZE, i * CELL);
        ctx.stroke();
      }

      // Comida — estrelinha brilhante, com leve pulso
      const pulse = statusRef.current === "playing" ? Math.sin(timestamp / 260) : 0;
      const fx = s.food.x * CELL + CELL / 2;
      const fy = s.food.y * CELL + CELL / 2;
      ctx.save();
      ctx.shadowColor = "rgba(255,244,214,0.8)";
      ctx.shadowBlur = 8 + pulse * 3;
      ctx.fillStyle = "#fff4d6";
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.24 + pulse * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Cobra — cada segmento desliza suavemente da posição anterior até a atual
      s.snake.forEach((seg, i) => {
        const from = prevSnake[i] ?? prevSnake[prevSnake.length - 1] ?? seg;
        const gx = lerp(from.x, seg.x, progress);
        const gy = lerp(from.y, seg.y, progress);
        const x = gx * CELL + 1.5;
        const y = gy * CELL + 1.5;
        const w = CELL - 3;
        const isHead = i === 0;

        ctx.fillStyle = isHead ? "#28a9e0" : "#0088c2";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, w, w, isHead ? 7 : 5);
        } else {
          ctx.rect(x, y, w, w);
        }
        ctx.fill();

        if (isHead) {
          const [[lx, ly], [rx, ry]] = HEAD_LIGHTS[s.direction];
          ctx.fillStyle = "#fff4d6";
          ctx.beginPath();
          ctx.arc(x + w * lx, y + w * ly, 1.6, 0, Math.PI * 2);
          ctx.arc(x + w * rx, y + w * ry, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    function loop(timestamp: number) {
      rafRef.current = requestAnimationFrame(loop);

      let progress = 1;

      if (statusRef.current === "playing") {
        if (lastTickRef.current === null) lastTickRef.current = timestamp;
        const elapsed = timestamp - lastTickRef.current;
        const tickDuration = tickDurationForScore(stateRef.current.score);
        progress = Math.min(elapsed / tickDuration, 1);

        if (elapsed >= tickDuration) {
          lastTickRef.current = timestamp;
          prevSnakeRef.current = stateRef.current.snake;
          const nextDirection =
            directionQueueRef.current.shift() ?? stateRef.current.direction;
          stateRef.current = step(stateRef.current, nextDirection);
          progress = 0;

          if (stateRef.current.score !== lastReportedScoreRef.current) {
            reportScore(stateRef.current.score);
          }

          if (stateRef.current.gameOver) {
            progress = 1; // mostra a cobra já na posição da colisão, sem atraso
            setStatus("over");
            onGameOverRef.current(stateRef.current.score);
          }
        }
      }

      draw(progress, timestamp);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Teclado ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();

      if (key in KEY_TO_DIRECTION) {
        e.preventDefault();
        queueDirection(KEY_TO_DIRECTION[key]);
        if (statusRef.current === "idle") startGame();
        return;
      }

      if (key === " ") {
        e.preventDefault();
        handlePrimaryAction();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pausa automática ao sair da aba ──
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) pauseGame();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative rounded-[8px] overflow-hidden cursor-pointer select-none"
      style={{
        width: SIZE,
        height: SIZE,
        background:
          "radial-gradient(ellipse at center, rgba(10,16,26,0.7) 0%, rgba(8,12,20,0.92) 75%)",
        border: "2px solid rgba(180,220,255,0.18)",
        boxShadow:
          "0 0 60px 12px rgba(120,190,255,0.10), inset 0 0 40px rgba(0,0,0,0.5)",
      }}
      onClick={handlePrimaryAction}
    >
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />

      {status !== "playing" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6"
          style={{ backgroundColor: "rgba(4,5,10,0.6)" }}
        >
          {status === "idle" && (
            <>
              <FiPlay size={26} style={{ color: "#0088C2" }} />
              <p className="text-sm font-semibold" style={{ color: "#eaf6ff" }}>
                Pressione uma tecla ou clique para começar
              </p>
              <p className="text-xs" style={{ color: "rgba(139,146,168,0.9)" }}>
                Setas ou WASD para mover · Espaço para pausar
              </p>
            </>
          )}
          {status === "paused" && (
            <>
              <FiPause size={26} style={{ color: "#0088C2" }} />
              <p className="text-sm font-semibold" style={{ color: "#eaf6ff" }}>
                Pausado
              </p>
              <p className="text-xs" style={{ color: "rgba(139,146,168,0.9)" }}>
                Espaço ou clique para continuar
              </p>
            </>
          )}
          {status === "over" && (
            <>
              <p
                className="text-lg font-bold"
                style={{ color: "#eaf6ff", letterSpacing: "0.1em" }}
              >
                Fim de jogo
              </p>
              <p className="text-sm" style={{ color: "rgba(139,146,168,0.9)" }}>
                Pontuação: {displayScore}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(139,146,168,0.9)" }}>
                Espaço ou clique para jogar novamente
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
