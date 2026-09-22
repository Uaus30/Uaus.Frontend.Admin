import { cn } from "@workspace/ui";
import type { ProfitLeaderDto } from "@workspace/api-client-react";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import {
  ALERT_ICONS,
  ARCHETYPE_ICONS,
  FALLBACK_ICON,
  alertBadgeLabel,
  archetypeLabel,
  leaderTone,
} from "../lib/profit-leaders";

/**
 * O que o produto é neste período.
 *
 * <b>Cor nunca sozinha.</b> A pílula sai sempre com ícone E texto: quem não
 * distingue verde de âmbar ficaria sem a informação, e numa impressão em preto e
 * branco ela some para todo mundo — e esta é uma tela que se imprime para levar
 * ao balcão na hora de comprar.
 */
export function ArchetypeBadge({ leader, className }: { leader: ProfitLeaderDto; className?: string }) {
  const Icon = ARCHETYPE_ICONS[leader.archetype] ?? FALLBACK_ICON;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
        BI_TONE_PILL[leaderTone(leader)],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {archetypeLabel(leader.archetype)}
    </span>
  );
}

/**
 * O ponto de atenção da linha, quando há.
 *
 * Não é juízo sobre o produto: todo item desta tela chegou ao corte. É o que
 * olhar neste aqui.
 */
export function AlertBadge({ leader, className }: { leader: ProfitLeaderDto; className?: string }) {
  if (leader.alert === "None") return null;

  const Icon = ALERT_ICONS[leader.alert] ?? FALLBACK_ICON;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
        BI_TONE_PILL[leaderTone(leader)],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {alertBadgeLabel(leader)}
    </span>
  );
}
