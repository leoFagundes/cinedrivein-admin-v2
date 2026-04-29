"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  FiX,
  FiSearch,
  FiPlus,
  FiMinus,
  FiCheck,
  FiShoppingCart,
  FiPackage,
  FiAlertCircle,
  FiZap,
} from "react-icons/fi";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { log } from "@/lib/logger";
import { StockItem, Subitem, Order } from "@/types";

const SERVICE_FEE_RATE = 0.1;

function fmt(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface DraftItem {
  draftId: string;
  item: StockItem;
  quantity: number;
  observation: string;
  additional: string;
  additional_sauce: string;
  additional_drink: string;
  additional_sweet: string;
}

// ── ItemCard ──────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: StockItem; onClick: () => void }) {
  const price = (item.visibleValue ?? item.value).toFixed(2).replace(".", ",");
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-[var(--radius-md)] overflow-hidden text-left cursor-pointer transition-all"
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "var(--color-primary)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "var(--color-border)")
      }
    >
      {item.photo ? (
        <div className="w-full h-24 overflow-hidden flex-shrink-0">
          <img
            src={item.photo}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full h-24 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "var(--color-bg-base)" }}
        >
          <FiPackage size={24} style={{ color: "var(--color-text-muted)" }} />
        </div>
      )}
      <div className="p-2.5 flex flex-col gap-0.5">
        <p
          className="text-xs font-semibold leading-snug line-clamp-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          {item.name}
        </p>
        {item.codItem && (
          <p
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {item.codItem}
          </p>
        )}
        <p
          className="text-xs font-bold mt-1"
          style={{ color: "var(--color-primary)" }}
        >
          R$ {price}
        </p>
      </div>
    </button>
  );
}

// ── RadioGroup (single-select per group) ──────────────────────────────────────

function RadioGroup({
  title,
  ids,
  allSubitems,
  selected,
  onChange,
}: {
  title: string;
  ids: string[];
  allSubitems: Subitem[];
  selected: string;
  onChange: (name: string) => void;
}) {
  const options = ids
    .map((id) => allSubitems.find((s) => s.id === id))
    .filter((s): s is Subitem => !!s && s.isVisible);

  if (options.length === 0) return null;

  function toggle(name: string) {
    onChange(selected === name ? "" : name);
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        {title} <span className="font-normal opacity-60">(escolha um)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected === opt.name;
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.name)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: active
                  ? "var(--color-primary-light)"
                  : "var(--color-bg-base)",
                color: active
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
                border: active
                  ? "1px solid rgba(0,136,194,0.4)"
                  : "1px solid var(--color-border)",
              }}
            >
              {active && <FiCheck size={10} />}
              {opt.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── ItemConfigurator ──────────────────────────────────────────────────────────

function ItemConfigurator({
  item,
  subitems,
  onAdd,
  onClose,
}: {
  item: StockItem;
  subitems: Subitem[];
  onAdd: (draft: Omit<DraftItem, "draftId">) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  const [additional, setAdditional] = useState("");
  const [sauce, setSauce] = useState("");
  const [drink, setDrink] = useState("");
  const [sweet, setSweet] = useState("");

  const hasAnyGroup =
    item.additionals.length > 0 ||
    item.additionals_sauce.length > 0 ||
    item.additionals_drink.length > 0 ||
    item.additionals_sweet.length > 0;

  return (
    <div
      className="w-full max-w-sm flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        maxHeight: "85vh",
      }}
    >
      <div
        className="flex items-start gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {item.photo && (
          <img
            src={item.photo}
            alt={item.name}
            className="w-12 h-12 rounded-[var(--radius-md)] object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {item.name}
          </p>
          {item.description && (
            <p
              className="text-xs mt-0.5 line-clamp-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              {item.description}
            </p>
          )}
          <p
            className="text-sm font-bold mt-1"
            style={{ color: "var(--color-primary)" }}
          >
            {fmt(item.visibleValue ?? item.value)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 cursor-pointer flex-shrink-0 transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
        >
          <FiX size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            Observação
          </label>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: sem cebola, bem passado..."
            rows={2}
            className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm resize-none outline-none"
            style={{
              backgroundColor: "var(--color-bg-base)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {hasAnyGroup && (
          <>
            <RadioGroup
              title="Adicional"
              ids={item.additionals}
              allSubitems={subitems}
              selected={additional}
              onChange={setAdditional}
            />
            <RadioGroup
              title="Molho"
              ids={item.additionals_sauce}
              allSubitems={subitems}
              selected={sauce}
              onChange={setSauce}
            />
            <RadioGroup
              title="Bebida"
              ids={item.additionals_drink}
              allSubitems={subitems}
              selected={drink}
              onChange={setDrink}
            />
            <RadioGroup
              title="Doce"
              ids={item.additionals_sweet}
              allSubitems={subitems}
              selected={sweet}
              onChange={setSweet}
            />
          </>
        )}
      </div>

      {/* Quantity stepper */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-elevated)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Quantidade</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70"
            style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <FiMinus size={12} />
          </button>
          <span className="w-6 text-center text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary)", color: "white" }}
          >
            <FiPlus size={12} />
          </button>
        </div>
        {quantity > 1 && (
          <span className="ml-auto text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
            = {`R$ ${((item.visibleValue ?? item.value) * quantity).toFixed(2).replace(".", ",")}`}
          </span>
        )}
      </div>

      <div
        className="flex gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <button
          onClick={onClose}
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
          onClick={() =>
            onAdd({
              item,
              quantity,
              observation,
              additional,
              additional_sauce: sauce,
              additional_drink: drink,
              additional_sweet: sweet,
            })
          }
          className="flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: "var(--color-primary)", color: "white" }}
        >
          <FiPlus size={14} />
          Adicionar
        </button>
      </div>
    </div>
  );
}

// ── NewOrderModal ─────────────────────────────────────────────────────────────

export default function NewOrderModal({
  onClose,
  onSuccess,
  editOrder,
}: {
  onClose: () => void;
  onSuccess: () => void;
  editOrder?: Order;
}) {
  const { appUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [subitems, setSubitems] = useState<Subitem[]>([]);
  const [categoryOrderList, setCategoryOrderList] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [customerName, setCustomerName] = useState(editOrder?.username ?? "");
  const [customerPhone, setCustomerPhone] = useState(
    editOrder?.phone ? applyPhoneMask(editOrder.phone) : "",
  );
  const [customerSpot, setCustomerSpot] = useState(
    editOrder ? String(editOrder.spot) : "",
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [configuringItem, setConfiguringItem] = useState<StockItem | null>(
    null,
  );

  const [mobileTab, setMobileTab] = useState<"catalog" | "order">("catalog");
  const [submitting, setSubmitting] = useState(false);
  const initializedEdit = useRef(false);

  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [spotError, setSpotError] = useState("");
  const [itemsError, setItemsError] = useState("");
  const hasFormError = !!(nameError || spotError || itemsError);

  // Load catalog and category order
  useEffect(() => {
    async function load() {
      try {
        const [itemsSnap, subSnap, configSnap] = await Promise.all([
          getDocs(query(collection(db, "items"), orderBy("name"))),
          getDocs(collection(db, "subitems")),
          getDoc(doc(db, "stockConfig", "categoryOrder")),
        ]);
        setStockItems(
          itemsSnap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                codItem: data.codItem ?? "",
                name: data.name ?? "",
                category: data.category ?? "",
                description: data.description ?? "",
                value: data.value ?? 0,
                visibleValue: data.visibleValue,
                quantity: data.quantity ?? 0,
                photo: data.photo,
                isVisible: data.isVisible ?? true,
                isFeatured: data.isFeatured ?? false,
                trackStock: data.trackStock ?? false,
                additionals: data.additionals ?? [],
                additionals_sauce: data.additionals_sauce ?? [],
                additionals_drink: data.additionals_drink ?? [],
                additionals_sweet: data.additionals_sweet ?? [],
                createdAt:
                  (data.createdAt as Timestamp)?.toDate() ?? new Date(),
              } as StockItem;
            })
            .filter((i) => i.isVisible),
        );
        setSubitems(
          subSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name ?? "",
              description: data.description ?? "",
              isVisible: data.isVisible ?? true,
              photo: data.photo,
              createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            } as Subitem;
          }),
        );
        if (configSnap.exists()) {
          setCategoryOrderList(configSnap.data().categories ?? []);
        }
      } catch {
        toastError("Erro", "Não foi possível carregar o catálogo.");
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, []);

  // Initialize draft items from editOrder once stock items load
  useEffect(() => {
    if (!editOrder || stockItems.length === 0 || initializedEdit.current)
      return;
    initializedEdit.current = true;
    setDraftItems(
      editOrder.items.map((oi) => {
        const fullItem = stockItems.find((s) => s.id === oi.itemId);
        return {
          draftId: crypto.randomUUID(),
          item:
            fullItem ??
            ({
              id: oi.itemId,
              codItem: oi.codItem,
              name: oi.name,
              value: oi.value,
              visibleValue: oi.value,
              photo: oi.photo,
              category: "",
              description: "",
              quantity: 999,
              isVisible: true,
              isFeatured: false,
              trackStock: oi.trackStock ?? false,
              additionals: [],
              additionals_sauce: [],
              additionals_drink: [],
              additionals_sweet: [],
              createdAt: new Date(),
            } as StockItem),
          quantity: (oi.quantity as number) ?? 1,
          observation: oi.observation ?? "",
          additional: (oi.additionals ?? [])[0] ?? "",
          additional_sauce: (oi.additionals_sauce ?? [])[0] ?? "",
          additional_drink: (oi.additionals_drink ?? [])[0] ?? "",
          additional_sweet: (oi.additionals_sweet ?? [])[0] ?? "",
        };
      }),
    );
  }, [editOrder, stockItems]);

  const categories = useMemo(() => {
    const inOrder = categoryOrderList.filter((cat) =>
      stockItems.some((i) => i.category === cat),
    );
    const notInOrder = Array.from(
      new Set(stockItems.map((i) => i.category).filter(Boolean)),
    )
      .filter((c) => !categoryOrderList.includes(c))
      .sort();
    return ["all", ...inOrder, ...notInOrder];
  }, [stockItems, categoryOrderList]);

  const filteredItems = useMemo(() => {
    const base = stockItems.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (
        search &&
        !i.name.toLowerCase().includes(search.toLowerCase()) &&
        !i.codItem.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
    return base.sort((a, b) => {
      const ai = categoryOrderList.indexOf(a.category);
      const bi = categoryOrderList.indexOf(b.category);
      const ap = ai === -1 ? 999 : ai;
      const bp = bi === -1 ? 999 : bi;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [stockItems, category, search, categoryOrderList]);

  const subtotal = draftItems.reduce(
    (sum, d) => sum + d.item.value * d.quantity,
    0,
  );
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;
  const total = subtotal + serviceFee;

  function updateQuantity(draftId: string, delta: number) {
    setDraftItems((prev) =>
      prev.map((d) =>
        d.draftId === draftId
          ? { ...d, quantity: Math.max(1, d.quantity + delta) }
          : d,
      ),
    );
  }

  function handleAddItem(draft: Omit<DraftItem, "draftId">) {
    setDraftItems((prev) => [
      ...prev,
      { ...draft, draftId: crypto.randomUUID() },
    ]);
    setItemsError("");
    setConfiguringItem(null);
    setMobileTab("order");
  }

  function removeItem(draftId: string) {
    setDraftItems((prev) => prev.filter((d) => d.draftId !== draftId));
  }

  function quickOrder() {
    setCustomerName("Anônimo");
    setCustomerPhone(applyPhoneMask("99999999999"));
    setNameError("");
  }

  function validate() {
    let ok = true;
    if (!customerName.trim()) {
      setNameError("Nome obrigatório");
      ok = false;
    }
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (!phoneDigits) {
      setPhoneError("Telefone obrigatório");
      ok = false;
    }
    const spotDigits = customerSpot.trim().replace(/\D/g, "");
    if (!spotDigits || spotDigits.length < 3 || spotDigits.length > 4) {
      setSpotError("Vaga inválida (deve ter 3 ou 4 dígitos)");
      ok = false;
    }
    if (draftItems.length === 0) {
      setItemsError("Adicione pelo menos um item");
      ok = false;
    }
    if (!ok) setMobileTab("order");
    return ok;
  }

  async function handleSubmit() {
    if (!validate() || !appUser) return;
    setSubmitting(true);
    const spot = parseInt(customerSpot, 10);
    const itemsPayload = draftItems.map((d) => {
      const entry: Record<string, unknown> = {
        itemId: d.item.id,
        codItem: d.item.codItem,
        name: d.item.name,
        value: d.item.value,
        quantity: d.quantity,
        trackStock: d.item.trackStock ?? false,
        additionals: d.additional ? [d.additional] : [],
        additionals_sauce: d.additional_sauce ? [d.additional_sauce] : [],
        additionals_drink: d.additional_drink ? [d.additional_drink] : [],
        additionals_sweet: d.additional_sweet ? [d.additional_sweet] : [],
      };
      if (d.item.visibleValue != null) entry.visibleValue = d.item.visibleValue;
      if (d.item.photo) entry.photo = d.item.photo;
      if (d.observation) entry.observation = d.observation;
      return entry;
    });

    try {
      if (editOrder) {
        await updateDoc(doc(db, "orders", editOrder.id), {
          username: customerName.trim(),
          phone: customerPhone.trim(),
          spot,
          items: itemsPayload,
          subtotal,
          serviceFee,
          total,
        });
        log({
          action: "Pedido editado",
          category: "orders",
          description: `Pedido #${editOrder.orderNumber} (Vaga ${spot}) editado`,
          performedBy: { uid: appUser.uid, username: appUser.username },
          target: {
            type: "order",
            id: editOrder.id,
            name: `#${editOrder.orderNumber}`,
          },
        });
        success(
          "Pedido atualizado!",
          `Pedido #${editOrder.orderNumber} foi atualizado.`,
        );
      } else {
        const counterRef = doc(db, "counters", "orders");
        const orderNumber = await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const next = (snap.exists() ? (snap.data().last as number) : 0) + 1;
          tx.set(counterRef, { last: next }, { merge: true });
          return next;
        });
        const orderRef = await addDoc(collection(db, "orders"), {
          orderNumber,
          username: customerName.trim(),
          phone: customerPhone.trim(),
          spot,
          status: "active",
          items: itemsPayload,
          subtotal,
          serviceFee,
          serviceFeePaid: false,
          discount: 0,
          total,
          createdAt: serverTimestamp(),
        });
        log({
          action: "Pedido criado",
          category: "orders",
          description: `Pedido #${orderNumber} criado para ${customerName.trim()} (Vaga ${spot})`,
          performedBy: { uid: appUser.uid, username: appUser.username },
          target: { type: "order", id: orderRef.id, name: `#${orderNumber}` },
        });
        success("Pedido criado!", `Pedido #${orderNumber} aberto com sucesso.`);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      toastError("Erro", "Não foi possível salvar o pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Catalog panel ──────────────────────────────────────────────────────────

  const catalogPanel = (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        className="flex flex-col gap-2 p-4 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
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
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredItems.length === 1)
                setConfiguringItem(filteredItems[0]);
            }}
            placeholder="Buscar item ou código..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ color: "var(--color-text-muted)" }}
            >
              <FiX size={14} />
            </button>
          )}
        </div>
        {categories.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0 cursor-pointer"
                style={{
                  backgroundColor:
                    category === cat
                      ? "var(--color-primary)"
                      : "var(--color-bg-elevated)",
                  color: category === cat ? "white" : "var(--color-text-muted)",
                  border:
                    category === cat ? "none" : "1px solid var(--color-border)",
                }}
              >
                {cat === "all" ? "Todos" : cat}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {dataLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Carregando catálogo...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Nenhum item encontrado
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => setConfiguringItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Order panel ────────────────────────────────────────────────────────────

  const orderPanel = (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Customer */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Dados do Cliente
            </p>
            {!editOrder && (
              <button
                onClick={quickOrder}
                className="flex items-center gap-1 text-xs cursor-pointer transition-opacity hover:opacity-70"
                style={{ color: "var(--color-primary)" }}
              >
                <FiZap size={12} />
                Pedido Rápido
              </button>
            )}
          </div>

          <div>
            <input
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="Nome do cliente *"
              className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm outline-none"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: `1px solid ${nameError ? "var(--color-error)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
              }}
            />
            {nameError && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--color-error)" }}
              >
                {nameError}
              </p>
            )}
          </div>

          <div>
            <input
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(applyPhoneMask(e.target.value));
                if (phoneError) setPhoneError("");
              }}
              placeholder="(61) 99999-9999 *"
              className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm outline-none"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: `1px solid ${phoneError ? "var(--color-error)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
              }}
            />
            {phoneError && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--color-error)" }}
              >
                {phoneError}
              </p>
            )}
          </div>

          <div>
            <input
              type="number"
              value={customerSpot}
              onChange={(e) => {
                setCustomerSpot(e.target.value);
                if (spotError) setSpotError("");
              }}
              placeholder="Número da vaga *"
              className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm outline-none"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: `1px solid ${spotError ? "var(--color-error)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
              }}
            />
            {spotError && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--color-error)" }}
              >
                {spotError}
              </p>
            )}
          </div>
        </div>

        {/* Draft items */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Itens
            </p>
            {draftItems.length > 0 && (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {draftItems.reduce((s, d) => s + d.quantity, 0)} {draftItems.reduce((s, d) => s + d.quantity, 0) === 1 ? "item" : "itens"}
              </span>
            )}
          </div>

          {itemsError && (
            <p className="text-xs" style={{ color: "var(--color-error)" }}>
              {itemsError}
            </p>
          )}

          {draftItems.length === 0 ? (
            <button
              onClick={() => setMobileTab("catalog")}
              className="flex flex-col items-center justify-center py-8 gap-2 rounded-[var(--radius-md)] cursor-pointer md:cursor-default transition-opacity hover:opacity-70 md:hover:opacity-100"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px dashed var(--color-border)",
              }}
            >
              <FiShoppingCart
                size={22}
                style={{ color: "var(--color-text-muted)" }}
              />
              <p
                className="text-xs text-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                <span className="md:hidden">
                  Toque aqui para ver o catálogo
                </span>
                <span className="hidden md:inline">
                  Clique em um item para adicionar
                </span>
              </p>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {draftItems.map((d) => {
                const extras = [
                  d.additional && `${d.additional} (adicional)`,
                  d.additional_sauce && `${d.additional_sauce} (molho)`,
                  d.additional_drink && `${d.additional_drink} (bebida)`,
                  d.additional_sweet && `${d.additional_sweet} (doce)`,
                ].filter(Boolean) as string[];
                return (
                  <div
                    key={d.draftId}
                    className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)]"
                    style={{
                      backgroundColor: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {d.item.photo ? (
                      <img
                        src={d.item.photo}
                        alt={d.item.name}
                        className="w-9 h-9 rounded-[var(--radius-sm)] object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: "var(--color-bg-base)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        <FiPackage size={14} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className="text-sm font-medium leading-snug"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {d.item.name}
                        </span>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                            {fmt(d.item.value)}
                          </span>
                          {d.item.visibleValue != null && d.item.visibleValue !== d.item.value && (
                            <span className="text-[10px]" style={{ color: "var(--color-primary)", opacity: 0.8 }}>
                              cliente: {fmt(d.item.visibleValue)}
                            </span>
                          )}
                          {d.quantity > 1 && (
                            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                              total: {fmt(d.item.value * d.quantity)}
                            </span>
                          )}
                        </div>
                      </div>
                      {extras.length > 0 && extras.map((e, j) => (
                        <p key={j} className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                          + {e}
                        </p>
                      ))}
                      {d.observation && (
                        <p
                          className="text-[11px] italic mt-0.5"
                          style={{ color: "var(--color-warning)" }}
                        >
                          Obs: {d.observation}
                        </p>
                      )}
                    </div>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(d.draftId, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70"
                        style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
                      >
                        <FiMinus size={10} />
                      </button>
                      <span className="w-5 text-center text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                        {d.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(d.draftId, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                      >
                        <FiPlus size={10} />
                      </button>
                      <button
                        onClick={() => removeItem(d.draftId)}
                        className="w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70 ml-0.5"
                        style={{ color: "var(--color-error)" }}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totals */}
        {draftItems.length > 0 && (
          <div
            className="flex flex-col gap-1.5 p-3 rounded-[var(--radius-md)]"
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="flex justify-between text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div
              className="flex justify-between text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <span>Taxa de serviço (10%)</span>
              <span>{fmt(serviceFee)}</span>
            </div>
            <div
              className="flex justify-between text-sm font-semibold mt-0.5"
              style={{ color: "var(--color-text-primary)" }}
            >
              <span>Total estimado</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const isEdit = !!editOrder;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center md:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="w-full md:max-w-5xl flex flex-col overflow-hidden md:rounded-[var(--radius-xl)]"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          maxHeight: "100dvh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <p
            className="font-semibold text-lg"
            style={{ color: "var(--color-text-primary)" }}
          >
            {isEdit ? `Editar Pedido #${editOrder.orderNumber}` : "Novo Pedido"}
          </p>
          <button
            onClick={onClose}
            className="p-1.5 rounded cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Mobile tabs */}
        <div
          className="md:hidden flex flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {(["catalog", "order"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className="flex-1 py-2.5 text-sm font-medium cursor-pointer transition-colors relative flex items-center justify-center gap-1.5"
              style={{
                color:
                  mobileTab === t
                    ? "var(--color-primary)"
                    : "var(--color-text-muted)",
                borderBottom:
                  mobileTab === t
                    ? "2px solid var(--color-primary)"
                    : "2px solid transparent",
              }}
            >
              {t === "catalog"
                ? "Catálogo"
                : `Pedido${draftItems.length > 0 ? ` (${draftItems.length})` : ""}`}
              {t === "order" && hasFormError && (
                <FiAlertCircle
                  size={13}
                  style={{ color: "var(--color-error)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <div
            className={`flex-col md:w-3/5 overflow-hidden ${mobileTab === "catalog" ? "flex" : "hidden md:flex"}`}
            style={{ borderRight: "1px solid var(--color-border)" }}
          >
            {catalogPanel}
          </div>
          <div
            className={`flex-col md:w-2/5 overflow-hidden ${mobileTab === "order" ? "flex" : "hidden md:flex"}`}
          >
            {orderPanel}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-5 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
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
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary)", color: "white" }}
          >
            {submitting
              ? isEdit
                ? "Salvando..."
                : "Criando..."
              : isEdit
                ? "Salvar Alterações"
                : `Criar Pedido${draftItems.length > 0 ? ` (${draftItems.length})` : ""}`}
          </button>
        </div>

        {/* Item configurator overlay */}
        {configuringItem && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
          >
            <ItemConfigurator
              item={configuringItem}
              subitems={subitems}
              onAdd={handleAddItem}
              onClose={() => setConfiguringItem(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
