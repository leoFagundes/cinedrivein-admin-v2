"use client";

import dynamic from "next/dynamic";

const AuthProvider = dynamic(
  () =>
    import("@/contexts/AuthContext").then((m) => ({ default: m.AuthProvider })),
  { ssr: false, loading: () => null },
);

const OrdersProvider = dynamic(
  () =>
    import("@/contexts/OrdersContext").then((m) => ({
      default: m.OrdersProvider,
    })),
  { ssr: false, loading: () => null },
);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrdersProvider>{children}</OrdersProvider>
    </AuthProvider>
  );
}
