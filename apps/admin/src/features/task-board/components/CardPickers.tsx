import { useState } from "react";
import { Check, Tag, UserRoundPlus } from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, cn } from "@workspace/ui";
import type { TaskCardMemberDto, TaskLabelDto } from "@workspace/api-client-react";
import { LABEL_PRIORITY_LABEL, labelClasses, priorityCode } from "../board";

interface LabelsPickerProps {
  labels: TaskLabelDto[];
  selectedIds: number[];
  onToggle: (labelId: number) => void;
  onManage: () => void;
  disabled?: boolean;
}

/**
 * Seletor de etiquetas do cartão: cada linha liga/desliga na hora (sem botão
 * "aplicar"), e o link do rodapé abre o cadastro para criar uma que falta sem
 * sair do cartão.
 *
 * **Os dois seletores daqui são `modal`** (06/10/2026): moram na lateral do
 * cartão, que é um diálogo, e a lista vai para um portal fora dele. O diálogo
 * trava a rolagem de tudo o que está fora da caixa dele, e a roda do mouse
 * morria na lista — a mesma falha da busca de produto da compra. Modal, o
 * seletor vira a trava mais recente, e a rolagem vale dentro dele.
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
                    <span className="w-14 text-right text-[11px] text-muted-foreground">
                      {priorityCode(label.priority) > 0
                        ? LABEL_PRIORITY_LABEL[priorityCode(label.priority)]
                        : ""}
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

interface MembersPickerProps {
  users: TaskCardMemberDto[];
  selectedIds: number[];
  onToggle: (userId: number) => void;
  disabled?: boolean;
}

/** Seletor de membros: os usuários do sistema, com busca por nome. */
export function MembersPicker({ users, selectedIds, onToggle, disabled }: MembersPickerProps) {
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();
  const visible = users.filter((u) => !term || u.fullName.toLowerCase().includes(term));

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={disabled}
        >
          <UserRoundPlus className="h-4 w-4" /> Membros
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Membros</p>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar usuário…"
          className="mb-2 h-8 text-sm"
        />
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {visible.map((user) => {
            const selected = selectedIds.includes(user.userId);
            return (
              <li key={user.userId}>
                <button
                  type="button"
                  onClick={() => onToggle(user.userId)}
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
