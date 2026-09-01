import {
  divider,
  escapeHtml,
  formatReceiptCurrency,
  formatReceiptDate,
  formatReceiptDateTime,
  formatReceiptTime,
  resolveStore,
  row,
  sectionTitle,
  storeHeader,
  wrapPrintDocument,
} from "./document";
import { printReceiptHtml } from "./print";
import type { ReceiptStore, StoreInfo } from "./types";

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
  /** Recebido em espécie. Só a conferência da gaveta usa. */
  cashAmount?: number;
  /** Recebido nas demais formas. Só a conferência da gaveta usa. */
  nonCashAmount?: number;
  /** Fundo de troco + recebido em espécie: o que deve haver na gaveta. */
  expectedCashAmount?: number;
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

/** Tudo que o relatório de vendas precisa. */
export interface SalesReportData {
  /**
   * Sessão de caixa consolidada.
   *
   * Ausente no relatório do DIA, que é o da loja sem controle de caixa: ali não
   * existe turno, e sem turno não há abertura, fundo de troco nem gaveta a
   * conferir — o relatório sai só com o consolidado e a relação das vendas.
   */
  sessionId?: number | null;
  operatorName?: string | null;
  /** Abertura do turno. Ausente no relatório do dia. */
  openedAt?: string | Date | null;
  closedAt?: string | Date | null;
  /** Momento da impressão; o relatório é sempre um retrato de um instante. */
  printedAt: string | Date;
  /** Fundo de troco informado na abertura. Ausente no relatório do dia. */
  openingBalance?: number | null;
  summary: SalesReportSummary;
  /** Vendas do período, das mais recentes para as mais antigas. */
  sales: SalesReportSale[];
  /** Identidade da loja: a do cadastro (`resolveStoreInfo`) ou sobrescrita avulsa. */
  store?: Partial<ReceiptStore> | StoreInfo;
}

/**
 * Monta o relatório de vendas em bobina de 80mm.
 *
 * Traz o consolidado (o mesmo que o backend usa no fechamento do caixa) e a
 * relação das vendas. Vendas canceladas aparecem riscadas e ficam de fora dos
 * totais, para o relatório bater com a conferência da gaveta.
 *
 * Sem `sessionId` o documento vira o relatório do DIA: sai o cabeçalho do turno
 * e sai a conferência da gaveta, que só existe onde houve fundo de troco.
 *
 * @param data Sessão (ou dia), resumo consolidado e vendas.
 * @returns Documento HTML completo do relatório.
 */
export function buildSalesReportHtml(data: SalesReportData): string {
  const store = resolveStore(data.store);
  const { summary } = data;
  /** Relatório de turno; sem sessão o documento é o do dia. */
  const daSessao = data.sessionId != null;
  const periodo = daSessao ? "sessão" : "dia";

  const paymentRows = summary.byPaymentMethod.length
    ? summary.byPaymentMethod
        .map((method) =>
          row(
            `${escapeHtml(method.paymentMethodName)} (${method.count})`,
            formatReceiptCurrency(method.amount),
          ),
        )
        .join("")
    : `<div class="row small"><span class="row-label">Nenhum recebimento ${periodo === "dia" ? "no dia" : "na sessão"}.</span></div>`;

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
    : `<div class="row small"><span class="row-label">Nenhuma venda registrada ${periodo === "dia" ? "no dia" : "na sessão"}.</span></div>`;

  const closedLine = data.closedAt
    ? row("Fechado em", formatReceiptDateTime(data.closedAt), "small")
    : row("Situação", "Caixa aberto", "small");

  const operatorLine = data.operatorName?.trim()
    ? row("Operador", escapeHtml(data.operatorName.trim()), "small")
    : "";

  /**
   * Identificação do período.
   *
   * No turno é o número do caixa e a abertura; no dia é a data da impressão,
   * que é o próprio recorte da lista — o servidor devolve as vendas de hoje.
   */
  const periodLines = daSessao
    ? `${row("Caixa", `#${data.sessionId}`, "small")}
  ${operatorLine}
  ${row("Aberto em", formatReceiptDateTime(data.openedAt ?? data.printedAt), "small")}
  ${closedLine}`
    : `${row("Dia", formatReceiptDate(data.printedAt), "small")}
  ${operatorLine}`;

  /**
   * Conferência da gaveta: só no relatório de turno.
   *
   * Sem sessão não há fundo de troco nem gaveta a fechar, e imprimir a seção
   * zerada faria o operador conferir dinheiro contra um esperado que ninguém
   * calculou.
   */
  const drawerSection = daSessao
    ? `${divider}
  ${sectionTitle("CONFERÊNCIA DA GAVETA")}
  ${row("Fundo de troco", formatReceiptCurrency(data.openingBalance ?? 0))}
  ${row("Recebido em dinheiro", formatReceiptCurrency(summary.cashAmount ?? 0))}
  ${row("Outras formas", formatReceiptCurrency(summary.nonCashAmount ?? 0))}
  ${row("ESPERADO EM CAIXA", formatReceiptCurrency(summary.expectedCashAmount ?? 0), "strong")}
`
    : "";

  return wrapPrintDocument(
    daSessao ? `Relatório de vendas — caixa ${data.sessionId}` : "Relatório de vendas do dia",
    `  ${storeHeader(store)}

  ${divider}
  ${sectionTitle(daSessao ? "RELATÓRIO DE VENDAS" : "RELATÓRIO DE VENDAS DO DIA")}
  ${periodLines}

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

  ${drawerSection}
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
