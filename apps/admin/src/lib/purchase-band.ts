import { CircleCheck, OctagonMinus, TriangleAlert, type LucideIcon } from "lucide-react";
import { PURCHASE_BAND, enumCode, type EnumValue, type PurchaseBudgetDto } from "@workspace/api-client-react";
import { formatCurrency, monthNameOf, type PurchaseBand } from "@workspace/core";

/**
 * A faixa de compras na tela: cor, ícone e as frases — iguais no Painel
 * Financeiro, na listagem e no editor de Compras e no cartão do Dashboard.
 *
 * A FAIXA é regra de negócio: a do mês vem do backend, e a de uma compra
 * simulada sai de `purchaseBandFor` (`packages/core`). Aqui fica só a tradução
 * para a tela, como o `margin-tone.ts` faz com a margem. Uma cópia por tela é o
 * que faz uma delas dizer "verde com saldo" e a outra só "verde".
 *
 * Cores do vocabulário da base (`dominio/convencoes-de-interface.md`): verde é
 * dentro da meta, âmbar é atenção, vermelho é negativo — sempre com ícone e
 * palavra, porque cor sozinha não informa quem não distingue verde de âmbar.
 */

/** Como a faixa aparece: nome no meio da frase, ícone e as classes da cor. */
export interface PurchaseBandLook {
  /** Nome em minúsculas, para o meio da frase: "novembro está verde". */
  name: string;
  /** Nome com inicial maiúscula, para rótulo solto. */
  label: string;
  icon: LucideIcon;
  /** Cor do texto e do ícone. */
  textClass: string;
  /** Borda e fundo de painel (o estilo do `OpenPurchasesAlert`). */
  panelClass: string;
}

export const PURCHASE_BAND_LOOK: Record<PurchaseBand, PurchaseBandLook> = {
  green: {
    name: "verde",
    label: "Verde",
    icon: CircleCheck,
    textClass: "text-emerald-600 dark:text-emerald-400",
    panelClass: "border-emerald-500/40 bg-emerald-500/10",
  },
  yellow: {
    name: "amarelo",
    label: "Amarelo",
    icon: TriangleAlert,
    textClass: "text-amber-600 dark:text-amber-400",
    panelClass: "border-amber-500/40 bg-amber-500/10",
  },
  red: {
    name: "vermelho",
    label: "Vermelho",
    icon: OctagonMinus,
    textClass: "text-destructive",
    panelClass: "border-destructive/40 bg-destructive/10",
  },
};

/**
 * A faixa que veio da API (o nome do enum, `"Green"`, ou o código) no
 * vocabulário do core. `null` quando não veio — fechamento antigo, por exemplo.
 */
export function purchaseBandOf(value: EnumValue): PurchaseBand | null {
  switch (enumCode(value, PURCHASE_BAND)) {
    case PURCHASE_BAND.Green:
      return "green";
    case PURCHASE_BAND.Yellow:
      return "yellow";
    case PURCHASE_BAND.Red:
      return "red";
    default:
      return null;
  }
}

/**
 * "com saldo", "com aporte" ou "com saldo e aporte": quando a faixa só é aquela
 * por causa do dinheiro de fora das vendas (S + A), a tela diz.
 *
 * Existe porque verde com saldo esconde estoque crescendo (risco da seção 10
 * do plano): comprar acima do custo vendido e continuar verde é o saldo pagando.
 */
export function balanceSupport(
  budget: Pick<PurchaseBudgetDto, "reliesOnBalance" | "openingBalance" | "contributions">,
): string | null {
  if (!budget.reliesOnBalance) return null;
  const hasBalance = budget.openingBalance > 0;
  const hasContribution = budget.contributions > 0;
  if (hasBalance && hasContribution) return "com saldo e aporte";
  return hasContribution ? "com aporte" : "com saldo";
}

const HEADLINES: Record<PurchaseBand, string> = {
  green: "Compras dentro do custo do que foi vendido",
  yellow: "Compras acima do custo vendido; os custos fixos ainda estão cobertos",
  red: "Com estas compras, o mês não cobre os custos fixos",
};

/** A frase da faixa (seção 7.1), com o "com saldo" quando é o caso. */
export function purchaseBandHeadline(band: PurchaseBand, support: string | null): string {
  return support ? `${HEADLINES[band]}, ${support}` : HEADLINES[band];
}

/**
 * Quanto ainda dá para comprar, em partes ("R$ 439,00 no verde", "R$ 1.712,00
 * até o vermelho"), e o aporte que traz o mês de volta ao verde.
 *
 * "Até o vermelho" só aparece quando há amarelo pela frente. No começo do mês a
 * linha vermelha fica ABAIXO da verde (as vendas ainda não cobrem os fixos), e
 * como o verde é testado primeiro, passar do verde já é vermelho: dizer "R$ 300
 * no verde · R$ 100 até o vermelho" seria contraditório.
 */
export function purchaseRooms(
  band: PurchaseBand,
  greenRoom: number,
  redRoom: number,
): { parts: string[]; backToGreen: string | null } {
  const parts: string[] = [];
  if (greenRoom > 0) parts.push(`${formatCurrency(greenRoom)} no verde`);
  if (redRoom > 0 && redRoom > greenRoom) parts.push(`${formatCurrency(redRoom)} até o vermelho`);

  const backToGreen =
    band !== "green" && greenRoom < 0 ? `Volta ao verde com ${formatCurrency(-greenRoom)} de aporte` : null;

  return { parts, backToGreen };
}

/** O nome do mês em minúsculas, para o meio da frase ("feche outubro"). */
export function monthInSentence(monthKey: string | null | undefined): string {
  return monthNameOf(monthKey).toLowerCase();
}

/**
 * O aviso da faixa provisória: o mês anterior ainda não foi fechado no fluxo
 * novo, e o saldo dele está fora da conta (seção 2 do plano).
 */
export function provisionalNotice(budget: Pick<PurchaseBudgetDto, "month" | "pendingClosingMonth">): string {
  const pending = monthInSentence(budget.pendingClosingMonth);
  const month = monthInSentence(budget.month);
  return pending
    ? `Feche ${pending} para começar ${month} com o saldo`
    : `Feche o mês anterior para começar ${month} com o saldo`;
}

/**
 * "Se fizer as pendentes (R$ 600,00), o mês vai para amarelo" — a faixa que as
 * compras Pendentes com valor dariam. Pendente não conta em K: é "preciso
 * comprar isto", e aparece só como planejado. `null` sem pendente com valor.
 */
export function plannedNotice(
  budget: Pick<PurchaseBudgetDto, "purchasesPlanned" | "band" | "bandIfPlannedBought">,
): string | null {
  const after = purchaseBandOf(budget.bandIfPlannedBought);
  if (budget.purchasesPlanned <= 0 || after === null) return null;

  const verb = after === purchaseBandOf(budget.band) ? "continua" : "vai para";
  return `Se fizer as pendentes (${formatCurrency(budget.purchasesPlanned)}), o mês ${verb} ${PURCHASE_BAND_LOOK[after].name}`;
}
