export type UserStatus = "pending" | "approved" | "rejected";

export type Permission =
  // Dashboard
  | "view_dashboard"
  | "manage_store"
  | "generate_report"
  | "delete_chart_data"
  // Pedidos
  | "view_orders"
  | "delete_orders"
  | "cancel_orders"
  | "finish_orders"
  | "edit_orders"
  | "chat_orders"
  | "create_order"
  | "manage_chat_templates"
  // Estoque
  | "view_stock"
  | "create_item"
  | "create_subitem"
  | "edit_item"
  | "edit_subitem"
  | "delete_item"
  | "delete_subitem"
  | "manage_category_order"
  // Usuários
  | "view_users"
  | "edit_users"
  | "approve_users"
  | "delete_users"
  | "manage_profiles"
  | "create_user"
  // Logs
  | "view_logs"
  | "delete_logs"
  // Configurações do Site
  | "view_site"
  | "manage_movies"
  | "manage_site_settings";

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

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // domingo = 0

export interface PriceRule {
  label: string;
  days: WeekDay[];
  meia: number;
  inteira: number;
}

export interface StoreStatus {
  isOpen: boolean;
  openingTime?: string;
  closingTime?: string;
}

export interface SiteConfig {
  siteUrl: string;
  isClosed: boolean;
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
  prices?: PriceRule[];
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
  topItems: Array<{
    codItem: string;
    name: string;
    quantity: number;
    additionals?: Record<string, number>; // adicional name -> total count
  }>;
  createdAt: Date;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  itemId: string;
  codItem: string;
  name: string;
  value: number;
  visibleValue?: number;
  quantity?: number;
  trackStock?: boolean;
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
  distanceMeters: number | null;
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
  trackStock: boolean;
  additionals: string[];
  additionals_sauce: string[];
  additionals_drink: string[];
  additionals_sweet: string[];
  createdAt: Date;
}
