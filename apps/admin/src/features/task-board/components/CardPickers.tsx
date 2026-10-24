import { useState } from "react";
import { Check, Tag, UserRound } from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, cn } from "@workspace/ui";
import type { TaskCardMemberDto, TaskCardPriorityCode, TaskLabelDto } from "@workspace/api-client-react";
import { PRIORITIES, labelClasses } from "../tasks";
import { PRIORITY_ICONS } from "../priority-icons";
import { MemberAvatar } from "./CardBits";

interface LabelsPickerProps {
  labels: TaskLabelDto[];
  selectedIds: number[];
  onToggle: (labelId: number) => void;
  onManage: () => void;
  disabled?: boolean;
}

/**
 * Seletor de etiquetas da tarefa: cada linha liga/desliga na hora (sem botão
 * "aplicar"), e o link do rodapé abre o cadastro para criar uma que falta sem
 * sair da tarefa.
 *
 * **Os seletores daqui são `modal`** (06/10/2026): moram na lateral da tarefa,
 * que é um diálogo, e a lista vai para um portal fora dele. O diálogo trava a
 * rolagem de tudo o que está fora da caixa dele, e a roda do mouse morria na
 * lista — a mesma falha da busca de produto da compra. Modal, o seletor vira a
 * trava mais recente, e a rolagem vale dentro dele.
 */
export function LabelsPicker({ labels, selectedIds, onToggle, onManage, disabled }: LabelsPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={disabled}
        >
          <Tag className="h-4 w-4" /> Etiquetas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Etiquetas</p>
        {labels.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">Nenhuma etiqueta cadastrada ainda.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {labels.map((label) => {
              const selected = selectedIds.includes(label.id);
              return (
                <li key={label.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(label.id)}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-foreground/10"
                  >
                    <span
                      className={cn(
                        "flex h-7 flex-1 items-center rounded-md px-2 text-xs font-semibold",
                        labelClasses(label.color).chip,
                      )}
                    >
                      {label.name}
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center">
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {/* Fecha antes de abrir o cadastro. Não modal, o seletor se fechava sozinho
            quando o foco ia para o diálogo de etiquetas; modal, ele segura o foco
            e ficaria aberto por baixo, reaparecendo ao fechar o cadastro. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => {
            setOpen(false);
            onManage();
          }}
        >
          Gerenciar etiquetas
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface AssigneePickerProps {
  users: TaskCardMemberDto[];
  /** O responsável atual; nulo em tarefa migrada sem ninguém. */
  assignee: TaskCardMemberDto | null | undefined;
  onChange: (userId: number) => void;
  disabled?: boolean;
}

/**
 * Seletor do responsável: UMA pessoa (decisão do dono, 23/10/2026 — "Minhas
 * tarefas" sem ambiguidade). O botão mostra quem é; sem ninguém, avisa em âmbar
 * para a pessoa escolher, e a lista tem busca por nome.
 */
export function AssigneePicker({ users, assignee, onChange, disabled }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();
  const visible = users.filter((u) => !term || u.fullName.toLowerCase().includes(term));

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(
            "w-full justify-start gap-2",
            !assignee && "border border-amber-500/60 text-amber-400 hover:text-amber-300",
          )}
          disabled={disabled}
          aria-label={assignee ? `Responsável: ${assignee.fullName}` : "Escolher o responsável"}
        >
          {assignee ? (
            <>
              <MemberAvatar member={assignee} size="sm" className="h-5 w-5 text-[10px]" />
              <span className="truncate">{assignee.firstName}</span>
            </>
          ) : (
            <>
              <UserRound className="h-4 w-4" /> Sem responsável
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Responsável</p>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar usuário…"
          className="mb-2 h-8 text-sm"
        />
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {visible.map((user) => {
            const selected = assignee?.userId === user.userId;
            return (
              <li key={user.userId}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(user.userId);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/10"
                >
                  <span className="flex-1 truncate">
                    {user.firstName}{" "}
                    <span className="text-muted-foreground">
                      {user.fullName.slice(user.firstName.length).trim()}
                    </span>
                  </span>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">Ninguém com esse nome.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

interface PriorityPickerProps {
  value: number;
  onChange: (priority: TaskCardPriorityCode) => void;
  disabled?: boolean;
  /** Duas por linha (a lateral estreita do detalhe) ou as quatro lado a lado. */
  columns?: 2 | 4;
}

/**
 * As quatro prioridades em botões lado a lado, da mais urgente para a menos: um
 * toque resolve, e todas ficam à vista. A escolhida ganha o tom dela, com o ícone
 * e o nome — a cor nunca sozinha.
 */
export function PriorityPicker({ value, onChange, disabled, columns = 4 }: PriorityPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Prioridade"
      className={cn("grid gap-1.5", columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}
    >
      {PRIORITIES.map((p) => {
        const Icon = PRIORITY_ICONS[p.code];
        const selected = p.code === value;
        return (
          <button
            key={p.code}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(p.code)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
              selected && p.selected,
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
