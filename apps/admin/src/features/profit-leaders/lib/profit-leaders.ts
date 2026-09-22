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

/**
 * O ícone de quando o mapa não conhece o valor, e os acessos guardados aos
 * rótulos.
 *
 * <b>Um membro novo no enum do backend não pode derrubar a rota.</b> Buscar o
 * ícone direto no mapa devolve `undefined`, e `<Icon />` com `undefined` estoura
 * em tempo de render: o `ErrorBoundary` da rota troca a TELA INTEIRA pela tela de
 * recuperação — não é uma linha quebrada, é a tela sumindo. A tela irmã já
 * carrega a mesma guarda (ver `ComparisonHeadline`), e o dia em que alguém
 * acrescentar um arquétipo no C# não pode ser o dia em que esta tela apaga.
 */
export const FALLBACK_ICON: LucideIcon = Minus;

export const archetypeLabel = (nome: ProfitArchetypeName): string =>
  ARCHETYPE_LABELS[nome] ?? "Sem classificação";

export const archetypeAction = (nome: ProfitArchetypeName): string => ARCHETYPE_ACTION[nome] ?? "";

export const alertLabel = (nome: ProfitAlertName): string => ALERT_LABELS[nome] ?? "Ponto de atenção";

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
export function isEscalated(leader: ProfitLeaderDto): boolean {
  return (
    leader.alert === "ParkedStock" &&
    (leader.trendPercentage ?? 0) <= HEAVY_DROP &&
    leader.stockCost >= HEAVY_PARKED_COST
  );
}

export function leaderTone(leader: ProfitLeaderDto): BiTone {
  if (leader.alert === "ParkedStock") return isEscalated(leader) ? "ruim" : "atencao";
  if (leader.alert !== "None") return "atencao";

  // Positivo por lista, e não por exclusão: um arquétipo que o front ainda não
  // conhece cairia em "bom" e nasceria pintado de verde, ainda que o backend o
  // tenha criado justamente para sinalizar algo ruim.
  if (leader.archetype === "Newcomer" || leader.archetype === "Rising" || leader.archetype === "Workhorse")
    return "bom";

  return "neutro";
}

/**
 * O texto da pílula de alerta, com a escalada <b>escrita</b>.
 *
 * Sem a palavra, a diferença entre âmbar e vermelho é só o matiz: as duas linhas
 * trazem as mesmas pílulas, os mesmos ícones e a mesma frase. Impressa em preto e
 * branco — e esta é uma tela que se imprime para levar ao balcão — ou lida por
 * quem não distingue os dois, a escalada simplesmente não existiria. É a regra
 * "cor nunca sozinha" de `bi-tone.ts`, e aqui ela vale para o segundo passo da
 * escala, não só para o primeiro.
 */
export function alertBadgeLabel(leader: ProfitLeaderDto): string {
  const base = alertLabel(leader.alert);
  return isEscalated(leader) ? `${base} · urgente` : base;
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

  if (leader.archetype === "Rising") {
    // `trendPercentage` AUSENTE não é 0%: a API omite o campo quando não havia
    // ritmo anterior, ou seja, quando o produto saiu do zero. Tratá-lo como zero
    // rebaixava justamente o maior salto possível — um item que foi de R$ 0 a
    // R$ 310 em três semanas saltava MENOS que um que só dobrou.
    if (leader.trendPercentage == null) return "forte";
    return leader.trendPercentage >= 100 ? "forte" : "medio";
  }

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
      return `O ritmo subiu: de ${antes} para ${agora} ${janelaRecente(leader.recentDays)}.`;

    case "Workhorse":
      return `Vendeu em ${leader.weeksWithSales} das ${leader.periodWeeks} semanas do período.`;

    case "Declining":
      return `O ritmo caiu: de ${antes} para ${agora} ${janelaRecente(leader.recentDays)}.`;

    default:
      // Sem janela recente não há tendência a relatar, e a frase genérica anunciava
      // "— nos últimos 0 dias": um período de um dia (o dia 1º em "Mês atual") não
      // sobra base de comparação nenhuma.
      return leader.recentDays > 0
        ? `Sem tendência clara: ${antes} antes, ${agora} ${janelaRecente(leader.recentDays)}.`
        : "Período curto demais para comparar ritmo.";
  }
}

/** "nos últimos N dias", com o singular resolvido. */
function janelaRecente(dias: number): string {
  return dias === 1 ? "no último dia" : `nos últimos ${dias} dias`;
}

/** "N dias" do período, com o singular resolvido. */
export function describeDays(dias: number): string {
  return dias === 1 ? "1 dia" : `${dias} dias`;
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
