"use client";

import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const CLICKS_NEEDED = 5;
const CLICK_TIMEOUT_MS = 700;
const RETURN_KEY = "cdi_ee_return";

/** Clique 5x rápido no logo para abrir o easter egg escondido. */
export function useLogoEasterEgg() {
  const router = useRouter();
  const pathname = usePathname();
  const countRef = useRef(0);
  const lastClickRef = useRef(0);

  return function onLogoClick() {
    const now = Date.now();
    if (now - lastClickRef.current > CLICK_TIMEOUT_MS) {
      countRef.current = 0;
    }
    lastClickRef.current = now;
    countRef.current += 1;

    if (countRef.current >= CLICKS_NEEDED) {
      countRef.current = 0;
      try {
        sessionStorage.setItem(RETURN_KEY, pathname || "/admin/dashboard");
      } catch {}
      router.push("/easter-egg");
    }
  };
}
