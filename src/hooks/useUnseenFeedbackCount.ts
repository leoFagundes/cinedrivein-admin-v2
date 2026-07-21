"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { recordFirestoreRead } from "@/lib/firestoreDevTracker";

/** Contagem ao vivo de avaliações não vistas — só escuta o Firestore quando `enabled`. */
export function useUnseenFeedbackCount(enabled: boolean): number {
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(collection(db, "feedbacks"), (snap) => {
      recordFirestoreRead(snap.docChanges().length);
      setLiveCount(snap.docs.filter((d) => !(d.data().seen ?? false)).length);
    });
    return unsub;
  }, [enabled]);

  return enabled ? liveCount : 0;
}
