"use client";

import { useEffect } from "react";
import { ref, onValue, onDisconnect, set, remove, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Registra presença do admin logado em `adminPresence/{uid}` (RTDB), pro
 * indicador "ativo agora" na página de Usuários. Padrão canônico de presença
 * do Firebase: reage a `.info/connected` e reagenda o `onDisconnect` a cada
 * reconexão, garantindo que o registro suma sozinho se a conexão cair sem
 * aviso (fechar a aba, perder internet). Falha de escrita é silenciosa — não
 * deve quebrar o app se as regras do RTDB não permitirem este path ainda.
 */
export function useAdminPresence() {
  const { appUser } = useAuth();

  useEffect(() => {
    if (!appUser?.uid) return;

    const myPresenceRef = ref(rtdb, `adminPresence/${appUser.uid}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return;
      onDisconnect(myPresenceRef)
        .remove()
        .then(() => {
          set(myPresenceRef, {
            username: appUser.username,
            since: serverTimestamp(),
          });
        })
        .catch(() => {});
    });

    return () => {
      unsub();
      remove(myPresenceRef).catch(() => {});
    };
  }, [appUser?.uid, appUser?.username]);
}
