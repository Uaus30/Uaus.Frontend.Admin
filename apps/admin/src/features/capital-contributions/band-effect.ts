import { monthNameOf } from "@workspace/core";
import { PURCHASE_BAND_LOOK, purchaseBandOf } from "@/lib/purchase-band";
import type { PurchaseBudgetDto } from "./types";

/**
 * O efeito de um aporte na faixa de compras, para o toast:
 * "Novembro passou de amarelo para verde." ou "Novembro continua verde.".
 *
 * O aporte entra como saldo disponível e sobe as duas linhas da faixa (decisão
 * 8): é o que tira o mês do vermelho. Dizer o efeito na hora é o que faz o
 * aporte deixar de ser só um lançamento e virar decisão — "quanto falta para
 * voltar ao verde?".
 *
 * @returns `null` quando uma das duas faixas não pôde ser lida (rede, mês sem
 * resposta) — aí o toast fica só com o título, em vez de inventar um efeito.
 */
export function contributionBandEffect(
  monthKey: string,
  before: Pick<PurchaseBudgetDto, "band"> | null,
  after: Pick<PurchaseBudgetDto, "band"> | null,
): string | null {
  const from = before ? purchaseBandOf(before.band) : null;
  const to = after ? purchaseBandOf(after.band) : null;
  const month = monthNameOf(monthKey);
  if (from === null || to === null || !month) return null;

  return from === to
    ? `${month} continua ${PURCHASE_BAND_LOOK[to].name}.`
    : `${month} passou de ${PURCHASE_BAND_LOOK[from].name} para ${PURCHASE_BAND_LOOK[to].name}.`;
}
