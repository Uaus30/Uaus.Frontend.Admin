import { formatStoreDay } from "./sale-when";

/** O que a venda precisa saber de um fechamento financeiro: o período. */
export type ClosedPeriod = { id: number; periodStart: string; periodEnd: string };

/**
 * O fechamento financeiro que cobre o dia (`yyyy-MM-dd`), ou nulo.
 *
 * Compara as STRINGS da data, como o resto da venda (`sale-when.ts`): a data da
 * API vem sem fuso, e passar por `new Date()` a leria no fuso do aparelho
 * (armadilha 8 do `CLAUDE.md` do front). O fim do período é inclusivo.
 */
export function findClosing(closings: ClosedPeriod[], date: string): ClosedPeriod | null {
  if (!date) return null;
  return (
    closings.find(
      (closing) => closing.periodStart.slice(0, 10) <= date && date <= closing.periodEnd.slice(0, 10),
    ) ?? null
  );
}

const brDate = formatStoreDay;

/**
 * O aviso do fechamento que a data deixa desatualizado (decisão do dono,
 * 06/10/2026, opção b: permitir e avisar). Até então a venda nesse período era
 * recusada.
 */
export function closedPeriodNotice(closing: ClosedPeriod): string {
  return (
    `Esta data mexe no período do fechamento financeiro de ${brDate(closing.periodStart)} a ` +
    `${brDate(closing.periodEnd)}: os relatórios se ajustam, mas o fechamento fica desatualizado — ` +
    `refaça-o em Financeiro › Fechamentos Mensais.`
  );
}

/**
 * O aviso do CANCELAMENTO de venda de período fechado: cancelada, ela sai da
 * receita, e o fechamento fica desatualizado (decisão do dono, 06/10/2026). A
 * troca de forma de pagamento não avisa — o fechamento não usa forma nem taxa.
 */
export function cancelClosedPeriodNotice(closing: ClosedPeriod): string {
  return (
    `Esta venda é do período do fechamento financeiro de ${brDate(closing.periodStart)} a ` +
    `${brDate(closing.periodEnd)}: cancelada, ela sai dos relatórios, mas o fechamento fica desatualizado — ` +
    `refaça-o em Financeiro › Fechamentos Mensais.`
  );
}

/** A frase do toast depois de gravar, quando a data mexeu num período fechado. */
export function closedPeriodToast(closing: ClosedPeriod): string {
  return `O fechamento financeiro de ${brDate(closing.periodStart)} a ${brDate(closing.periodEnd)} ficou desatualizado — refaça-o.`;
}
