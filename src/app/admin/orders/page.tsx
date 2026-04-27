"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import {
  FiSearch,
  FiX,
  FiCheck,
  FiClock,
  FiPhone,
  FiUser,
  FiAlertTriangle,
  FiShoppingBag,
  FiChevronDown,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiPackage,
  FiMaximize2,
  FiMinimize2,
  FiRefreshCw,
  FiMessageSquare,
  FiBookmark,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders, parseOrder } from "@/contexts/OrdersContext";
import { useToast } from "@/components/ui/Toast";
import { log } from "@/lib/logger";
import NewOrderModal from "@/components/orders/NewOrderModal";
import OrderChatDrawer from "@/components/orders/OrderChatDrawer";
import ChatTemplatesModal from "@/components/orders/ChatTemplatesModal";
import { Order, OrderPayment } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtElapsed(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function fmtTimeShort(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsedColor(minutes: number): string {
  if (minutes >= 61) return "var(--color-error)";
  if (minutes >= 31) return "var(--color-warning)";
  return "var(--color-text-muted)";
}

function ItemPhoto({ photo, name }: { photo?: string; name: string }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-[var(--radius-sm)] object-cover flex-shrink-0 mt-0.5"
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{
        backgroundColor: "var(--color-bg-base)",
        color: "var(--color-text-muted)",
      }}
    >
      <FiPackage size={16} />
    </div>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onCancel,
  onFinalize,
  onEdit,
  onChat,
}: {
  order: Order;
  onCancel: () => void;
  onFinalize: () => void;
  onEdit: () => void;
  onChat: () => void;
}) {
  const [elapsedMin, setElapsedMin] = useState(0);
  const createdAtMs = order.createdAt.getTime();
  useEffect(() => {
    const tick = () =>
      setElapsedMin(Math.floor((Date.now() - createdAtMs) / 60_000));
    const initId = setTimeout(tick, 100);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, [createdAtMs]);

  return (
    <div
      className="flex flex-col rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: "var(--color-bg-elevated)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: "var(--color-primary)", color: "white" }}
          >
            #{order.orderNumber}
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Vaga {order.spot}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {fmtTimeShort(order.createdAt)}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: elapsedColor(elapsedMin) }}
            title={fmtTime(order.createdAt)}
          >
            <FiClock
              size={11}
              style={{
                display: "inline",
                marginRight: 2,
                verticalAlign: "middle",
              }}
            />
            {fmtElapsed(elapsedMin)}
          </span>
          <button
            onClick={onChat}
            className="p-1 rounded cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
            title="Chat"
          >
            <FiMessageSquare size={13} />
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
            title="Editar pedido"
          >
            <FiEdit2 size={13} />
          </button>
        </div>
      </div>

      {/* Customer */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FiUser
            size={13}
            style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
          />
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {order.username}
          </span>
        </div>
        {order.phone && (
          <a
            href={`https://wa.me/55${order.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs flex-shrink-0 ml-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--color-success)" }}
          >
            <FiPhone size={12} />
            {order.phone}
          </a>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col flex-1">
        {order.items.map((item, i) => {
          const extras = [
            ...(item.additionals ?? []).map((a) => `${a} (adicional)`),
            ...(item.additionals_sauce ?? []).map((a) => `${a} (molho)`),
            ...(item.additionals_drink ?? []).map((a) => `${a} (bebida)`),
            ...(item.additionals_sweet ?? []).map((a) => `${a} (doce)`),
          ].filter(Boolean);

          return (
            <div
              key={i}
              className="px-4 py-2.5"
              style={{
                borderBottom:
                  i < order.items.length - 1
                    ? "1px solid var(--color-border)"
                    : undefined,
              }}
            >
              <div className="flex items-start gap-3">
                <ItemPhoto photo={item.photo} name={item.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="text-sm font-medium leading-snug"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      1x {item.name}
                    </span>
                    <span
                      className="text-sm font-semibold flex-shrink-0"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {fmt(item.value)}
                    </span>
                  </div>
                  {extras.length > 0 && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      + {extras.join(", ")}
                    </p>
                  )}
                  {item.observation && (
                    <p
                      className="text-xs mt-0.5 italic"
                      style={{ color: "var(--color-warning)" }}
                    >
                      Obs: {item.observation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div
        className="px-4 py-3 flex flex-col gap-1"
        style={{
          borderTop: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-elevated)",
        }}
      >
        <div
          className="flex justify-between text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Subtotal</span>
          <span>{fmt(order.subtotal)}</span>
        </div>
        <div
          className="flex justify-between text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Taxa de serviço</span>
          <span>{fmt(order.serviceFee)}</span>
        </div>
        <div
          className="flex justify-between text-sm font-semibold mt-0.5"
          style={{ color: "var(--color-text-primary)" }}
        >
          <span>Total</span>
          <span>{fmt(order.subtotal + order.serviceFee)}</span>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-opacity hover:opacity-80 cursor-pointer"
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "var(--color-error)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onFinalize}
          className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-opacity hover:opacity-80 cursor-pointer"
          style={{ backgroundColor: "var(--color-primary)", color: "white" }}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ── FinishedCard ──────────────────────────────────────────────────────────────

function FinishedCard({
  order,
  expanded,
  onToggle,
  onDelete,
  deleting,
  onReactivate,
  onChat,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
  onReactivate: () => void;
  onChat: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const isCanceled = order.status === "canceled";

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
        >
          <span
            className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
            style={{
              backgroundColor: isCanceled
                ? "rgba(239,68,68,0.15)"
                : "rgba(34,197,94,0.15)",
              color: isCanceled ? "var(--color-error)" : "var(--color-success)",
            }}
          >
            #{order.orderNumber}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Vaga {order.spot}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: isCanceled
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(34,197,94,0.1)",
                  color: isCanceled
                    ? "var(--color-error)"
                    : "var(--color-success)",
                }}
              >
                {isCanceled ? "Cancelado" : "Finalizado"}
              </span>
            </div>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--color-text-muted)" }}
            >
              {order.username} · {order.items.length}{" "}
              {order.items.length === 1 ? "item" : "itens"} ·{" "}
              {fmt(order.total || order.subtotal + order.serviceFee)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {order.finishedAt
                ? fmtTime(order.finishedAt)
                : fmtTime(order.createdAt)}
            </span>
            <FiChevronDown
              size={14}
              style={{
                color: "var(--color-text-muted)",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </div>
        </button>

        {/* Inline confirm actions */}
        {confirmReactivate ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Reativar?
            </span>
            <button
              onClick={() => {
                onReactivate();
                setConfirmReactivate(false);
              }}
              className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-primary)" }}
            >
              Sim
            </button>
            <button
              onClick={() => setConfirmReactivate(false)}
              className="text-xs cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              Não
            </button>
          </div>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Excluir?
            </span>
            <button
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              disabled={deleting}
              className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-error)" }}
            >
              Sim
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              Não
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChat();
              }}
              className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
              title="Chat"
            >
              <FiMessageSquare size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmReactivate(true);
              }}
              className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-primary)" }}
              title="Reativar pedido"
            >
              <FiRefreshCw size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
              title="Excluir pedido"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 py-3 flex flex-col gap-2">
          {order.phone && (
            <a
              href={`https://wa.me/55${order.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs w-fit transition-opacity hover:opacity-70"
              style={{ color: "var(--color-success)" }}
            >
              <FiPhone size={12} />
              {order.phone}
            </a>
          )}
          {order.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              {item.photo ? (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="w-8 h-8 rounded-[var(--radius-sm)] object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "var(--color-bg-base)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <FiPackage size={12} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span
                    className="text-sm"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    1x {item.name}
                  </span>
                  <span
                    className="text-sm flex-shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {fmt(item.value)}
                  </span>
                </div>
                {item.observation && (
                  <p
                    className="text-xs italic mt-0.5"
                    style={{ color: "var(--color-warning)" }}
                  >
                    Obs: {item.observation}
                  </p>
                )}
              </div>
            </div>
          ))}

          {!isCanceled && (
            <div
              className="mt-2 pt-2 flex flex-col gap-1.5"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              {order.payment?.debit != null && order.payment.debit > 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>Débito</span>
                  <span>{fmt(order.payment.debit)}</span>
                </div>
              )}
              {order.payment?.credit != null && order.payment.credit > 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>Crédito</span>
                  <span>{fmt(order.payment.credit)}</span>
                </div>
              )}
              {order.payment?.money != null && order.payment.money > 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>Dinheiro</span>
                  <span>{fmt(order.payment.money)}</span>
                </div>
              )}
              {order.payment?.pix != null && order.payment.pix > 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>Pix</span>
                  <span>{fmt(order.payment.pix)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "var(--color-error)" }}
                >
                  <span>Desconto</span>
                  <span>− {fmt(order.discount)}</span>
                </div>
              )}
              <div
                className="flex justify-between text-sm font-semibold mt-0.5"
                style={{ color: "var(--color-text-primary)" }}
              >
                <span>Total</span>
                <span>{fmt(order.total)}</span>
              </div>
              <p
                className="text-xs"
                style={{
                  color: order.serviceFeePaid
                    ? "var(--color-success)"
                    : "var(--color-text-muted)",
                }}
              >
                Taxa de serviço: {order.serviceFeePaid ? "paga" : "não cobrada"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CancelModal ───────────────────────────────────────────────────────────────

function CancelModal({
  order,
  onConfirm,
  onClose,
  loading,
}: {
  order: Order;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius-xl)] p-6 flex flex-col gap-4"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "rgba(239,68,68,0.12)",
              color: "var(--color-error)",
            }}
          >
            <FiAlertTriangle size={18} />
          </div>
          <div>
            <p
              className="font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Cancelar pedido #{order.orderNumber}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Vaga {order.spot} · {order.username}
            </p>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Tem certeza que deseja cancelar este pedido? Esta ação não pode ser
          desfeita.
        </p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
            style={{ backgroundColor: "var(--color-error)", color: "white" }}
          >
            {loading ? "Cancelando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FinalizeModal ─────────────────────────────────────────────────────────────

function PaymentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-sm w-24 flex-shrink-0"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
        style={{
          backgroundColor: "var(--color-bg-base)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          R$
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={value === "0" ? undefined : value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--color-text-primary)" }}
          placeholder="0,00"
        />
      </div>
    </div>
  );
}

function FinalizeModal({
  order,
  onConfirm,
  onClose,
  loading,
}: {
  order: Order;
  onConfirm: (data: {
    payment: OrderPayment;
    discount: number;
    serviceFeePaid: boolean;
    total: number;
  }) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [money, setMoney] = useState("0");
  const [pix, setPix] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [serviceFeePaid, setServiceFeePaid] = useState(true);
  const [confirmStep, setConfirmStep] = useState(false);

  const debitVal = parseFloat(debit) || 0;
  const creditVal = parseFloat(credit) || 0;
  const moneyVal = parseFloat(money) || 0;
  const pixVal = parseFloat(pix) || 0;
  const discountVal = parseFloat(discount) || 0;

  const { success, error: toastError } = useToast();

  const finalTotal = Math.max(
    0,
    order.subtotal + (serviceFeePaid ? order.serviceFee : 0) - discountVal,
  );
  const amountPaid = debitVal + creditVal + moneyVal + pixVal;
  const change =
    moneyVal > 0 && amountPaid > finalTotal ? amountPaid - finalTotal : 0;

  const paidRounded = Math.round(amountPaid * 100);
  const totalRounded = Math.round(finalTotal * 100);
  const isMismatch = paidRounded !== totalRounded;
  const isNormalChange = amountPaid > finalTotal && moneyVal > 0;
  const needsConfirm = isMismatch && !isNormalChange;

  const mismatchMessage =
    amountPaid === 0
      ? "Nenhum valor de pagamento foi informado."
      : amountPaid < finalTotal
        ? `Valor informado ${fmt(amountPaid)} é menor que o total ${fmt(finalTotal)}.`
        : `Valor informado ${fmt(amountPaid)} excede o total sem troco em dinheiro.`;

  function resetAndSet(setter: (v: string) => void) {
    return (v: string) => { setter(v); setConfirmStep(false); };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-xl)] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div>
            <p
              className="font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Finalizar pedido #{order.orderNumber}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Vaga {order.spot} · {order.username} ·{" "}
              {fmt(order.subtotal + order.serviceFee)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          <PaymentInput label="Débito" value={debit} onChange={resetAndSet(setDebit)} />
          <PaymentInput label="Crédito" value={credit} onChange={resetAndSet(setCredit)} />
          <PaymentInput label="Dinheiro" value={money} onChange={resetAndSet(setMoney)} />
          <PaymentInput label="Pix" value={pix} onChange={resetAndSet(setPix)} />
          <PaymentInput label="Desconto" value={discount} onChange={resetAndSet(setDiscount)} />

          <button
            onClick={() => { setServiceFeePaid((v) => !v); setConfirmStep(false); }}
            className="flex items-center gap-2 text-sm mt-1 cursor-pointer transition-opacity hover:opacity-70"
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
              style={{
                backgroundColor: serviceFeePaid
                  ? "var(--color-primary)"
                  : "var(--color-bg-base)",
                border: serviceFeePaid
                  ? "none"
                  : "1px solid var(--color-border)",
              }}
            >
              {serviceFeePaid && <FiCheck size={12} color="white" />}
            </div>
            <span style={{ color: "var(--color-text-secondary)" }}>
              Taxa de serviço foi paga
            </span>
          </button>
        </div>

        <div
          className="px-5 py-3 flex flex-col gap-1.5"
          style={{
            borderTop: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-elevated)",
          }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--color-text-muted)" }}>
              Total a pagar
            </span>
            <span
              onClick={() => {
                navigator.clipboard.writeText(fmt(finalTotal));
                success(
                  `Valor de R$ ${finalTotal.toFixed(2)} foi copiado com sucesso`,
                );
              }}
              className="font-semibold cursor-pointer hover:font-bold hover:underline"
              style={{ color: "var(--color-text-primary)" }}
            >
              {fmt(finalTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--color-text-muted)" }}>
              Valor informado
            </span>
            <span
              style={{
                color:
                  amountPaid === finalTotal
                    ? "var(--color-success)"
                    : "var(--color-text-secondary)",
              }}
            >
              {fmt(amountPaid)}
            </span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-text-muted)" }}>Troco</span>
              <span style={{ color: "var(--color-warning)" }}>
                {fmt(change)}
              </span>
            </div>
          )}
        </div>

        {/* Mismatch warning */}
        {confirmStep && needsConfirm && (
          <div
            className="flex items-start gap-2.5 px-5 py-3"
            style={{
              backgroundColor: "rgba(245,158,11,0.08)",
              borderTop: "1px solid rgba(245,158,11,0.25)",
            }}
          >
            <FiAlertTriangle
              size={15}
              style={{ color: "var(--color-warning)", flexShrink: 0, marginTop: 1 }}
            />
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {mismatchMessage} Clique em{" "}
              <strong style={{ color: "var(--color-warning)" }}>Confirmar assim mesmo</strong>{" "}
              para finalizar.
            </p>
          </div>
        )}

        <div
          className="flex gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (needsConfirm && !confirmStep) {
                setConfirmStep(true);
                return;
              }
              onConfirm({
                payment: { debit: debitVal, credit: creditVal, money: moneyVal, pix: pixVal },
                discount: discountVal,
                serviceFeePaid,
                total: finalTotal,
              });
            }}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
            style={{
              backgroundColor: confirmStep && needsConfirm ? "var(--color-warning)" : "var(--color-primary)",
              color: "white",
            }}
          >
            {loading
              ? "Finalizando..."
              : confirmStep && needsConfirm
                ? "Confirmar assim mesmo"
                : "Finalizar Pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
  danger,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius-xl)] p-6 flex flex-col gap-4"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: danger
                ? "rgba(239,68,68,0.12)"
                : "rgba(0,136,194,0.12)",
              color: danger ? "var(--color-error)" : "var(--color-primary)",
            }}
          >
            <FiAlertTriangle size={18} />
          </div>
          <p
            className="font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {message}
        </p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-70"
            style={{
              backgroundColor: danger
                ? "var(--color-error)"
                : "var(--color-primary)",
              color: "white",
            }}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OrdersPage ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { activeOrders, markAsSeen } = useOrders();
  const { appUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [tab, setTab] = useState<"active" | "finished">("active");
  const [finishedOrders, setFinishedOrders] = useState<Order[]>([]);
  const [spotFilter, setSpotFilter] = useState("");
  const [orderFilter, setOrderFilter] = useState("");

  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<Order | null>(null);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [showNewOrder, setShowNewOrder] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState<Order | null>(null);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const [finishedStatusFilter, setFinishedStatusFilter] = useState<
    "all" | "finished" | "canceled"
  >("all");
  const [finishedDateFilter, setFinishedDateFilter] = useState(""); // "" | "today" | "yesterday" | "YYYY-MM-DD"

  useEffect(() => {
    markAsSeen();
  }, []);

  useEffect(() => {
    if (tab !== "finished") return;
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["finished", "canceled"]),
      orderBy("createdAt", "desc"),
      limit(100),
    );
    return onSnapshot(q, (snap) => {
      setFinishedOrders(
        snap.docs.map((d) =>
          parseOrder(d.id, d.data() as Record<string, unknown>),
        ),
      );
    });
  }, [tab]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(filteredFinished.map((o) => o.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  async function handleCancel() {
    if (!cancelTarget || !appUser) return;
    setLoadingAction(true);
    try {
      await updateDoc(doc(db, "orders", cancelTarget.id), {
        status: "canceled",
        finishedAt: serverTimestamp(),
      });
      log({
        action: "Pedido cancelado",
        category: "orders",
        description: `Pedido #${cancelTarget.orderNumber} (Vaga ${cancelTarget.spot}) foi cancelado`,
        performedBy: { uid: appUser.uid, username: appUser.username },
        target: {
          type: "order",
          id: cancelTarget.id,
          name: `#${cancelTarget.orderNumber}`,
        },
      });
      success(
        "Pedido cancelado",
        `Pedido #${cancelTarget.orderNumber} foi cancelado.`,
      );
      setCancelTarget(null);
      setTab("finished");
    } catch {
      toastError(
        "Erro",
        "Não foi possível cancelar o pedido. Tente novamente.",
      );
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleFinalize(data: {
    payment: OrderPayment;
    discount: number;
    serviceFeePaid: boolean;
    total: number;
  }) {
    if (!finalizeTarget || !appUser) return;
    setLoadingAction(true);
    try {
      await updateDoc(doc(db, "orders", finalizeTarget.id), {
        status: "finished",
        payment: data.payment,
        discount: data.discount,
        serviceFeePaid: data.serviceFeePaid,
        total: data.total,
        finishedAt: serverTimestamp(),
      });
      log({
        action: "Pedido finalizado",
        category: "orders",
        description: `Pedido #${finalizeTarget.orderNumber} (Vaga ${finalizeTarget.spot}) finalizado — Total: ${fmt(data.total)}`,
        performedBy: { uid: appUser.uid, username: appUser.username },
        target: {
          type: "order",
          id: finalizeTarget.id,
          name: `#${finalizeTarget.orderNumber}`,
        },
        changes: [
          { field: "status", from: "active", to: "finished" },
          {
            field: "total",
            from: String(
              (finalizeTarget.subtotal + finalizeTarget.serviceFee).toFixed(2),
            ),
            to: String(data.total.toFixed(2)),
          },
          ...(data.discount > 0
            ? [
                {
                  field: "desconto",
                  from: "0",
                  to: String(data.discount.toFixed(2)),
                },
              ]
            : []),
          {
            field: "taxa_serviço",
            from: null,
            to: data.serviceFeePaid ? "paga" : "não cobrada",
          },
        ],
      });
      success(
        "Pedido finalizado!",
        `Pedido #${finalizeTarget.orderNumber} finalizado com sucesso.`,
      );
      setFinalizeTarget(null);
    } catch {
      toastError(
        "Erro",
        "Não foi possível finalizar o pedido. Tente novamente.",
      );
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDelete(order: Order) {
    setDeletingId(order.id);
    try {
      await deleteDoc(doc(db, "orders", order.id));
      log({
        action: "Pedido excluído",
        category: "orders",
        description: `Pedido #${order.orderNumber} (Vaga ${order.spot}) excluído`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
        target: { type: "order", id: order.id, name: `#${order.orderNumber}` },
      });
      success("Excluído", `Pedido #${order.orderNumber} foi excluído.`);
    } catch {
      toastError("Erro", "Não foi possível excluir o pedido.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReactivate(order: Order) {
    setReactivateTarget(null);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "active",
        payment: deleteField(),
        discount: 0,
        serviceFeePaid: false,
        total: order.subtotal + order.serviceFee,
        finishedAt: deleteField(),
      });
      log({
        action: "Pedido reativado",
        category: "orders",
        description: `Pedido #${order.orderNumber} (Vaga ${order.spot}) reativado`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
        target: { type: "order", id: order.id, name: `#${order.orderNumber}` },
      });
      success(
        "Pedido reativado",
        `Pedido #${order.orderNumber} está ativo novamente.`,
      );
      setTab("active");
    } catch {
      toastError(
        "Erro",
        "Não foi possível reativar o pedido. Tente novamente.",
      );
    }
  }

  async function handleBulkDeleteCanceled() {
    setBulkDeleting(true);
    const canceled = finishedOrders.filter((o) => o.status === "canceled");
    try {
      await Promise.all(
        canceled.map((o) => deleteDoc(doc(db, "orders", o.id))),
      );
      log({
        action: "Pedidos cancelados excluídos em massa",
        category: "orders",
        description: `${canceled.length} pedido(s) cancelado(s) foram excluídos`,
        performedBy: { uid: appUser!.uid, username: appUser!.username },
      });
      success(
        "Excluídos",
        `${canceled.length} pedido(s) cancelado(s) foram excluídos.`,
      );
      setConfirmBulkDelete(false);
    } catch {
      toastError("Erro", "Não foi possível excluir os pedidos.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const filteredActive = activeOrders.filter((o) => {
    if (spotFilter && !String(o.spot).includes(spotFilter)) return false;
    if (orderFilter && !String(o.orderNumber).includes(orderFilter))
      return false;
    return true;
  });

  const filteredFinished = finishedOrders.filter((o) => {
    if (spotFilter && !String(o.spot).includes(spotFilter)) return false;
    if (orderFilter && !String(o.orderNumber).includes(orderFilter))
      return false;
    if (finishedStatusFilter !== "all" && o.status !== finishedStatusFilter)
      return false;
    if (finishedDateFilter) {
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (finishedDateFilter === "today") {
        if (d.getTime() !== today.getTime()) return false;
      } else if (finishedDateFilter === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.getTime() !== yesterday.getTime()) return false;
      } else {
        const [y, m, day] = finishedDateFilter.split("-").map(Number);
        const custom = new Date(y, m - 1, day);
        if (d.getTime() !== custom.getTime()) return false;
      }
    }
    return true;
  });

  const hasCanceled = finishedOrders.some((o) => o.status === "canceled");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div
        className="flex flex-col gap-3 p-4 sm:p-6"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Pedidos
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              {activeOrders.length === 0
                ? "Nenhum pedido ativo"
                : `${activeOrders.length} pedido${activeOrders.length !== 1 ? "s" : ""} ativo${activeOrders.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="flex gap-1 p-1 rounded-[var(--radius-md)]"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              {(["active", "finished"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor:
                      tab === t ? "var(--color-bg-surface)" : "transparent",
                    color:
                      tab === t
                        ? "var(--color-text-primary)"
                        : "var(--color-text-muted)",
                    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {t === "active" ? "Ativos" : "Finalizados"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              title="Mensagens prontas"
            >
              <FiBookmark size={15} />
              <span className="hidden sm:inline">Mensagens</span>
            </button>

            <button
              onClick={() => setShowNewOrder(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
              }}
            >
              <FiPlus size={16} />
              <span className="hidden sm:inline">Novo Pedido</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-[var(--radius-md)]"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
            }}
          >
            <FiSearch
              size={14}
              style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
            />
            <input
              type="number"
              value={spotFilter}
              onChange={(e) => setSpotFilter(e.target.value)}
              placeholder="Filtrar por vaga"
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: "var(--color-text-primary)" }}
            />
            {spotFilter && (
              <button
                onClick={() => setSpotFilter("")}
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiX size={14} />
              </button>
            )}
          </div>
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-[var(--radius-md)]"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
            }}
          >
            <FiSearch
              size={14}
              style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
            />
            <input
              type="number"
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              placeholder="Número do pedido"
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: "var(--color-text-primary)" }}
            />
            {orderFilter && (
              <button
                onClick={() => setOrderFilter("")}
                style={{ color: "var(--color-text-muted)" }}
              >
                <FiX size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6">
        {tab === "active" &&
          (filteredActive.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] py-32 gap-4"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  color: "var(--color-text-muted)",
                }}
              >
                <FiShoppingBag size={24} />
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                {spotFilter || orderFilter
                  ? "Nenhum pedido encontrado"
                  : "Nenhum pedido ativo no momento"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredActive.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onCancel={() => setCancelTarget(order)}
                  onFinalize={() => setFinalizeTarget(order)}
                  onEdit={() => setEditTarget(order)}
                  onChat={() => setChatOrder(order)}
                />
              ))}
            </div>
          ))}

        {tab === "finished" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Status chips */}
              <div className="flex gap-1">
                {(["all", "finished", "canceled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFinishedStatusFilter(s)}
                    className="px-2.5 py-1 rounded-(--radius-sm) text-xs font-medium cursor-pointer outline-0"
                    style={{
                      backgroundColor:
                        finishedStatusFilter === s
                          ? "var(--color-primary)"
                          : "var(--color-bg-elevated)",
                      color:
                        finishedStatusFilter === s
                          ? "white"
                          : "var(--color-text-muted)",
                      border:
                        finishedStatusFilter === s
                          ? "none"
                          : "1px solid var(--color-border)",
                    }}
                  >
                    {s === "all"
                      ? "Todos"
                      : s === "finished"
                        ? "Finalizados"
                        : "Cancelados"}
                  </button>
                ))}
              </div>

              {/* Date chips + picker */}
              <div className="flex items-center gap-1 flex-wrap">
                {(["today", "yesterday"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() =>
                      setFinishedDateFilter(finishedDateFilter === d ? "" : d)
                    }
                    className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor:
                        finishedDateFilter === d
                          ? "var(--color-primary)"
                          : "var(--color-bg-elevated)",
                      color:
                        finishedDateFilter === d
                          ? "white"
                          : "var(--color-text-mPuted)",
                      border:
                        finishedDateFilter === d
                          ? "none"
                          : "1px solid var(--color-border)",
                    }}
                  >
                    {d === "today" ? "Hoje" : "Ontem"}
                  </button>
                ))}
                <input
                  type="date"
                  value={
                    !["today", "yesterday", ""].includes(finishedDateFilter)
                      ? finishedDateFilter
                      : ""
                  }
                  onChange={(e) => setFinishedDateFilter(e.target.value || "")}
                  className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs cursor-pointer outline-none"
                  style={{
                    backgroundColor: !["today", "yesterday", ""].includes(
                      finishedDateFilter,
                    )
                      ? "var(--color-primary-light)"
                      : "var(--color-bg-elevated)",
                    color: !["today", "yesterday", ""].includes(
                      finishedDateFilter,
                    )
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)",
                    border: !["today", "yesterday", ""].includes(
                      finishedDateFilter,
                    )
                      ? "1px solid rgba(0,136,194,0.4)"
                      : "1px solid var(--color-border)",
                  }}
                />
                {finishedDateFilter && (
                  <button
                    onClick={() => setFinishedDateFilter("")}
                    className="p-1 cursor-pointer transition-opacity hover:opacity-70"
                    style={{ color: "var(--color-text-muted)" }}
                    title="Limpar data"
                  >
                    <FiX size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Toolbar */}
            {filteredFinished.length > 0 && (
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <FiMaximize2 size={11} />
                    Expandir tudo
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <FiMinimize2 size={11} />
                    Recolher tudo
                  </button>
                </div>
                {hasCanceled && (
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
                    style={{
                      backgroundColor: "rgba(239,68,68,0.1)",
                      color: "var(--color-error)",
                      border: "1px solid rgba(239,68,68,0.25)",
                    }}
                  >
                    <FiTrash2 size={11} />
                    Excluir cancelados
                  </button>
                )}
              </div>
            )}

            {filteredFinished.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] py-32 gap-4"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <FiCheck size={24} />
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {spotFilter || orderFilter
                    ? "Nenhum pedido encontrado"
                    : "Nenhum pedido finalizado"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredFinished.map((order) => (
                  <FinishedCard
                    key={order.id}
                    order={order}
                    expanded={expandedIds.has(order.id)}
                    onToggle={() => toggleExpand(order.id)}
                    onDelete={() => handleDelete(order)}
                    deleting={deletingId === order.id}
                    onReactivate={() => handleReactivate(order)}
                    onChat={() => setChatOrder(order)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
          loading={loadingAction}
        />
      )}
      {finalizeTarget && (
        <FinalizeModal
          order={finalizeTarget}
          onConfirm={handleFinalize}
          onClose={() => setFinalizeTarget(null)}
          loading={loadingAction}
        />
      )}
      {confirmBulkDelete && (
        <ConfirmModal
          title="Excluir pedidos cancelados"
          message={`Isso vai excluir permanentemente ${finishedOrders.filter((o) => o.status === "canceled").length} pedido(s) cancelado(s). Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir todos"
          onConfirm={handleBulkDeleteCanceled}
          onClose={() => setConfirmBulkDelete(false)}
          loading={bulkDeleting}
          danger
        />
      )}
      {showNewOrder && (
        <NewOrderModal
          onClose={() => setShowNewOrder(false)}
          onSuccess={() => setShowNewOrder(false)}
        />
      )}
      {editTarget && (
        <NewOrderModal
          editOrder={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => setEditTarget(null)}
        />
      )}
      {chatOrder && (
        <OrderChatDrawer order={chatOrder} onClose={() => setChatOrder(null)} />
      )}
      {showTemplates && (
        <ChatTemplatesModal onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}
