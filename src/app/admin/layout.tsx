import Sidebar from "@/components/layout/Sidebar";
import { AdminGuard } from "@/components/layout/AuthGuard";
import { PrinterProvider } from "@/components/orders/ThermalPrinter";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <PrinterProvider>
        <div
          className="flex flex-col md:flex-row min-h-screen"
          style={{ backgroundColor: "var(--color-bg-base)" }}
        >
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 ">{children}</main>
        </div>
      </PrinterProvider>
    </AdminGuard>
  );
}
