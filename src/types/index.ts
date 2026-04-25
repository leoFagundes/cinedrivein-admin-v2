export type UserStatus = "pending" | "approved" | "rejected";

export type Permission =
  | "approve_users"
  | "manage_users"
  | "manage_profiles"
  | "manage_orders"
  | "manage_stock"
  | "manage_site"
  | "manage_schedule"
  | "view_reports"
  | "view_logs";

export interface PermissionProfile {
  id: string;
  name: string;
  permissions: Permission[];
  createdAt: Date;
}

export interface AppUser {
  uid: string;
  username: string;
  email: string;
  status: UserStatus;
  isOwner: boolean;
  profileId?: string;
  profileName?: string;
  permissions: Permission[];
  avatarStyle?: string;
  avatarSeed?: string;
  createdAt: Date;
}

export type LogCategory = "auth" | "users" | "profiles" | "orders" | "stock" | "site";

export interface LogChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface Log {
  id: string;
  action: string;
  category: LogCategory;
  description: string;
  performedBy: { uid: string; username: string };
  target?: { type: string; id: string; name: string };
  changes?: LogChange[];
  createdAt: Date;
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export type AdditionalGroup = "additionals" | "additionals_sauce" | "additionals_drink" | "additionals_sweet";

export interface Subitem {
  id: string;
  name: string;
  description: string;
  isVisible: boolean;
  photo?: string;
  createdAt: Date;
}

export interface StockItem {
  id: string;
  codItem: string;
  name: string;
  category: string;
  description: string;
  value: number;
  visibleValue?: number;
  quantity: number;
  photo?: string;
  isVisible: boolean;
  isFeatured: boolean;
  additionals: string[];
  additionals_sauce: string[];
  additionals_drink: string[];
  additionals_sweet: string[];
  createdAt: Date;
}
