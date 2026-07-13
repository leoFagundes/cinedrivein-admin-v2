import Sidebar from "@/components/layout/Sidebar";
import LockScreen from "@/components/layout/LockScreen";
import DevModePanel from "@/components/layout/DevModePanel";
import { AdminGuard } from "@/components/layout/AuthGuard";
import { PrinterProvider } from "@/components/orders/ThermalPrinter";
import { SoundAlertProvider } from "@/components/orders/SoundAlert";
import OrdersProviderClient from "@/components/orders/OrdersProviderClient";
import { LockProvider } from "@/contexts/LockContext";
import { StockAlertProvider } from "@/contexts/StockAlertContext";
import { DevModeProvider } from "@/contexts/DevModeContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <DevModeProvider>
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
                <DevModePanel />
              </LockProvider>
            </OrdersProviderClient>
          </SoundAlertProvider>
        </StockAlertProvider>
      </PrinterProvider>
      </DevModeProvider>
    </AdminGuard>
  );
}
