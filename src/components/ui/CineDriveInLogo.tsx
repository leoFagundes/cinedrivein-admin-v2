"use client";

import { useRef } from "react";

interface CineDriveInLogoProps {
  glow?: boolean;
}

export default function CineDriveInLogo({
  glow = false,
}: CineDriveInLogoProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  function restartAnim() {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-anim]");
    els.forEach((e) => {
      e.style.animation = "none";
      void e.offsetHeight;
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        els.forEach((e) => (e.style.animation = ""));
      }),
    );
  }

  return (
    <>
      <style>{`
        .cdi-wrap {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          position: relative;
          padding: 26px 42px;
        }

        .cdi-glow {
          position: absolute;
          inset: -120px -80px;
          background:
            radial-gradient(ellipse 65% 45% at 50% 50%, rgba(0,136,194,0.28) 0%, transparent 50%),
            radial-gradient(ellipse 110% 80% at 50% 50%, rgba(0,136,194,0.10) 0%, transparent 70%),
            radial-gradient(ellipse 160% 120% at 50% 50%, rgba(0,136,194,0.04) 0%, transparent 90%);
          pointer-events: none;
          z-index: 0;
          filter: blur(32px);
          animation: cdi-glowPulse 4s ease-in-out infinite alternate;
        }
        @keyframes cdi-glowPulse {
          from { opacity: 0.55; transform: scale(0.96); }
          to   { opacity: 1;    transform: scale(1.04); }
        }

        .cdi-cine {
          font-family: "Georgia", serif;
          font-style: italic;
          font-size: 2.4rem;
          font-weight: 400;
          color: #0088C2;
          letter-spacing: 0.04em;
          line-height: 1;
          margin-bottom: -4px;
          position: relative;
          z-index: 2;
          opacity: 0;
          transform: translateY(14px) scale(0.9);
          animation: cdi-cineIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
        }
        @keyframes cdi-cineIn {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .cdi-badge {
          border: 2.5px solid #0088C2;
          padding: 5px 24px 6px;
          position: relative;
          z-index: 2;
          opacity: 0;
          animation: cdi-badgeIn 0.45s ease 0.85s forwards;
        }
        .cdi-badge::before,
        .cdi-badge::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 26px;
          height: 2.5px;
          background: #0088C2;
          transform: translateY(-50%);
        }
        .cdi-badge::before { left: -28px; }
        .cdi-badge::after  { right: -28px; }
        @keyframes cdi-badgeIn {
          from { opacity: 0; transform: scaleX(0.3); }
          to   { opacity: 1; transform: scaleX(1); }
        }

        .cdi-badge-text {
          font-family: "Arial Black", "Arial", sans-serif;
          font-size: 1.6rem;
          font-weight: 900;
          color: #0088C2;
          letter-spacing: 0.18em;
          clip-path: inset(0 100% 0 0);
          animation: cdi-reveal 0.55s cubic-bezier(0.77, 0, 0.175, 1) 0.95s forwards;
        }
        @keyframes cdi-reveal {
          to { clip-path: inset(0 0% 0 0); }
        }

        .cdi-dashes {
          display: flex;
          align-items: center;
          margin-top: -1px;
          position: relative;
          z-index: 2;
          opacity: 0;
          animation: cdi-fadeUp 0.4s ease 1.4s forwards;
        }
        .cdi-dash { height: 2px; background: #0088C2; opacity: 0.55; }
        .cdi-dash-l { width: 44px; }
        .cdi-dash-r { width: 72px; }
        .cdi-dot {
          width: 20px; height: 20px;
          border: 2px solid #0088C2;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          opacity: 0.65;
          margin: 0 6px;
        }
        .cdi-dot-inner {
          width: 5px; height: 5px;
          background: #0088C2;
          border-radius: 50%;
        }

        .cdi-tagline {
          margin-top: 16px;
          font-family: "Arial", sans-serif;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.32em;
          color: #4a8fa8;
          text-transform: uppercase;
          position: relative;
          z-index: 2;
          opacity: 0;
          transform: translateY(6px);
          animation: cdi-fadeUp 0.5s ease 1.7s forwards;
        }

        @keyframes cdi-fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        .cdi-replay {
          position: absolute;
          top: 6px;
          right: 6px;
          background: transparent;
          border: 1px solid rgba(0,136,194,0.35);
          border-radius: 50%;
          width: 26px; height: 26px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 3;
          opacity: 0;
          animation: cdi-fadeUp 0.4s ease 2.1s forwards;
          transition: border-color 0.2s, background 0.2s;
          padding: 0;
        }
        .cdi-replay:hover {
          background: rgba(0,136,194,0.1);
          border-color: #0088C2;
        }
      `}</style>

      <div className="cdi-wrap" ref={rootRef}>
        {glow && <div className="cdi-glow" />}

        <div className="cdi-cine" data-anim>
          cine
        </div>

        <div className="cdi-badge" data-anim>
          <div className="cdi-badge-text" data-anim>
            DRIVE-IN
          </div>
        </div>

        <div className="cdi-dashes" data-anim>
          <div className="cdi-dash cdi-dash-l" />
          <div className="cdi-dot">
            <div className="cdi-dot-inner" />
          </div>
          <div className="cdi-dash cdi-dash-r" />
        </div>

        <div className="cdi-tagline" data-anim>
          cinema fora de série
        </div>
      </div>
    </>
  );
}
