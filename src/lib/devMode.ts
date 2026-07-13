import { Permission } from "@/types";

export interface DevModeFlags {
  disableLogs: boolean;
  logToConsole: boolean;
  disableToasts: boolean;
  bypassPermissions: boolean;
  showDocIds: boolean;
  skipConfirmations: boolean;
  simulateRole: { name: string; permissions: Permission[] } | null;
}

const KEY = "__devMode";

const DEFAULTS: DevModeFlags = {
  disableLogs: false,
  logToConsole: false,
  disableToasts: false,
  bypassPermissions: false,
  showDocIds: false,
  skipConfirmations: false,
  simulateRole: null,
};

export function getDevMode(): DevModeFlags {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setDevMode(flags: Partial<DevModeFlags>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ ...getDevMode(), ...flags }));
}

export function resetDevMode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function isDevModeActive(): boolean {
  return Object.values(getDevMode()).some(Boolean);
}

export function dispatchDevModeChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("devmode:change"));
  }
}
