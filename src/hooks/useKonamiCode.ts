"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SEQUENCE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

/** Konami code (↑↑↓↓←→←→BA) como gatilho alternativo para o easter egg. */
export function useKonamiCode() {
  const router = useRouter();
  const progressRef = useRef(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const expected = SEQUENCE[progressRef.current];

      if (key === expected) {
        progressRef.current += 1;
        if (progressRef.current === SEQUENCE.length) {
          progressRef.current = 0;
          router.push("/easter-egg");
        }
      } else {
        progressRef.current = key === SEQUENCE[0] ? 1 : 0;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
