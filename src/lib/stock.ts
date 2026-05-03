import {
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  runTransaction,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderItem } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a string for name matching:
 * lowercase, remove accents, remove all non-alphanumeric characters.
 * "Coca-cola mini" → "cocacolamini"
 * "Coca cola Mini" → "cocacolamini"
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Builds a map of normalized subitem name → linkedItemId.
 * Only subitems that have a linkedItemId are included.
 */
async function getSubitemNameToLinkedItem(): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, "subitems"));
  const map = new Map<string, string>();
  for (const d of snap.docs) {
    const linkedItemId = d.data().linkedItemId as string | undefined;
    const name = d.data().name as string | undefined;
    if (linkedItemId && name) {
      map.set(normalize(name), linkedItemId);
    }
  }
  return map;
}

/**
 * Builds a unified map of itemId → total qty to adjust.
 *
 * Rules:
 * - Direct order items: always counted by their itemId × quantity.
 * - Additionals with a linkedItemId: also counted, accumulated on top of
 *   any direct item with the same itemId. No dedup — each unit consumed
 *   must be accounted for regardless of how it was ordered.
 */
async function buildAdjustmentMap(
  items: OrderItem[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();

  // 1. Direct items
  for (const item of items) {
    if (!item.itemId) continue;
    const qty = item.quantity ?? 1;
    totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + qty);
  }

  // 2. Additionals → look up linkedItemId by normalized name
  const hasAdditionals = items.some((item) => {
    const allSubs = [
      ...(item.additionals ?? []),
      ...(item.additionals_sauce ?? []),
      ...(item.additionals_drink ?? []),
      ...(item.additionals_sweet ?? []),
    ];
    return allSubs.length > 0;
  });

  if (hasAdditionals) {
    const nameToLinked = await getSubitemNameToLinkedItem();

    for (const item of items) {
      const qty = item.quantity ?? 1;
      const allSubs = [
        ...(item.additionals ?? []),
        ...(item.additionals_sauce ?? []),
        ...(item.additionals_drink ?? []),
        ...(item.additionals_sweet ?? []),
      ];

      for (const subName of allSubs) {
        const linkedItemId = nameToLinked.get(normalize(subName));
        if (!linkedItemId) continue;
        totals.set(linkedItemId, (totals.get(linkedItemId) ?? 0) + qty);
      }
    }
  }

  return totals;
}

// ── decreaseStock ─────────────────────────────────────────────────────────────

export async function decreaseStock(items: OrderItem[]): Promise<void> {
  const totals = await buildAdjustmentMap(items);

  for (const [itemId, qty] of totals) {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "items", itemId);
      const snap = await tx.get(ref);
      if (!snap.exists() || !snap.data().trackStock) return;
      const current = snap.data().quantity ?? 0;
      const next = Math.max(0, current - qty);
      const updates: Record<string, unknown> = { quantity: next };
      if (next <= 0) updates.isVisible = false;
      tx.update(ref, updates);
    });
  }
}

// ── increaseStock ─────────────────────────────────────────────────────────────

export async function increaseStock(items: OrderItem[]): Promise<void> {
  const totals = await buildAdjustmentMap(items);

  const batch = writeBatch(db);
  let hasBatch = false;

  for (const [itemId, qty] of totals) {
    const snap = await getDoc(doc(db, "items", itemId));
    if (!snap.exists() || !snap.data().trackStock) continue;
    batch.update(doc(db, "items", itemId), { quantity: increment(qty) });
    hasBatch = true;
  }

  if (hasBatch) await batch.commit();
}
