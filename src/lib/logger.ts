import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { LogCategory, LogChange } from "@/types";
import { getDevMode } from "./devMode";
import { recordFirestoreWrite } from "./firestoreDevTracker";

export interface LogEntry {
  action: string;
  category: LogCategory;
  description: string;
  performedBy: { uid: string; username: string };
  target?: { type: string; id: string; name: string };
  changes?: LogChange[];
  snapshot?: Record<string, unknown>;
}

/**
 * Cria um log de atividade no Firestore.
 * Fire-and-forget: não deve bloquear a ação principal.
 */
export function log(entry: LogEntry): void {
  const { disableLogs, logToConsole } = getDevMode();
  if (disableLogs) return;
  if (logToConsole) {
    console.log(
      `[log] ${entry.category} › ${entry.action}`,
      entry.description,
      entry,
    );
    return;
  }
  const raw = { ...entry, createdAt: serverTimestamp() };
  const data = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  );
  addDoc(collection(db, "logs"), data)
    .then(() => recordFirestoreWrite(1))
    .catch((err) => console.error("[logger] Falha ao salvar log:", err));
}
