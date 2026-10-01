import { CalendarHeart, Clock, Gift, Hourglass, Target, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  LOYALTY_REWARD_STATUS,
  enumCode,
  type LoyaltyActionCountsDto,
  type LoyaltyActionList,
  type LoyaltyActionRowDto,
  type LoyaltyRewardStatusFilter,
} from "@workspace/api-client-react";
import { formatShortDate } from "@workspace/core";

export type LoyaltyActionDefinition = {
  list: LoyaltyActionList;
  label: string;
  /** O que a data da linha significa nesta lista. */
  dateLabel: string;
  icon: LucideIcon;
  count: (counts: LoyaltyActionCountsDto) => number;
};

/** As listas do "Para agir", na ordem do plano. */
export const LOYALTY_ACTIONS: LoyaltyActionDefinition[] = [
  {
    list: "rewards-waiting",
    label: "Prêmios esperando troca",
    dateLabel: "Vence em",
    icon: Gift,
    count: (c) => c.rewardsWaiting,
  },
  {
    list: "one-away",
    label: "A 1 carimbo de um prêmio",
    dateLabel: "Cartão vence",
    icon: Target,
    count: (c) => c.oneStampAway,
  },
  {
    list: "expiring",
    label: "Cartões que vencem em 30 dias",
    dateLabel: "Vence em",
    icon: Clock,
    count: (c) => c.expiringSoon,
  },
  {
    list: "grace",
    label: "Em folga: cartão vencido, prêmio ainda vale",
    dateLabel: "Vence em",
    icon: Hourglass,
    count: (c) => c.inGrace,
  },
  {
    list: "inactive",
    label: "Sem comprar há 45 dias ou mais",
    dateLabel: "Última compra",
    icon: UserX,
    count: (c) => c.inactive,
  },
  {
    list: "birthdays",
    label: "Aniversariantes do mês",
    dateLabel: "Aniversário",
    icon: CalendarHeart,
    count: (c) => c.birthdays,
  },
];

/** As listas que mostram prêmios (uma linha por prêmio), e não clientes. */
export function isRewardList(list: LoyaltyActionList | null): boolean {
  return list === "rewards-waiting" || list === "grace";
}

/** O filtro da lista de prêmios: o padrão é o que o número do card conta. */
export const REWARD_STATUS_FILTERS: { value: LoyaltyRewardStatusFilter; label: string }[] = [
  { value: "available", label: "Disponíveis" },
  { value: "redeemed", label: "Trocados" },
  { value: "expired", label: "Vencidos" },
  { value: "cancelled", label: "Cancelados" },
  { value: "all", label: "Todos" },
];

/**
 * A situação do prêmio na linha: "Disponível", "Trocado em 21/12/2026",
 * "Vencido" ou "Cancelado". O vencido é o disponível que passou do prazo — o
 * servidor avisa em `expired`, porque a situação gravada continua disponível.
 */
export function rewardSituation(row: LoyaltyActionRowDto): string {
  if (row.expired) return "Vencido";
  switch (enumCode(row.rewardStatus, LOYALTY_REWARD_STATUS)) {
    case LOYALTY_REWARD_STATUS.Redeemed:
      return row.redeemedAt ? `Trocado em ${formatShortDate(row.redeemedAt)}` : "Trocado";
    case LOYALTY_REWARD_STATUS.Cancelled:
      return "Cancelado";
    default:
      return "Disponível";
  }
}
