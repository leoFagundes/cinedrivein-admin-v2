"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const COLLECTION = "snakeScores";

export interface LeaderboardEntry {
  uid: string;
  username: string;
  highScore: number;
}

interface UseSnakeHighScoreResult {
  highScore: number;
  loaded: boolean;
  leaderboard: LeaderboardEntry[];
  /** Posição no ranking geral (1º, 2º...), ou null enquanto não há recorde/não foi calculada ainda. */
  rank: number | null;
  /** Salva o placar se (e só se) for maior que o recorde pessoal atual. */
  submitScore: (score: number) => Promise<boolean>;
}

/** Recorde pessoal do Snake, salvo no Firestore por uid — nunca some ao trocar de dispositivo. */
export function useSnakeHighScore(
  uid: string | undefined,
  username: string | undefined,
): UseSnakeHighScoreResult {
  const [highScore, setHighScore] = useState(0);
  const [loaded, setLoaded] = useState(() => !uid);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const highScoreRef = useRef(0);

  const refreshLeaderboard = useCallback(() => {
    const q = query(
      collection(db, COLLECTION),
      orderBy("highScore", "desc"),
      limit(5),
    );
    getDocs(q)
      .then((snap) => {
        setLeaderboard(
          snap.docs.map((d) => ({
            uid: d.id,
            username: (d.data().username as string) ?? "Jogador",
            highScore: (d.data().highScore as number) ?? 0,
          })),
        );
      })
      .catch(() => {});
  }, []);

  // Posição = quantos jogadores têm placar maior, +1. Empates dividem a posição.
  const refreshRank = useCallback(
    (score: number) => {
      if (!uid || score <= 0) {
        setRank(null);
        return;
      }
      const q = query(collection(db, COLLECTION), where("highScore", ">", score));
      getCountFromServer(q)
        .then((snap) => setRank(snap.data().count + 1))
        .catch(() => setRank(null));
    },
    [uid],
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, COLLECTION, uid))
      .then((snap) => {
        if (cancelled) return;
        const value = snap.exists()
          ? ((snap.data().highScore as number) ?? 0)
          : 0;
        highScoreRef.current = value;
        setHighScore(value);
        setLoaded(true);
        refreshRank(value);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, refreshRank]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  const submitScore = useCallback(
    async (score: number) => {
      if (!uid || score <= highScoreRef.current) return false;
      highScoreRef.current = score;
      setHighScore(score);
      try {
        await setDoc(
          doc(db, COLLECTION, uid),
          {
            username: username ?? "Jogador",
            highScore: score,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        refreshLeaderboard();
        refreshRank(score);
      } catch {}
      return true;
    },
    [uid, username, refreshLeaderboard, refreshRank],
  );

  return { highScore, loaded, leaderboard, rank, submitScore };
}
