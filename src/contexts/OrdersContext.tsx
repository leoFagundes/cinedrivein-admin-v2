/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, OrderItem } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { decreaseStock } from "@/lib/stock";
import { usePrinter } from "@/components/orders/ThermalPrinter";

interface OrdersContextValue {
  activeOrders: Order[];
  activeCount: number;
  unseenCount: number;
  markAsSeen: () => void;
  readyToPrintIds: Set<string>;
  printedIds: Set<string>;
  markAsPrinted: (orderId: string) => void;
  customerMsgTimes: Record<string, number>;
  chatSeenTimes: Record<string, number>;
  markChatSeen: (orderId: string) => void;
  unreadChatsCount: number;
}

const PRINTED_KEY = "cdi_printed_orders";
const CHAT_SEEN_KEY = "cdi_chat_seen";

function loadChatSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CHAT_SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveChatSeen(v: Record<string, number>) {
  try {
    localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(v));
  } catch {}
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

function parseOrderItem(raw: Record<string, unknown>): OrderItem {
  // Handle old nested format: { item: { name, value, ... }, observation, additional }
  if (raw.item && typeof raw.item === "object") {
    const item = raw.item as Record<string, unknown>;
    const toArr = (v: unknown) =>
      typeof v === "string" && v ? [v] : Array.isArray(v) ? v : [];
    return {
      itemId: (item._id ?? item.id ?? "") as string,
      codItem: (item.codItem ?? item.cod_item ?? "") as string,
      name: (item.name ?? "") as string,
      value: (item.value ?? 0) as number,
      photo: item.photo as string | undefined,
      observation: raw.observation as string | undefined,
      additionals: toArr(raw.additional),
      additionals_sauce: toArr(raw.additional_sauce),
      additionals_drink: toArr(raw.additional_drink),
      additionals_sweet: toArr(raw.additional_sweet),
    };
  }
  return {
    itemId: (raw.itemId ?? "") as string,
    codItem: (raw.codItem ?? "") as string,
    name: (raw.name ?? "") as string,
    value: (raw.value ?? 0) as number,
    quantity: (raw.quantity as number | undefined) ?? 1,
    visibleValue:
      raw.visibleValue != null ? (raw.visibleValue as number) : undefined,
    trackStock: (raw.trackStock as boolean | undefined) ?? false,
    printTwice: (raw.printTwice as boolean | undefined) ?? false,
    photo: raw.photo as string | undefined,
    observation: raw.observation as string | undefined,
    additionals: (raw.additionals ?? []) as string[],
    additionals_sauce: (raw.additionals_sauce ?? []) as string[],
    additionals_drink: (raw.additionals_drink ?? []) as string[],
    additionals_sweet: (raw.additionals_sweet ?? []) as string[],
  };
}

export function parseOrder(id: string, data: Record<string, unknown>): Order {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  return {
    id,
    orderNumber: ((data.orderNumber ?? data.order_number) as number) ?? 0,
    username: (data.username as string) ?? "",
    phone: (data.phone as string) ?? "",
    spot: (data.spot as number) ?? 0,
    status: (data.status as Order["status"]) ?? "active",
    items: rawItems.map((i) => parseOrderItem(i as Record<string, unknown>)),
    subtotal: (data.subtotal as number) ?? 0,
    serviceFee: ((data.serviceFee ?? data.service_fee) as number) ?? 0,
    serviceFeePaid:
      ((data.serviceFeePaid ?? data.service_fee_paid) as boolean) ?? false,
    discount: (data.discount as number) ?? 0,
    total: ((data.total ?? data.total_value) as number) ?? 0,
    payment: data.payment as Order["payment"],
    distanceMeters:
      data.distanceMeters != null ? (data.distanceMeters as number) : null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    finishedAt: (data.finishedAt as Timestamp)?.toDate(),
  };
}

async function normalizeOrderPrices(order: Order): Promise<void> {
  let changed = false;

  const normalized = await Promise.all(
    order.items.map(async (item) => {
      if (!item.itemId) return item;
      try {
        const snap = await getDoc(doc(db, "items", item.itemId));
        if (!snap.exists()) return item;
        const data = snap.data();
        const realValue = data.value as number;
        const stockVisibleValue = data.visibleValue as number | undefined;

        // Se o item tem visibleValue configurado no estoque
        if (
          stockVisibleValue != null &&
          stockVisibleValue > 0 &&
          stockVisibleValue !== realValue
        ) {
          // O value do pedido deveria ser o valor REAL e visibleValue o valor do cliente
          // Se value está errado (igual ao visibleValue do cliente), corrige
          if (item.value !== realValue) {
            changed = true;
            return {
              ...item,
              value: realValue,
              visibleValue: stockVisibleValue,
            };
          }
        }
      } catch {
        /* silent */
      }
      return item;
    }),
  );

  if (!changed) return;

  const cleanItems = normalized.map((item) =>
    Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)),
  );

  const newSubtotal = normalized.reduce(
    (sum, item) => sum + item.value * (item.quantity ?? 1),
    0,
  );
  const feeRate = order.subtotal > 0 ? order.serviceFee / order.subtotal : 0;
  const newServiceFee = Math.round(newSubtotal * feeRate * 100) / 100;
  const newTotal = newSubtotal + newServiceFee;

  await updateDoc(doc(db, "orders", order.id), {
    items: cleanItems,
    subtotal: newSubtotal,
    serviceFee: newServiceFee,
    total: newTotal,
  });
}

async function normalizePrintTwice(order: Order): Promise<void> {
  let changed = false;
  const normalized = await Promise.all(
    order.items.map(async (item) => {
      if (!item.itemId) return item;
      if (item.printTwice) return item; // já está correto
      try {
        const snap = await getDoc(doc(db, "items", item.itemId));
        if (!snap.exists()) return item;
        const printTwice = (snap.data().printTwice as boolean) ?? false;
        if (printTwice) {
          changed = true;
          return { ...item, printTwice: true };
        }
      } catch {
        /* silent */
      }
      return item;
    }),
  );

  if (!changed) return;

  // Atualiza o Firestore para que fique correto também
  const cleanItems = normalized.map((item) =>
    Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)),
  );
  await updateDoc(doc(db, "orders", order.id), { items: cleanItems });
}

function loadPrinted(): Set<string> {
  try {
    const raw = localStorage.getItem(PRINTED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function savePrinted(ids: Set<string>) {
  try {
    localStorage.setItem(PRINTED_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, appUser } = useAuth();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const stockProcessedRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [readyToPrintIds, setReadyToPrintIds] = useState<Set<string>>(
    new Set(),
  );
  const readyRef = useRef<Set<string>>(new Set());

  const pendingRef = useRef<Set<string>>(new Set());
  const printBaselineRef = useRef<Set<string> | null>(null);
  const printedRef = useRef<Set<string>>(loadPrinted());
  const [printedIds, setPrintedIds] = useState<Set<string>>(() =>
    loadPrinted(),
  );

  const { autoPrint, isConnected, printOrder } = usePrinter();

  useEffect(() => {
    if (autoPrint && isConnected) {
      if (printBaselineRef.current === null) {
        printBaselineRef.current = new Set(activeOrders.map((o) => o.id));
      }
    } else {
      printBaselineRef.current = null;
    }
  }, [autoPrint, isConnected]);

  useEffect(() => {
    if (!autoPrint || !isConnected) return;

    // 1. Pedidos novos entram no pending
    for (const order of activeOrders) {
      const notInBaseline = !printBaselineRef.current?.has(order.id);
      const notYetPrinted = !printedRef.current.has(order.id);
      const notYetPending = !pendingRef.current.has(order.id);

      if (notInBaseline && notYetPrinted && notYetPending) {
        pendingRef.current.add(order.id);
      }
    }

    // 2. Imprime os que estão pending E prontos
    for (const orderId of pendingRef.current) {
      if (!readyToPrintIds.has(orderId)) continue;
      if (printedRef.current.has(orderId)) continue;

      const freshOrder = activeOrders.find((o) => o.id === orderId);
      if (!freshOrder) continue;

      printedRef.current.add(orderId);
      setPrintedIds(new Set(printedRef.current));
      savePrinted(printedRef.current);
      pendingRef.current.delete(orderId);
      printOrder(freshOrder);
    }
  }, [activeOrders, readyToPrintIds, autoPrint, isConnected, printOrder]);

  useEffect(() => {
    if (!firebaseUser) {
      setActiveOrders([]);
      setUnseenCount(0);
      initializedRef.current = false;
      seenIdsRef.current = new Set();
      stockProcessedRef.current = new Set();
      return;
    }

    const q = query(
      collection(db, "orders"),
      where("status", "==", "active"),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs.map((d) =>
        parseOrder(d.id, d.data() as Record<string, unknown>),
      );

      if (!initializedRef.current) {
        seenIdsRef.current = new Set(orders.map((o) => o.id));
        stockProcessedRef.current = new Set(orders.map((o) => o.id));
        initializedRef.current = true;

        // Limpa do localStorage pedidos que não existem mais
        const activeIds = new Set(orders.map((o) => o.id));
        const cleaned = new Set(
          [...printedRef.current].filter((id) => activeIds.has(id)),
        );
        printedRef.current = cleaned;
        setPrintedIds(new Set(cleaned));
        savePrinted(cleaned);

        setActiveOrders(orders);
        setUnseenCount(0);
        // Normalize existing orders too (only writes if prices are wrong)
        orders.forEach((o) => {
          normalizeOrderPrices(o).catch(console.error);
          normalizePrintTwice(o).catch(console.error);
          readyRef.current.add(o.id);
        });
        setReadyToPrintIds(new Set(readyRef.current));
        return;
      }

      const newOnes = orders.filter((o) => !seenIdsRef.current.has(o.id));
      setActiveOrders(orders);
      setUnseenCount(newOnes.length);

      const unprocessed = orders.filter(
        (o) => !stockProcessedRef.current.has(o.id),
      );
      unprocessed.forEach((o) => stockProcessedRef.current.add(o.id));
      setActiveOrders(orders);

      if (unprocessed.length > 0) {
        Promise.all(
          unprocessed.map(async (o) => {
            await decreaseStock(o.items).catch(console.error);
            await Promise.all([
              normalizeOrderPrices(o),
              normalizePrintTwice(o),
            ]).catch(console.error);

            // ✅ Só sinaliza pronto DEPOIS que tudo terminou
            readyRef.current = new Set([...readyRef.current, o.id]);
            setReadyToPrintIds(new Set(readyRef.current));
          }),
        ).catch(console.error);
      }
    });

    return unsub;
  }, [firebaseUser]);

  // ── Chat message tracking ─────────────────────────────────────────────────

  const [customerMsgTimes, setCustomerMsgTimes] = useState<
    Record<string, number>
  >({});
  const customerMsgTimesRef = useRef<Record<string, number>>({});

  const [chatSeenTimes, setChatSeenTimesState] = useState<
    Record<string, number>
  >(() => (typeof window !== "undefined" ? loadChatSeen() : {}));
  const chatSeenTimesRef = useRef<Record<string, number>>(chatSeenTimes);

  // Keep ref in sync for snapshot callbacks
  useEffect(() => {
    customerMsgTimesRef.current = customerMsgTimes;
  }, [customerMsgTimes]);

  // Listen to last message per active order
  useEffect(() => {
    if (!firebaseUser || activeOrders.length === 0) return;

    const unsubs = activeOrders.map((order) => {
      const q = query(
        collection(db, "orders", order.id, "messages"),
        orderBy("createdAt", "desc"),
        limit(1),
      );
      return onSnapshot(q, (snap) => {
        if (snap.empty) {
          customerMsgTimesRef.current = {
            ...customerMsgTimesRef.current,
            [order.id]: 0,
          };
          setCustomerMsgTimes({ ...customerMsgTimesRef.current });
          return;
        }
        const d = snap.docs[0].data();
        const ts = (d.createdAt as Timestamp)?.toMillis() ?? 0;
        const isFromOthers = d.senderName !== appUser?.username;
        customerMsgTimesRef.current = {
          ...customerMsgTimesRef.current,
          [order.id]: isFromOthers ? ts : 0,
        };
        setCustomerMsgTimes({ ...customerMsgTimesRef.current });
      });
    });

    return () => unsubs.forEach((u) => u());
  }, [firebaseUser, activeOrders, appUser?.username]);

  function markChatSeen(orderId: string) {
    const now = Date.now();
    const next = { ...chatSeenTimesRef.current, [orderId]: now };
    chatSeenTimesRef.current = next;
    setChatSeenTimesState(next);
    saveChatSeen(next);
  }

  const unreadChatsCount = activeOrders.filter((o) => {
    const msgTime = customerMsgTimesRef.current[o.id] ?? 0;
    const seenTime = chatSeenTimesRef.current[o.id] ?? 0;
    return msgTime > 0 && msgTime > seenTime;
  }).length;

  // ── Order actions ──────────────────────────────────────────────────────────

  function markAsSeen() {
    seenIdsRef.current = new Set(activeOrders.map((o) => o.id));
    setUnseenCount(0);
  }

  function markAsPrinted(orderId: string) {
    printedRef.current.add(orderId);
    setPrintedIds(new Set(printedRef.current));
    savePrinted(printedRef.current);
  }

  return (
    <OrdersContext.Provider
      value={{
        activeOrders,
        activeCount: activeOrders.length,
        unseenCount,
        markAsSeen,
        readyToPrintIds,
        printedIds,
        markAsPrinted,
        customerMsgTimes,
        chatSeenTimes,
        markChatSeen,
        unreadChatsCount,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used inside OrdersProvider");
  return ctx;
}
