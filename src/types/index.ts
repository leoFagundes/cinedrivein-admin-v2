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

export type LogCategory =
  | "auth"
  | "users"
  | "profiles"
  | "orders"
  | "stock"
  | "site";

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

// ─── Site ─────────────────────────────────────────────────────────────────────

export type FilmClassification =
  | "L"
  | "6"
  | "10"
  | "12"
  | "14"
  | "16"
  | "18"
  | "";
export type EventType = "" | "christmas" | "halloween" | "easter";
export type SessionKey = "session1" | "session2" | "session3" | "session4";

export interface Film {
  title: string;
  showtime: string;
  image: string;
  classification: FilmClassification;
  synopsis: string;
  director: string;
  writer: string[];
  cast: string[];
  genres: string[];
  duration: string;
  language: string;
  displayDate: string;
  trailer: string;
}

export interface SiteConfig {
  siteUrl: string;
  isClosed: boolean;
  openingTime?: string;
  closingTime?: string;
  isEvent: EventType;
  popUpEnabled: boolean;
  popUpImage?: string;
  popUpTitle?: string;
  popUpDescriptions?: string[];
  popUpImageHistory?: string[];
  session1?: Film | null;
  session2?: Film | null;
  session3?: Film | null;
  session4?: Film | null;
}

export interface DailyStats {
  id: string;
  date: string;
  totalOrders: number;
  finishedOrders: number;
  canceledOrders: number;
  revenue: {
    total: number;
    subtotal: number;
    serviceFee: number;
    money: number;
    pix: number;
    credit: number;
    debit: number;
    discount: number;
  };
  topItems: Array<{ codItem: string; name: string; quantity: number }>;
  createdAt: Date;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  itemId: string;
  codItem: string;
  name: string;
  value: number;
  photo?: string;
  observation?: string;
  additionals?: string[];
  additionals_sauce?: string[];
  additionals_drink?: string[];
  additionals_sweet?: string[];
}

export interface OrderPayment {
  money: number;
  pix: number;
  credit: number;
  debit: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  username: string;
  phone: string;
  spot: number;
  status: "active" | "finished" | "canceled";
  items: OrderItem[];
  subtotal: number;
  serviceFee: number;
  serviceFeePaid: boolean;
  discount: number;
  total: number;
  payment?: OrderPayment;
  createdAt: Date;
  finishedAt?: Date;
}

export interface ChatTemplate {
  id: string;
  trigger: string;
  title: string;
  message: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: "admin" | "customer";
  senderName: string;
  uid?: string;
  createdAt: Date;
  editedAt?: Date;
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export type AdditionalGroup =
  | "additionals"
  | "additionals_sauce"
  | "additionals_drink"
  | "additionals_sweet";

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
