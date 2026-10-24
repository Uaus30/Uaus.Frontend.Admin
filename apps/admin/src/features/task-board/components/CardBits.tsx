import { Tooltip, TooltipContent, TooltipTrigger, cn } from "@workspace/ui";
import type { EnumValue, TaskCardMemberDto, TaskLabelDto } from "@workspace/api-client-react";
import { PRIORITY_ICONS } from "../priority-icons";
import { STATUS_BADGES, labelClasses, memberColor, priorityDef, statusCode } from "../tasks";

/**
 * Peças pequenas e puras da tarefa, compartilhadas entre a lista, o detalhe e a
 * atividade: etiqueta, avatar, selo de prioridade e selo de situação.
 */

interface TaskLabelChipProps {
  label: TaskLabelDto;
  /** Compacto: só a faixa de cor com o nome pequeno (no cartão da lista). */
  size?: "sm" | "md";
  className?: string;
}

export function TaskLabelChip({ label, size = "md", className }: TaskLabelChipProps) {
  return (
    <span
      title={label.name}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md font-semibold leading-none",
        size === "sm" ? "h-[18px] px-1.5 text-[10.5px]" : "h-6 px-2 text-xs",
        labelClasses(label.color).chip,
        className,
      )}
    >
      {label.name}
    </span>
  );
}

interface MemberAvatarProps {
  member: TaskCardMemberDto;
  size?: "sm" | "md";
  className?: string;
}

/** Círculo com a inicial; o nome completo fica no tooltip. A lista mostra só o primeiro nome. */
export function MemberAvatar({ member, size = "md", className }: MemberAvatarProps) {
  const initial = member.firstName.trim().charAt(0).toUpperCase() || "?";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={member.fullName}
          className={cn(
            "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white",
            size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-sm",
            memberColor(member.userId),
            className,
          )}
        >
          {initial}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{member.fullName || member.firstName}</TooltipContent>
    </Tooltip>
  );
}

/** "⌃⌃ Urgente": ícone, nome e o tom da prioridade. */
export function PriorityBadge({ priority, className }: { priority: EnumValue; className?: string }) {
  const def = priorityDef(priority);
  const Icon = PRIORITY_ICONS[def.code];

  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-md pl-1.5 pr-2 text-xs font-bold",
        def.text,
        def.soft,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
      {def.name}
    </span>
  );
}

/** Nome da situação com a bolinha da cor dela — no detalhe e nas linhas do histórico. */
export function StatusBadge({ status, className }: { status: EnumValue; className?: string }) {
  const badge = STATUS_BADGES[statusCode(status)];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", badge?.dot ?? "bg-muted-foreground")} />
      {badge?.title ?? "—"}
    </span>
  );
}
