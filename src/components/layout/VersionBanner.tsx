"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { FiRefreshCw, FiX } from "react-icons/fi";
import { db } from "@/lib/firebase";

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const TOKEN_KEY = "cdi_version_update";
const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos
const RETRY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos

function readToken(): number | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { timestamp } = JSON.parse(raw) as { timestamp: number };
    if (Date.now() - timestamp > TOKEN_EXPIRY_MS) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return timestamp;
  } catch {
    return null;
  }
}

function writeToken() {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ timestamp: Date.now() }));
}

function deleteToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export default function VersionBanner() {
  const [outdated, setOutdated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  // timestamp do clique original (null = nunca clicou / token expirado)
  const [tokenTs, setTokenTs] = useState<number | null>(null);
  // true quando já passaram 3 min desde o clique
  const [canRetry, setCanRetry] = useState(false);

  // Ao montar: verifica token existente e agenda o canRetry se necessário
  useEffect(() => {
    const ts = readToken();
    if (ts === null) return;
    setTokenTs(ts);
    const elapsed = Date.now() - ts;
    if (elapsed >= RETRY_THRESHOLD_MS) {
      setCanRetry(true);
    } else {
      const remaining = RETRY_THRESHOLD_MS - elapsed;
      const timer = setTimeout(() => setCanRetry(true), remaining);
      return () => clearTimeout(timer);
    }
  }, []);

  // Escuta versão remota
  useEffect(() => {
    return onSnapshot(doc(db, "storeConfig", "version"), (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data().version as string;
      setRemoteVersion(remote);
      if (remote !== CURRENT_VERSION) {
        setOutdated(true);
      } else {
        deleteToken();
      }
    });
  }, []);

  if (!outdated || dismissed) return null;

  function handleUpdate() {
    writeToken();
    // Append version param to bust browser cache on the HTML document
    const url = new URL(window.location.href);
    url.searchParams.set("v", remoteVersion ?? Date.now().toString());
    window.location.replace(url.toString());
  }

  const isWaiting = tokenTs !== null;

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

      {isWaiting ? (
        <>
          <p className="flex-1 text-xs" style={{ color: "var(--color-warning)" }}>
            {canRetry
              ? "A atualização pode já estar disponível. Tente recarregar agora."
              : "Aguardando o servidor concluir a atualização..."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 shrink-0"
            style={
              canRetry
                ? { backgroundColor: "var(--color-warning)", color: "white" }
                : {
                    backgroundColor: "transparent",
                    color: "var(--color-warning)",
                    border: "1px solid rgba(245,158,11,0.5)",
                    opacity: 0.75,
                  }
            }
          >
            <FiRefreshCw size={12} className={!canRetry ? "animate-spin" : ""} />
            Recarregar
          </button>
        </>
      ) : (
        <>
          <p className="flex-1 text-xs" style={{ color: "var(--color-warning)" }}>
            Nova versão disponível{remoteVersion ? ` (${remoteVersion})` : ""} — recarregue para atualizar.
          </p>
          <button
            onClick={handleUpdate}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 shrink-0"
            style={{ backgroundColor: "var(--color-warning)", color: "white" }}
          >
            <FiRefreshCw size={12} />
            Atualizar
          </button>
        </>
      )}

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
