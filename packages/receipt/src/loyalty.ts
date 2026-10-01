import {
  divider,
  escapeHtml,
  formatReceiptDate,
  formatReceiptDateTime,
  resolveStore,
  row,
  sectionTitle,
  storeHeader,
  wrapPrintDocument,
} from "./document";
import { printReceiptHtml } from "./print";
import type { ReceiptStore, StoreInfo } from "./types";

/**
 * O saldo do cartão fidelidade no comprovante da venda (01/10/2026), quando o
 * cliente pedir. A via oficial é a digital; o papel é o lembrete.
 */
export interface ReceiptLoyalty {
  /** A compra ganhou carimbo. */
  stamped: boolean;
  /** Por que não ganhou ("mínimo de R$ 10,00"). */
  reason?: string | null;
  stamps: number;
  stampsRequired: number;
  /** Quantos faltam para o próximo prêmio; zero quando acabou de chegar nele. */
  toNextReward: number;
  /** O próximo prêmio, como o cliente lê: "R$ 5,00" ou "10%". */
  nextRewardLabel: string;
  expiresAt?: string | null;
  /** A compra completou o cartão: o cliente sai com um novo. */
  cardCompleted?: boolean;
}

/** O bloco "CARTÃO FIDELIDADE" do comprovante, depois do consumidor. */
export function loyaltyReceiptBlock(loyalty: ReceiptLoyalty): string {
  const lines = [
    loyalty.stamped
      ? "Esta compra ganhou 1 carimbo."
      : `Esta compra não ganhou carimbo${loyalty.reason ? ` (${loyalty.reason.replace(/\.$/, "")})` : ""}.`,
    loyalty.cardCompleted ? "Cartão completo! O novo já começou." : "",
    `Saldo: ${loyalty.stamps} de ${loyalty.stampsRequired} carimbos.`,
    loyalty.toNextReward > 0
      ? `Faltam ${loyalty.toNextReward} para o próximo prêmio de ${loyalty.nextRewardLabel}.`
      : `Prêmio de ${loyalty.nextRewardLabel} liberado para a próxima compra.`,
    loyalty.expiresAt ? `Válido até ${formatReceiptDate(loyalty.expiresAt)}.` : "",
  ].filter(Boolean);

  return `${divider}
  ${sectionTitle("CARTÃO FIDELIDADE")}
  ${lines.map((line) => `<div class="notes">${escapeHtml(line)}</div>`).join("")}`;
}

/** Um carimbo do extrato impresso. */
export interface StatementStampLine {
  /** Até que carimbo do cartão a linha chega: o número do papel. */
  position: number;
  occurredAt: string;
  /** O carimbo extra com que o cartão nasceu. */
  bonus?: boolean;
}

/** A segunda via do cartão, para a impressora do caixa. */
export interface LoyaltyStatementReceipt {
  customerName: string;
  stamps: StatementStampLine[];
  stampsRequired: number;
  expiresAt?: string | null;
  /** Já escritas: "1º prêmio (R$ 5,00): trocado em 21/12/2026". */
  rewardLines: string[];
  printedAt: string | Date;
  store?: Partial<ReceiptStore> | StoreInfo;
}

/**
 * O extrato do cartão fidelidade: cada carimbo com a data. É o que resolve o
 * cartão de papel perdido ou esquecido — o operador carimba um novo com a mesma
 * quantidade, conferindo por aqui.
 */
export function buildLoyaltyStatementHtml(data: LoyaltyStatementReceipt): string {
  const store = resolveStore(data.store);
  const total = data.stamps.at(-1)?.position ?? 0;

  const stampRows = data.stamps.length
    ? data.stamps
        .map((stamp) =>
          row(`${stamp.position}º${stamp.bonus ? " (extra)" : ""}`, formatReceiptDate(stamp.occurredAt)),
        )
        .join("")
    : `<div class="notes">Nenhum carimbo neste cartão.</div>`;

  return wrapPrintDocument(
    `Extrato ${data.customerName}`,
    `  ${storeHeader(store)}

  ${divider}
  ${sectionTitle("EXTRATO · CARTÃO FIDELIDADE")}
  <div class="consumer">${escapeHtml(data.customerName)}</div>
  ${data.expiresAt ? `<div class="notes">Válido até ${formatReceiptDate(data.expiresAt)}</div>` : ""}

  ${divider}
  ${stampRows}
  ${divider}
  ${row(`${total} de ${data.stampsRequired} carimbos`, "", "strong")}
  ${data.rewardLines.map((line) => `<div class="notes">${escapeHtml(line)}</div>`).join("")}

  ${divider}
  <div class="notes">A via oficial é a digital.</div>
  <div class="meta-line"><span>Emitido em</span><span>${formatReceiptDateTime(data.printedAt)}</span></div>
  <div class="fine-print">Documento sem valor fiscal</div>`,
  );
}

/** Imprime o extrato do cartão na impressora do caixa. */
export function printLoyaltyStatement(data: LoyaltyStatementReceipt): Promise<void> {
  return printReceiptHtml(buildLoyaltyStatementHtml(data));
}
