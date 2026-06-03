"use client";

import { useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface NotifSettings {
  notifyZeroStock: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
}

interface CachedAlert {
  resolved: boolean;
  quantity: number;
}

interface ParsedItem {
  id: string;
  name: string;
  photo: string | undefined;
  quantity: number;
  trackStock: boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  notifyZeroStock: true,
  notifyLowStock: true,
  lowStockThreshold: 5,
};

export function StockAlertProvider({ children }: { children: React.ReactNode }) {
  const settingsRef = useRef<NotifSettings>(DEFAULT_SETTINGS);
  // Local mirror of Firestore stockAlerts — prevents redundant writes
  const alertsRef = useRef<Map<string, CachedAlert>>(new Map());
  // Items are queued until the first alerts snapshot loads (race condition guard)
  const alertsReadyRef = useRef(false);
  const pendingRef = useRef<Array<{ item: ParsedItem; removed: boolean }>>([]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function ensureActive(
    alertId: string,
    item: ParsedItem,
    type: "zero_stock" | "low_stock",
  ) {
    const existing = alertsRef.current.get(alertId);

    if (!existing || existing.resolved) {
      // New alert or re-triggered after stock was restored
      setDoc(doc(db, "stockAlerts", alertId), {
        type,
        itemId: item.id,
        itemName: item.name,
        itemPhoto: item.photo ?? null,
        quantity: item.quantity,
        resolved: false,
        dismissedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } else if (existing.quantity !== item.quantity) {
      // Ongoing alert — update quantity without resetting dismissals
      updateDoc(doc(db, "stockAlerts", alertId), {
        itemName: item.name,
        itemPhoto: item.photo ?? null,
        quantity: item.quantity,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  function ensureResolved(alertId: string) {
    const existing = alertsRef.current.get(alertId);
    if (existing && !existing.resolved) {
      updateDoc(doc(db, "stockAlerts", alertId), {
        resolved: true,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  function processItem(item: ParsedItem, removed: boolean) {
    const zeroId = `${item.id}-zero_stock`;
    const lowId = `${item.id}-low_stock`;

    if (removed) {
      [zeroId, lowId].forEach((id) => {
        if (alertsRef.current.has(id)) {
          deleteDoc(doc(db, "stockAlerts", id)).catch(() => {});
          alertsRef.current.delete(id);
        }
      });
      return;
    }

    if (!item.trackStock) {
      ensureResolved(zeroId);
      ensureResolved(lowId);
      return;
    }

    const { notifyZeroStock, notifyLowStock, lowStockThreshold } =
      settingsRef.current;
    const isZero = item.quantity <= 0;
    const isLow = !isZero && item.quantity <= lowStockThreshold;

    if (isZero) {
      if (notifyZeroStock) ensureActive(zeroId, item, "zero_stock");
      ensureResolved(lowId);
    } else if (isLow) {
      ensureResolved(zeroId);
      if (notifyLowStock) ensureActive(lowId, item, "low_stock");
    } else {
      ensureResolved(zeroId);
      ensureResolved(lowId);
    }
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  useEffect(() => {
    return onSnapshot(doc(db, "storeConfig", "stockNotifications"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        settingsRef.current = {
          notifyZeroStock: d.notifyZeroStock ?? true,
          notifyLowStock: d.notifyLowStock ?? true,
          lowStockThreshold: d.lowStockThreshold ?? 5,
        };
      }
    });
  }, []);

  // Keeps alertsRef in sync and drains the pending queue on first load
  useEffect(() => {
    return onSnapshot(collection(db, "stockAlerts"), (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === "removed") {
          alertsRef.current.delete(change.doc.id);
        } else {
          const d = change.doc.data();
          alertsRef.current.set(change.doc.id, {
            resolved: d.resolved ?? false,
            quantity: d.quantity ?? 0,
          });
        }
      }

      if (!alertsReadyRef.current) {
        alertsReadyRef.current = true;
        pendingRef.current.forEach(({ item, removed }) =>
          processItem(item, removed),
        );
        pendingRef.current = [];
      }
    });
  }, []);

  // Syncs alerts on every item change — uses docChanges() for efficiency
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "items"), orderBy("createdAt", "desc")),
      (snap) => {
        for (const change of snap.docChanges()) {
          const data = change.doc.data();
          const item: ParsedItem = {
            id: change.doc.id,
            name: (data.name as string) ?? "",
            photo: (data.photo as string | undefined) ?? undefined,
            quantity: (data.quantity as number) ?? 0,
            trackStock: (data.trackStock as boolean) ?? false,
          };
          const removed = change.type === "removed";

          if (!alertsReadyRef.current) {
            pendingRef.current.push({ item, removed });
          } else {
            processItem(item, removed);
          }
        }
      },
    );
  }, []);

  return <>{children}</>;
}
