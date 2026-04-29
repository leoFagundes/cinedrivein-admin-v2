import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { LogCategory, LogChange } from "@/types";

export interface LogEntry {
  action: string;
  category: LogCategory;
  description: string;
  performedBy: { uid: string; username: string };
  target?: { type: string; id: string; name: string };
  changes?: LogChange[];
}

/**
 * Cria um log de atividade no Firestore.
 * Fire-and-forget: não deve bloquear a ação principal.
 */
export function log(entry: LogEntry): void {
  const raw = { ...entry, createdAt: serverTimestamp() };
  const data = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  );
  addDoc(collection(db, "logs"), data).catch((err) =>
    console.error("[logger] Falha ao salvar log:", err),
  );
}
