import {
  divider,
  escapeHtml,
  formatReceiptCurrency,
  formatReceiptDateTime,
  formatReceiptTime,
  resolveStore,
  row,
  sectionTitle,
  storeHeader,
  wrapPrintDocument,
} from "./document";
import { printReceiptHtml } from "./print";
import type { ReceiptStore } from "./types";

/** Total recebido em uma forma de pagamento dentro da sessão. */
export interface SalesReportPaymentTotal {
  paymentMethodName: string;
  /** Quantidade de recebimentos nesta forma. */
  count: number;
  amount: number;
}

/** Consolidado da sessão, como o backend devolve no resumo do caixa. */
export interface SalesReportSummary {
  salesCount: number;
  cancelledSalesCount: number;
  /** Faturamento das vendas não canceladas. */
  revenue: number;
  discounts: number;
  /** Unidades vendidas, somando todos os itens. */
  itemsCount: number;
  cashAmount: number;
  nonCashAmount: number;
  /** Fundo de troco + recebido em espécie: o que deve haver na gaveta. */
  expectedCashAmount: number;
  byPaymentMethod: SalesReportPaymentTotal[];
}

/** Uma linha da relação de vendas do relatório. */
export interface SalesReportSale {
  id: number;
  createdAt: string | Date;
  total: number;
  cancelled?: boolean;
  /** Formas de pagamento da venda, já resolvidas em nomes. */
  paymentNames?: string[];
}

/** Tudo que o relatório de vendas da sessão precisa. */
export interface SalesReportData {
  sessionId: number;
  operatorName?: string | null;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  /** Momento da impressão; o relatório é sempre um retrato de um instante. */
  printedAt: string | Date;
  /** Fundo de troco informado na abertura. */
  openingBalance: number;
  summary: SalesReportSummary;
  /** Vendas da sessão, das mais recentes para as mais antigas. */
  sales: SalesReportSale[];
  store?: Partial<ReceiptStore>;
}

/**
 * Monta o relatório de vendas da sessão de caixa em bobina de 80mm.
 *
 * Traz o consolidado do caixa (o mesmo que o backend usa no fechamento) e a
 * relação das vendas. Vendas canceladas aparecem riscadas e ficam de fora dos
 * totais, para o relatório bater com a conferência da gaveta.
 *
 * @param data Sessão, resumo consolidado e vendas.
 * @returns Documento HTML completo do relatório.
 */
export function buildSalesReportHtml(data: SalesReportData): string {
  const store = resolveStore(data.store);
  const { summary } = data;

  const paymentRows = summary.byPaymentMethod.length
    ? summary.byPaymentMethod
        .map((method) =>
          row(
            `${escapeHtml(method.paymentMethodName)} (${method.count})`,
            formatReceiptCurrency(method.amount),
          ),
        )
        .join("")
    : `<div class="row small"><span class="row-label">Nenhum recebimento na sessão.</span></div>`;

  const saleRows = data.sales.length
    ? data.sales
        .map((sale) => {
          const methods = sale.paymentNames?.filter(Boolean).join(" + ");
          const label = `#${sale.id} · ${formatReceiptTime(sale.createdAt)}`;
          const total = formatReceiptCurrency(sale.total);
          return `
        <div class="item">
          ${row(label, sale.cancelled ? `<span class="struck">${total}</span>` : total, "item-head")}
          <div class="item-breakdown">${sale.cancelled ? "CANCELADA" : escapeHtml(methods || "—")}</div>
        </div>`;
        })
        .join("")
    : `<div class="row small"><span class="row-label">Nenhuma venda registrada na sessão.</span></div>`;

  const closedLine = data.closedAt
    ? row("Fechado em", formatReceiptDateTime(data.closedAt), "small")
    : row("Situação", "Caixa aberto", "small");

  const operatorLine = data.operatorName?.trim()
    ? row("Operador", escapeHtml(data.operatorName.trim()), "small")
    : "";

  return wrapPrintDocument(
    `Relatório de vendas — caixa ${data.sessionId}`,
    `  ${storeHeader(store)}

  ${divider}
  ${sectionTitle("RELATÓRIO DE VENDAS")}
  ${row("Caixa", `#${data.sessionId}`, "small")}
  ${operatorLine}
  ${row("Aberto em", formatReceiptDateTime(data.openedAt), "small")}
  ${closedLine}

  ${divider}
  ${sectionTitle("RESUMO")}
  ${row("Vendas", String(summary.salesCount))}
  ${row("Canceladas", String(summary.cancelledSalesCount))}
  ${row("Itens vendidos", String(summary.itemsCount))}
  ${row("Descontos", `- ${formatReceiptCurrency(summary.discounts)}`)}
  ${row("FATURAMENTO", formatReceiptCurrency(summary.revenue), "total")}

  ${divider}
  ${sectionTitle("RECEBIMENTOS")}
  ${paymentRows}

  ${divider}
  ${sectionTitle("CONFERÊNCIA DA GAVETA")}
  ${row("Fundo de troco", formatReceiptCurrency(data.openingBalance))}
  ${row("Recebido em dinheiro", formatReceiptCurrency(summary.cashAmount))}
  ${row("Outras formas", formatReceiptCurrency(summary.nonCashAmount))}
  ${row("ESPERADO EM CAIXA", formatReceiptCurrency(summary.expectedCashAmount), "strong")}

  ${divider}
  ${sectionTitle("VENDAS")}
  ${saleRows}

  ${divider}
  <div class="meta-line"><span>Emitido em</span><span>${formatReceiptDateTime(data.printedAt)}</span></div>
  <div class="fine-print">Documento sem valor fiscal</div>`,
  );
}

/**
 * Monta e imprime o relatório de vendas da sessão.
 *
 * @param data Sessão, resumo consolidado e vendas.
 * @returns Promise resolvida quando a impressão termina (ou é cancelada).
 */
export function printSalesReport(data: SalesReportData): Promise<void> {
  return printReceiptHtml(buildSalesReportHtml(data));
}
