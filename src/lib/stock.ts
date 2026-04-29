import { doc, getDoc, writeBatch, runTransaction, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderItem } from "@/types";

function aggregateByItemId(items: OrderItem[]): Map<string, number> {
  const byId = new Map<string, number>();
  for (const item of items) {
    if (!item.itemId) continue;
    byId.set(item.itemId, (byId.get(item.itemId) ?? 0) + (item.quantity ?? 1));
  }
  return byId;
}

export async function decreaseStock(items: OrderItem[]): Promise<void> {
  const byId = aggregateByItemId(items);
  if (byId.size === 0) return;

  for (const [itemId, qty] of byId) {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "items", itemId);
      const snap = await tx.get(ref);
      if (!snap.exists() || !snap.data().trackStock) return;
      const next = Math.max(0, (snap.data().quantity ?? 0) - qty);
      const updates: Record<string, unknown> = { quantity: next };
      if (next <= 0) updates.isVisible = false;
      tx.update(ref, updates);
    });
  }
}

export async function increaseStock(items: OrderItem[]): Promise<void> {
  const byId = aggregateByItemId(items);
  if (byId.size === 0) return;

  const batch = writeBatch(db);
  let hasBatch = false;

  for (const [itemId, qty] of byId) {
    const snap = await getDoc(doc(db, "items", itemId));
    if (!snap.exists() || !snap.data().trackStock) continue;
    batch.update(doc(db, "items", itemId), { quantity: increment(qty) });
    hasBatch = true;
  }

  if (hasBatch) await batch.commit();
}
