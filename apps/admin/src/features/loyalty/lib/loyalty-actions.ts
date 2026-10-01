import { CalendarHeart, Clock, Gift, Hourglass, Target, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LoyaltyActionCountsDto, LoyaltyActionList } from "@workspace/api-client-react";

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
    dateLabel: "Vale até",
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
    dateLabel: "Prêmio vale até",
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
