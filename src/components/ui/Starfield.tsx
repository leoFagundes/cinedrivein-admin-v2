"use client";

import { useEffect, useRef } from "react";

interface StarfieldProps {
  reducedMotion: boolean;
}

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const CONFETTI_COLORS = ["#eaf6ff", "#0088c2", "#fff4d6"];
const CATCH_RADIUS = 32;
const HOVER_RADIUS = 40;

/** Céu estrelado animado em canvas — estrelas cintilantes + estrelas cadentes caçáveis (clique = confete). */
export default function Starfield({ reducedMotion }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: Star[] = [];
    let shooting: ShootingStar[] = [];
    let confetti: ConfettiParticle[] = [];
    let raf = 0;
    let lastShootAt = 0;

    function spawnConfetti(x: number, y: number) {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.08 + Math.random() * 0.14;
        confetti.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.05,
          life: 0,
          maxLife: 700 + Math.random() * 400,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 2 + Math.random() * 2.5,
        });
      }
    }

    function resize() {
      const parent = canvas!.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.floor((width * height) / 3800);
      stars = Array.from({ length: count }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.75,
        r: Math.random() * 1.3 + 0.3,
        baseAlpha: Math.random() * 0.5 + 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
      }));
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, width, height);
      for (const s of stars) {
        ctx!.globalAlpha = s.baseAlpha;
        ctx!.fillStyle = "#eaf6ff";
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function tick(t: number) {
      ctx!.clearRect(0, 0, width, height);

      for (const s of stars) {
        const twinkle = Math.sin(t * s.speed + s.phase) * 0.5 + 0.5;
        ctx!.globalAlpha = s.baseAlpha * (0.55 + twinkle * 0.45);
        ctx!.fillStyle = "#eaf6ff";
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      if (t - lastShootAt > 4200 + Math.random() * 3500) {
        lastShootAt = t;
        shooting.push({
          x: Math.random() * width * 0.6 + width * 0.2,
          y: Math.random() * height * 0.15,
          vx: 0.55 + Math.random() * 0.25,
          vy: 0.3 + Math.random() * 0.15,
          life: 0,
          maxLife: 900 + Math.random() * 300,
        });
      }

      shooting = shooting.filter((sh) => sh.life < sh.maxLife);
      for (const sh of shooting) {
        sh.life += 16;
        sh.x += sh.vx * 16;
        sh.y += sh.vy * 16;
        const progress = sh.life / sh.maxLife;
        const alpha = Math.sin(progress * Math.PI);
        const tailLen = 70;
        const grad = ctx!.createLinearGradient(
          sh.x,
          sh.y,
          sh.x - tailLen,
          sh.y - tailLen * (sh.vy / sh.vx),
        );
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.6;
        ctx!.beginPath();
        ctx!.moveTo(sh.x, sh.y);
        ctx!.lineTo(sh.x - tailLen, sh.y - tailLen * (sh.vy / sh.vx));
        ctx!.stroke();
      }

      confetti = confetti.filter((p) => p.life < p.maxLife);
      for (const p of confetti) {
        p.life += 16;
        p.vy += 0.0009 * 16;
        p.x += p.vx * 16;
        p.y += p.vy * 16;
        const progress = p.life / p.maxLife;
        ctx!.globalAlpha = 1 - progress;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      raf = requestAnimationFrame(tick);
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const idx = shooting.findIndex(
        (sh) => Math.hypot(sh.x - x, sh.y - y) < CATCH_RADIUS,
      );
      if (idx !== -1) {
        const [caught] = shooting.splice(idx, 1);
        spawnConfetti(caught.x, caught.y);
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const near = shooting.some(
        (sh) => Math.hypot(sh.x - x, sh.y - y) < HOVER_RADIUS,
      );
      canvas!.style.cursor = near ? "pointer" : "default";
    }

    resize();
    if (reducedMotion) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(tick);
    }

    const onResize = () => {
      resize();
      if (reducedMotion) drawStatic();
    };
    window.addEventListener("resize", onResize);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full select-none"
      aria-hidden
    />
  );
}
