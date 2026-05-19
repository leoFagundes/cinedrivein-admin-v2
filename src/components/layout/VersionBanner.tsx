"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { FiRefreshCw, FiX } from "react-icons/fi";
import { db } from "@/lib/firebase";

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

export default function VersionBanner() {
  const [outdated, setOutdated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, "storeConfig", "version"), (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data().version as string;
      setRemoteVersion(remote);
      if (remote !== CURRENT_VERSION) setOutdated(true);
    });
  }, []);

  if (!outdated || dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 shrink-0"
      style={{
        backgroundColor: "rgba(245,158,11,0.1)",
        borderBottom: "1px solid rgba(245,158,11,0.3)",
      }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: "var(--color-warning)" }}
      />
      <p className="flex-1 text-xs" style={{ color: "var(--color-warning)" }}>
        Nova versão disponível{remoteVersion ? ` (${remoteVersion})` : ""} — recarregue para atualizar.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-md)] text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 shrink-0"
        style={{ backgroundColor: "var(--color-warning)", color: "white" }}
      >
        <FiRefreshCw size={12} />
        Atualizar
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded cursor-pointer transition-opacity hover:opacity-70 shrink-0"
        style={{ color: "var(--color-warning)" }}
        title="Fechar"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}
