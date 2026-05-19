import Sidebar from "@/components/layout/Sidebar";
import LockScreen from "@/components/layout/LockScreen";
import { AdminGuard } from "@/components/layout/AuthGuard";
import { PrinterProvider } from "@/components/orders/ThermalPrinter";
import { SoundAlertProvider } from "@/components/orders/SoundAlert";
import OrdersProviderClient from "@/components/orders/OrdersProviderClient";
import { LockProvider } from "@/contexts/LockContext";
import { StockAlertProvider } from "@/contexts/StockAlertContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <PrinterProvider>
        <StockAlertProvider>
          <SoundAlertProvider>
            <OrdersProviderClient>
              <LockProvider>
                <div
                  className="flex flex-col md:flex-row min-h-screen"
                  style={{ backgroundColor: "var(--color-bg-base)" }}
                >
                  <Sidebar />
                  <main className="flex-1 flex flex-col min-w-0">{children}</main>
                </div>
                <LockScreen />
              </LockProvider>
            </OrdersProviderClient>
          </SoundAlertProvider>
        </StockAlertProvider>
      </PrinterProvider>
    </AdminGuard>
  );
}
