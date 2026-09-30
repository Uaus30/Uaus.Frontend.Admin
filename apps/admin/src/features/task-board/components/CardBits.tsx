import { Tooltip, TooltipContent, TooltipTrigger, cn } from "@workspace/ui";
import type { EnumValue, TaskCardMemberDto, TaskLabelDto } from "@workspace/api-client-react";
import { BOARD_COLUMNS, columnTitle, labelClasses, statusCode } from "../board";

/**
 * Peças pequenas e puras do cartão, compartilhadas entre o quadro, a busca, a
 * lista de arquivados e a modal: etiqueta, avatar de membro e badge de coluna.
 */

interface TaskLabelChipProps {
  label: TaskLabelDto;
  /** Compacto: só a faixa de cor com o nome pequeno (no cartão). */
  size?: "sm" | "md";
  className?: string;
}

export function TaskLabelChip({ label, size = "md", className }: TaskLabelChipProps) {
  return (
    <span
      title={label.name}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md font-semibold leading-none",
        size === "sm" ? "h-4 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
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

/** Círculo com a inicial; o nome completo fica no tooltip. O quadro mostra só o primeiro nome. */
export function MemberAvatar({ member, size = "md", className }: MemberAvatarProps) {
  const initial = member.firstName.trim().charAt(0).toUpperCase() || "?";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={member.fullName}
          className={cn(
            "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ring-2 ring-background",
            size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-sm",
            avatarColor(member.userId),
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

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-fuchsia-600",
];

function avatarColor(userId: number): string {
  return AVATAR_COLORS[Math.abs(userId) % AVATAR_COLORS.length];
}

/** Até `max` avatares e um "+N" para o resto. */
export function MemberStack({ members, max = 3 }: { members: TaskCardMemberDto[]; max?: number }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <div className="flex -space-x-1.5">
      {shown.map((m) => (
        <MemberAvatar key={m.userId} member={m} size="sm" />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-background">
          +{rest}
        </span>
      )}
    </div>
  );
}

/** Nome da coluna com a bolinha da cor dela — para fora do quadro (busca, arquivados). */
export function ColumnBadge({ status, className }: { status: EnumValue; className?: string }) {
  const code = statusCode(status);
  const column = BOARD_COLUMNS.find((c) => c.status === code);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", column?.dot ?? "bg-muted-foreground")} />
      {columnTitle(status)}
    </span>
  );
}
