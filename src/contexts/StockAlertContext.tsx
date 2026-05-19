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
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface NotifSettings {
  notifyZeroStock: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
}

const DEFAULT_SETTINGS: NotifSettings = {
  notifyZeroStock: true,
  notifyLowStock: true,
  lowStockThreshold: 5,
};

export function StockAlertProvider({ children }: { children: React.ReactNode }) {
  const prevItemsRef = useRef<Map<string, { quantity: number; isVisible: boolean }>>(new Map());
  const initialLoadRef = useRef(false);
  const settingsRef = useRef<NotifSettings>(DEFAULT_SETTINGS);

  // Subscribe to notification settings
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

  // Subscribe to items and detect stock transitions
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "items"), orderBy("createdAt", "desc")),
      (snap) => {
        const newItems = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? "",
            photo: (data.photo as string | undefined) ?? undefined,
            quantity: (data.quantity as number) ?? 0,
            isVisible: (data.isVisible as boolean) ?? true,
            trackStock: (data.trackStock as boolean) ?? false,
          };
        });

        if (initialLoadRef.current) {
          const s = settingsRef.current;

          for (const item of newItems) {
            if (!item.trackStock) continue;
            const prev = prevItemsRef.current.get(item.id);
            if (!prev) continue;

            const wasZero = prev.quantity <= 0;
            const isZero = item.quantity <= 0 && !item.isVisible;
            const wasLow = prev.quantity > 0 && prev.quantity <= s.lowStockThreshold;
            const isLow = item.quantity > 0 && item.quantity <= s.lowStockThreshold && item.isVisible;

            // Just hit zero stock
            if (!wasZero && isZero && s.notifyZeroStock) {
              setDoc(doc(db, "stockAlerts", `${item.id}-zero_stock`), {
                type: "zero_stock",
                itemId: item.id,
                itemName: item.name,
                itemPhoto: item.photo ?? null,
                quantity: item.quantity,
                resolved: false,
                dismissedBy: [],
                createdAt: serverTimestamp(),
              }).catch(() => {});
            }

            // Restocked from zero
            if (wasZero && item.quantity > 0) {
              updateDoc(doc(db, "stockAlerts", `${item.id}-zero_stock`), {
                resolved: true,
              }).catch(() => {});
            }

            // Just crossed into low stock
            if (!wasLow && isLow && s.notifyLowStock) {
              setDoc(doc(db, "stockAlerts", `${item.id}-low_stock`), {
                type: "low_stock",
                itemId: item.id,
                itemName: item.name,
                itemPhoto: item.photo ?? null,
                quantity: item.quantity,
                resolved: false,
                dismissedBy: [],
                createdAt: serverTimestamp(),
              }).catch(() => {});
            }

            // Still low but quantity dropped further — keep alert quantity current
            if (wasLow && isLow && item.quantity < prev.quantity) {
              updateDoc(doc(db, "stockAlerts", `${item.id}-low_stock`), {
                quantity: item.quantity,
              }).catch(() => {});
            }

            // Low stock resolved (above threshold or hit zero — zero_stock takes over)
            if (wasLow && (item.quantity > s.lowStockThreshold || item.quantity <= 0)) {
              updateDoc(doc(db, "stockAlerts", `${item.id}-low_stock`), {
                resolved: true,
              }).catch(() => {});
            }
          }
        } else {
          initialLoadRef.current = true;
        }

        const next = new Map<string, { quantity: number; isVisible: boolean }>();
        for (const item of newItems) {
          next.set(item.id, { quantity: item.quantity, isVisible: item.isVisible });
        }
        prevItemsRef.current = next;
      },
    );
  }, []);

  return <>{children}</>;
}
