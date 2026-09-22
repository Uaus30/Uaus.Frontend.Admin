import { Flame, Gem, Rocket, ShieldCheck, TrendingDown, Minus, PackageX, Timer, Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import {
  PROFIT_LEADERS_PERIOD,
  type ProfitAlertName,
  type ProfitArchetypeName,
  type ProfitLeaderDto,
  type ProfitLeadersPeriod,
} from "@workspace/api-client-react";
import type { BiTone } from "@/lib/bi-tone";

/** Os períodos do seletor, na ordem em que a tela os oferece. */
export const PERIOD_OPTIONS: { value: ProfitLeadersPeriod; label: string }[] = [
  { value: PROFIT_LEADERS_PERIOD.Last30Days, label: "Últimos 30 dias" },
  { value: PROFIT_LEADERS_PERIOD.Last90Days, label: "Últimos 90 dias" },
  { value: PROFIT_LEADERS_PERIOD.CurrentMonth, label: "Mês atual" },
  { value: PROFIT_LEADERS_PERIOD.PreviousMonth, label: "Mês anterior" },
  { value: PROFIT_LEADERS_PERIOD.AllTime, label: "Desde a inauguração" },
  { value: PROFIT_LEADERS_PERIOD.Custom, label: "Personalizado" },
];

export const ARCHETYPE_LABELS: Record<ProfitArchetypeName, string> = {
  Newcomer: "Estreante",
  Rising: "Em ascensão",
  Workhorse: "Cavalo de batalha",
  Steady: "Estável",
  Declining: "Perdendo ritmo",
};

/**
 * O que cada arquétipo pede.
 *
 * O rótulo diz o que o produto É; sem esta segunda linha, quem lê traduz sozinho
 * — e a tradução que costuma sair para "perdendo ritmo" é "cortar", que é a
 * decisão errada num produto que está entre os que fazem metade do lucro.
 */
export const ARCHETYPE_ACTION: Record<ProfitArchetypeName, string> = {
  Newcomer: "achado novo — vale testar mais exposição e procurar parecidos",
  Rising: "está acelerando — garanta que não falte e dê mais espaço",
  Workhorse: "sustenta o período — não pode faltar",
  Steady: "firme, sem novidade — mantenha o que já funciona",
  Declining: "desacelerou — entenda o porquê antes de repor",
};

export const ARCHETYPE_ICONS: Record<ProfitArchetypeName, LucideIcon> = {
  Newcomer: Gem,
  Rising: Rocket,
  Workhorse: ShieldCheck,
  Steady: Minus,
  Declining: TrendingDown,
};

export const ALERT_LABELS: Record<ProfitAlertName, string> = {
  None: "",
  ParkedStock: "Estoque parado",
  StockOut: "Sem estoque",
  LowCoverage: "Estoque curto",
};

export const ALERT_ICONS: Record<ProfitAlertName, LucideIcon> = {
  None: Minus,
  ParkedStock: Boxes,
  StockOut: PackageX,
  LowCoverage: Timer,
};

/** Queda de ritmo, em pontos percentuais, a partir da qual o alerta escala. */
export const HEAVY_DROP = -50;

/** Custo parado, em reais, a partir do qual o alerta escala. */
export const HEAVY_PARKED_COST = 300;

/**
 * O tom da linha.
 *
 * <b>Aqui não existe produto ruim</b> — todo item chegou ao corte. Por isso o
 * padrão dos pontos de atenção é âmbar, e o vermelho é reservado para quando
 * <b>queda forte e dinheiro parado se somam</b>: se tudo que preocupa for
 * vermelho, nada é. O texto da pílula sempre diz o que é, porque cor sozinha não
 * informa quem não a distingue nem sobrevive à impressão em preto e branco.
 */
export function leaderTone(leader: ProfitLeaderDto): BiTone {
  if (leader.alert === "ParkedStock") {
    const quedaForte = (leader.trendPercentage ?? 0) <= HEAVY_DROP;
    const dinheiroParado = leader.stockCost >= HEAVY_PARKED_COST;
    return quedaForte && dinheiroParado ? "ruim" : "atencao";
  }

  if (leader.alert !== "None") return "atencao";

  if (leader.archetype === "Steady") return "neutro";
  return "bom";
}

/**
 * Quanto a linha deve saltar aos olhos entre as positivas.
 *
 * O dono pediu "mais verde quanto melhor for o produto". A intensidade segue a
 * <b>força do sinal de ascensão</b>, e não a qualidade geral: esta última já
 * está codificada na POSIÇÃO do ranking, e pintar a mesma informação duas vezes
 * gasta o contraste que faz os extremos saltarem.
 */
export function highlightLevel(leader: ProfitLeaderDto): "forte" | "medio" | null {
  if (leaderTone(leader) !== "bom") return null;

  if (leader.archetype === "Newcomer") return "forte";
  if (leader.archetype === "Rising") return (leader.trendPercentage ?? 0) >= 100 ? "forte" : "medio";
  if (leader.archetype === "Workhorse") return "medio";

  return null;
}

/** A medalha do pódio. Só as três primeiras posições têm. */
export const MEDALS = ["Ouro", "Prata", "Bronze"] as const;

/**
 * <b>O motivo da posição</b>: a multiplicação que produziu o lucro da linha.
 *
 * É o pedido central do dono — "R$ 237,33" pode ser 293 peças a R$ 0,81 ou 14 a
 * R$ 10,75, e os dois pedem ações opostas. O número agregado esconde justamente
 * o que decide.
 */
export function readPosition(leader: ProfitLeaderDto): string {
  return `${formatCurrency(leader.profit)} = ${leader.units} ${
    leader.units === 1 ? "peça" : "peças"
  } × ${formatCurrency(leader.profitPerUnit)} de lucro cada`;
}

/** Como o produto se compara à régua de lucro por peça do próprio corte. */
export function readPerUnit(leader: ProfitLeaderDto, mediana: number): string | null {
  if (mediana <= 0) return null;

  if (leader.profitPerUnit >= mediana * 2) {
    return "Lucra bem em cada peça — vale procurar variações e dar mais visibilidade.";
  }

  if (leader.profitPerUnit <= mediana / 2) {
    return "Lucra pouco em cada peça e compensa no giro — o que importa aqui é não faltar.";
  }

  return null;
}

/** Ritmo diário de uma das duas janelas, já formatado. */
function ritmo(profit: number, days: number): string {
  return days > 0 ? `${formatCurrency(profit / days)}/dia` : "—";
}

/**
 * A frase do arquétipo, montada com os números medidos.
 *
 * Sem ela a pílula é um rótulo que quem lê tem de aceitar no escuro: "perdendo
 * ritmo" não diz de quanto para quanto, e é a magnitude que decide se vale
 * investigar ou esperar.
 */
export function readArchetype(leader: ProfitLeaderDto): string {
  const antes = ritmo(leader.earlierProfit, leader.earlierDays);
  const agora = ritmo(leader.recentProfit, leader.recentDays);

  switch (leader.archetype) {
    case "Newcomer":
      return leader.firstSaleDate
        ? `Primeira venda em ${formatDay(leader.firstSaleDate)} — já entrou no corte estreando.`
        : "Entrou no corte estreando neste período.";

    case "Rising":
      return `O ritmo subiu: de ${antes} para ${agora} nos últimos ${leader.recentDays} dias.`;

    case "Workhorse":
      return `Vendeu em ${leader.weeksWithSales} das ${leader.periodWeeks} semanas do período.`;

    case "Declining":
      return `O ritmo caiu: de ${antes} para ${agora} nos últimos ${leader.recentDays} dias.`;

    default:
      return `Sem tendência clara: ${antes} antes, ${agora} nos últimos ${leader.recentDays} dias.`;
  }
}

/**
 * O que olhar nesta linha — nunca "corte este produto".
 *
 * Os dois lados da queda pedem perguntas opostas, e trocá-los manda comprar
 * justamente o que está encalhado.
 */
export function readAlert(leader: ProfitLeaderDto): string | null {
  switch (leader.alert) {
    case "ParkedStock":
      return `Ainda há ${leader.stock} ${leader.stock === 1 ? "peça" : "peças"} em casa, ${formatCurrency(
        leader.stockCost,
      )} de custo. Divulgar, entender o motivo ou aceitar a sazonalidade.`;

    case "StockOut":
      return "Caiu sem saldo em casa: pode não ter sido a procura, e sim faltar o que vender.";

    case "LowCoverage":
      return leader.stock === 0
        ? "Está vendendo e não há saldo em casa."
        : `Restam ${leader.stock} ${leader.stock === 1 ? "peça" : "peças"}${
            leader.coverageDays != null ? `, ${Math.round(leader.coverageDays)} dias no ritmo do período` : ""
          }.`;

    default:
      return null;
  }
}

/** Data curta a partir do que a API devolve, sem passar por fuso. */
export function formatDay(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

/** "23/08/26 a 21/09/26" — o intervalo que a resposta diz ter medido. */
export function describePeriod(startDate: string, endDate: string): string {
  return `${formatDay(startDate)} a ${formatDay(endDate)}`;
}

/** Ícone de destaque para a manchete, quando há muito dinheiro parado. */
export const ATTENTION_ICON: LucideIcon = Flame;
