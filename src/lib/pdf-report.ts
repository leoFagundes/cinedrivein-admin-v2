import type { DailyStats } from "@/types";

export interface PdfReportInput {
  from: string;
  to: string;
  days: DailyStats[];
  pending?: {
    finished: number;
    canceled: number;
    revenue: number;
  } | null;
}

function fmt(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

const PRIMARY = [0, 136, 194] as const;
const DARK = [30, 34, 50] as const;
const MUTED = [120, 126, 148] as const;
const SUCCESS = [34, 197, 94] as const;
const ERROR = [239, 68, 68] as const;
const BG_ROW = [245, 247, 252] as const;

export async function generatePdfReport(input: PdfReportInput) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const { from, to, days, pending } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 18;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalFinished =
    days.reduce((s, d) => s + d.finishedOrders, 0) + (pending?.finished ?? 0);
  const totalCanceled =
    days.reduce((s, d) => s + d.canceledOrders, 0) + (pending?.canceled ?? 0);
  const rev = {
    money: days.reduce((s, d) => s + d.revenue.money, 0),
    pix: days.reduce((s, d) => s + d.revenue.pix, 0),
    credit: days.reduce((s, d) => s + d.revenue.credit, 0),
    debit: days.reduce((s, d) => s + d.revenue.debit, 0),
    discount: days.reduce((s, d) => s + (d.revenue.discount ?? 0), 0),
    subtotal: days.reduce((s, d) => s + d.revenue.subtotal, 0),
    serviceFee: days.reduce((s, d) => s + d.revenue.serviceFee, 0),
    total:
      days.reduce((s, d) => s + d.revenue.total, 0) + (pending?.revenue ?? 0),
  };

  // Top items aggregation
  const itemMap: Record<
    string,
    { name: string; codItem: string; quantity: number }
  > = {};
  days.forEach((d) => {
    d.topItems.forEach((item) => {
      const key = item.codItem || item.name;
      if (itemMap[key]) {
        itemMap[key].quantity += item.quantity;
      } else {
        itemMap[key] = {
          name: item.name,
          codItem: item.codItem,
          quantity: item.quantity,
        };
      }
    });
  });
  const topItems = Object.values(itemMap).sort(
    (a, b) => b.quantity - a.quantity,
  );

  const isSingleDay = from === to;
  const periodLabel = isSingleDay
    ? fmtDate(from)
    : `${fmtDate(from)} a ${fmtDate(to)}`;

  // ── Header strip ──────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CINE DRIVE-IN", M, 10.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Relatório de Expediente", W - M, 10.5, { align: "right" });

  // ── Period ────────────────────────────────────────────────────────────────
  let y = 24;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Período: ${periodLabel}`, M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    W - M,
    y,
    { align: "right" },
  );

  if (pending) {
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(...ERROR);
    doc.text("* Inclui pedidos ainda não arquivados do dia atual.", M, y);
  }

  // ── Summary boxes ─────────────────────────────────────────────────────────
  y += 8;
  const boxW = (W - M * 2 - 8) / 3;

  const boxes = [
    { label: "Finalizados", value: String(totalFinished), color: SUCCESS },
    { label: "Cancelados", value: String(totalCanceled), color: ERROR },
    {
      label: "Total de pedidos",
      value: String(totalFinished + totalCanceled),
      color: PRIMARY,
    },
  ] as const;

  boxes.forEach((box, i) => {
    const x = M + i * (boxW + 4);
    doc.setFillColor(box.color[0], box.color[1], box.color[2], 0.08);
    doc.setFillColor(
      box.color[0] + Math.round((255 - box.color[0]) * 0.9),
      box.color[1] + Math.round((255 - box.color[1]) * 0.9),
      box.color[2] + Math.round((255 - box.color[2]) * 0.9),
    );
    doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
    doc.setDrawColor(box.color[0], box.color[1], box.color[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "S");

    doc.setTextColor(box.color[0], box.color[1], box.color[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(box.value, x + boxW / 2, y + 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(box.label, x + boxW / 2, y + 15.5, { align: "center" });
  });

  y += 25;

  // ── Revenue table ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...PRIMARY);
  doc.text("FATURAMENTO", M, y);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...PRIMARY);
  doc.line(M, y + 1.5, M + 40, y + 1.5);
  y += 5;

  const revRows: [string, string][] = [];
  if (rev.money > 0) revRows.push(["Dinheiro", fmt(rev.money)]);
  if (rev.pix > 0) revRows.push(["Pix", fmt(rev.pix)]);
  if (rev.credit > 0) revRows.push(["Crédito", fmt(rev.credit)]);
  if (rev.debit > 0) revRows.push(["Débito", fmt(rev.debit)]);

  if (rev.discount > 0) {
    revRows.push(["Descontos", `- ${fmt(rev.discount)}`]);
  }

  revRows.push(
    ["Subtotal", fmt(rev.subtotal)],
    ["Taxa de serviço", fmt(rev.serviceFee)],
  );

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Forma de recebimento", "Valor"]],
    body: revRows,
    foot: [["TOTAL", fmt(rev.total)]],
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: [...DARK],
    },
    headStyles: {
      fillColor: [...PRIMARY],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: [...PRIMARY],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: [...BG_ROW] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", fontStyle: "bold" },
    },
  });

  // ── Top items table ───────────────────────────────────────────────────────
  if (topItems.length > 0) {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY);
    doc.text("ITENS MAIS VENDIDOS", M, y);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...PRIMARY);
    doc.line(M, y + 1.5, M + 55, y + 1.5);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["#", "Código", "Item", "Qtd"]],
      body: topItems.slice(0, 20).map((item, i) => [
        String(i + 1),
        item.codItem || "—",
        item.name,
        String(item.quantity),
      ]),
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [...DARK],
      },
      headStyles: {
        fillColor: [...PRIMARY],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [...BG_ROW] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      },
    });
  }

  // ── Per-day breakdown (multi-day only) ────────────────────────────────────
  if (!isSingleDay && days.length > 1) {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;

    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY);
    doc.text("DETALHES POR DIA", M, y);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...PRIMARY);
    doc.line(M, y + 1.5, M + 48, y + 1.5);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Data", "Finalizados", "Cancelados", "Faturamento"]],
      body: days.map((d) => [
        fmtDate(d.date),
        String(d.finishedOrders),
        String(d.canceledOrders),
        fmt(d.revenue.total),
      ]),
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [...DARK],
      },
      headStyles: {
        fillColor: [...PRIMARY],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [...BG_ROW] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "right", fontStyle: "bold" },
      },
    });
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Página ${p} de ${totalPages}`,
      W / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
    doc.text(
      "Cine Drive-in — Relatório gerado automaticamente",
      M,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  const filename =
    isSingleDay
      ? `relatorio-${from}.pdf`
      : `relatorio-${from}-a-${to}.pdf`;

  doc.save(filename);
}
