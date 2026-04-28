"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiGrid, FiShoppingBag, FiBox, FiUsers, FiGlobe,
  FiActivity, FiLogOut, FiMenu, FiX, FiLock,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/access";
import { Permission } from "@/types";
import DiceBearAvatar from "@/components/ui/DiceBearAvatar";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",             href: "/admin/dashboard", icon: <FiGrid size={18} />,        permission: "view_dashboard" },
  { label: "Pedidos",               href: "/admin/orders",    icon: <FiShoppingBag size={18} />, permission: "view_orders" },
  { label: "Estoque",               href: "/admin/stock",     icon: <FiBox size={18} />,         permission: "view_stock" },
  { label: "Usuários",              href: "/admin/users",     icon: <FiUsers size={18} />,       permission: "view_users" },
  { label: "Logs",                  href: "/admin/logs",      icon: <FiActivity size={18} />,    permission: "view_logs" },
  { label: "Configurações do Site", href: "/admin/site",      icon: <FiGlobe size={18} />,       permission: "view_site" },
];

function NavLink({
  item,
  allowed,
  badge,
  onClick,
}: {
  item: NavItem;
  allowed: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");

  if (!allowed) {
    return (
      <div
        title="Você não tem permissão para acessar esta página"
        className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium select-none"
        style={{
          opacity: 0.4,
          cursor: "not-allowed",
          color: "var(--color-text-secondary)",
          border: "1px solid transparent",
        }}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="truncate flex-1">{item.label}</span>
        <FiLock size={12} style={{ flexShrink: 0, color: "var(--color-text-muted)" }} />
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-all duration-150"
      style={{
        backgroundColor: active ? "var(--color-primary-light)" : "transparent",
        color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
        border: active ? "1px solid rgba(0,136,194,0.2)" : "1px solid transparent",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <span className="relative flex-shrink-0">
        {item.icon}
        {badge != null && badge > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
            style={{ backgroundColor: "var(--color-error)" }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { appUser, logOut } = useAuth();
  const { unseenCount } = useOrders();
  const { success, error } = useToast();
  const pathname = usePathname();
  const close = () => setMobileOpen(false);
  const onOrdersPage = pathname === "/admin/orders";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <Image src="/images/logo-drivein.svg" alt="Cine Drive-in" width={36} height={36} />
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>Cine Drive-in</p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Admin</p>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const allowed = appUser?.isOwner || can(appUser, item.permission);
          return (
            <NavLink
              key={item.href}
              item={item}
              allowed={allowed}
              onClick={close}
              badge={item.href === "/admin/orders" && !onOrdersPage && allowed ? unseenCount : undefined}
            />
          );
        })}
      </nav>

      <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
        <Link
          href="/admin/profile"
          onClick={close}
          className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] mb-2 transition-all"
          style={{ backgroundColor: "var(--color-bg-elevated)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-base)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)")}
        >
          {appUser?.avatarStyle && appUser?.avatarSeed ? (
            <DiceBearAvatar style={appUser.avatarStyle} seed={appUser.avatarSeed} size={32} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: "var(--color-primary)", color: "white" }}>
              {appUser?.username?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{appUser?.username ?? "Usuário"}</p>
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              {appUser?.isOwner ? "Owner" : appUser?.profileName ?? "Sem perfil"}
            </p>
          </div>
        </Link>
        <button
          onClick={async () => { try { await logOut(); success("Até logo!", "Você saiu da sua conta."); } catch { error("Erro ao sair", "Tente novamente."); } }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-md)] text-sm transition-all duration-150 cursor-pointer"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)"; e.currentTarget.style.color = "var(--color-error)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          <FiLogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 h-screen sticky top-0" style={{ backgroundColor: "var(--color-bg-surface)", borderRight: "1px solid var(--color-border)" }}>
        {sidebarContent}
      </aside>

      <header className="md:hidden flex items-center justify-between px-4 h-14 flex-shrink-0 sticky top-0 z-30" style={{ backgroundColor: "var(--color-bg-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Image src="/images/logo-drivein.svg" alt="Cine Drive-in" width={28} height={28} />
          <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Cine Drive-in</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="relative p-2 rounded-[var(--radius-md)] cursor-pointer"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label="Abrir menu"
        >
          <FiMenu size={20} />
          {unseenCount > 0 && !onOrdersPage && (
            <span
              className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--color-error)" }}
            />
          )}
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={close} />
          <aside className="relative flex flex-col w-72 h-full z-50" style={{ backgroundColor: "var(--color-bg-surface)", borderRight: "1px solid var(--color-border)" }}>
            <button onClick={close} className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] cursor-pointer" style={{ color: "var(--color-text-muted)" }} aria-label="Fechar menu">
              <FiX size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
