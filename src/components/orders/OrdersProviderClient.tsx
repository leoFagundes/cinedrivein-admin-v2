"use client";

import dynamic from "next/dynamic";

const OrdersProvider = dynamic(
  () =>
    import("@/contexts/OrdersContext").then((m) => ({
      default: m.OrdersProvider,
    })),
  { ssr: false, loading: () => null },
);

export default function OrdersProviderClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrdersProvider>{children}</OrdersProvider>;
}
