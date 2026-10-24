import { ChevronDown, ChevronsUp, ChevronUp, Equal, type LucideIcon } from "lucide-react";
import { TASK_CARD_PRIORITY } from "@workspace/api-client-react";

/**
 * O ícone de cada prioridade — a cor nunca vem sozinha. Fora de `CardBits` porque
 * arquivo que exporta componente só pode exportar componentes (Fast Refresh), e o
 * seletor de prioridade usa o mesmo mapa.
 */
export const PRIORITY_ICONS: Record<number, LucideIcon> = {
  [TASK_CARD_PRIORITY.Urgent]: ChevronsUp,
  [TASK_CARD_PRIORITY.High]: ChevronUp,
  [TASK_CARD_PRIORITY.Normal]: Equal,
  [TASK_CARD_PRIORITY.Low]: ChevronDown,
};
