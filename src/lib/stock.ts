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
        // Skip if the subitem points to the same item being ordered — it's a
        // flavor selector, not an independent stock unit. The parent item's
        // direct deduction already accounts for this unit.
        if (linkedItemId === item.itemId) continue;
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

    const data = snap.data();
    const currentQty: number = data.quantity ?? 0;
    const updates: Record<string, unknown> = { quantity: increment(qty) };

    // Restore visibility only when the item was auto-hidden by hitting 0 stock
    // (currentQty <= 0) and the restoration brings it back above 0.
    // Does NOT reactivate items the admin manually hid while stock > 0.
    if (data.isVisible === false && currentQty <= 0 && currentQty + qty > 0) {
      updates.isVisible = true;
    }

    batch.update(doc(db, "items", itemId), updates);
    hasBatch = true;
  }

  if (hasBatch) await batch.commit();
}

// ── diffOrderStock ────────────────────────────────────────────────────────────

/**
 * Compara os itens de um pedido antes e depois da edição e ajusta o estoque
 * apenas na diferença. Regras:
 *  - qty aumentou  → decreaseStock pela diferença (consumir mais)
 *  - qty diminuiu  → increaseStock pela diferença (devolver)
 *  - item novo     → decreaseStock pela qty total
 *  - item removido → increaseStock pela qty total
 */
export async function diffOrderStock(
  previousItems: OrderItem[],
  nextItems: OrderItem[],
): Promise<void> {
  const [prevMap, nextMap] = await Promise.all([
    buildAdjustmentMap(previousItems),
    buildAdjustmentMap(nextItems),
  ]);

  // Todos os itemIds envolvidos nos dois lados
  const allIds = new Set([...prevMap.keys(), ...nextMap.keys()]);

  const toDecrease: Map<string, number> = new Map();
  const toIncrease: Map<string, number> = new Map();

  for (const id of allIds) {
    const prev = prevMap.get(id) ?? 0;
    const next = nextMap.get(id) ?? 0;
    const diff = next - prev;

    if (diff > 0)
      toDecrease.set(id, diff); // consumir mais
    else if (diff < 0) toIncrease.set(id, -diff); // devolver
    // diff === 0 → nada a fazer
  }

  // Monta OrderItem[] fictícios só com itemId + quantity para reaproveitar
  // as funções existentes que já lidam com trackStock e transações
  function syntheticItems(map: Map<string, number>): OrderItem[] {
    return Array.from(map.entries()).map(([itemId, quantity]) => ({
      itemId,
      codItem: "",
      name: "",
      value: 0,
      quantity,
      trackStock: true, // já filtramos por trackStock dentro de decrease/increase
    }));
  }

  await Promise.all([
    toDecrease.size > 0
      ? decreaseStock(syntheticItems(toDecrease))
      : Promise.resolve(),
    toIncrease.size > 0
      ? increaseStock(syntheticItems(toIncrease))
      : Promise.resolve(),
  ]);
}
