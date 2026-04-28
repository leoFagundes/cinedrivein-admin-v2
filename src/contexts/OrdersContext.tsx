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
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, OrderItem } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface OrdersContextValue {
  activeOrders: Order[];
  activeCount: number;
  unseenCount: number;
  markAsSeen: () => void;
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
    distanceMeters: data.distanceMeters != null ? (data.distanceMeters as number) : null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    finishedAt: (data.finishedAt as Timestamp)?.toDate(),
  };
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!firebaseUser) {
      setActiveOrders([]);
      setUnseenCount(0);
      initializedRef.current = false;
      seenIdsRef.current = new Set();
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
        initializedRef.current = true;
        setActiveOrders(orders);
        setUnseenCount(0);
        return;
      }

      const newOnes = orders.filter((o) => !seenIdsRef.current.has(o.id));
      setActiveOrders(orders);
      setUnseenCount(newOnes.length);
    });

    return unsub;
  }, [firebaseUser]);

  function markAsSeen() {
    seenIdsRef.current = new Set(activeOrders.map((o) => o.id));
    setUnseenCount(0);
  }

  return (
    <OrdersContext.Provider
      value={{
        activeOrders,
        activeCount: activeOrders.length,
        unseenCount,
        markAsSeen,
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
