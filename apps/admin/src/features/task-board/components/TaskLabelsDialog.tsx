import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@workspace/ui";
import {
  TASK_LABEL_COLORS,
  TASK_LABEL_PRIORITY,
  type TaskLabelDto,
  type TaskLabelPriorityCode,
} from "@workspace/api-client-react";
import { LABEL_PRIORITY_LABEL, labelClasses, priorityCode } from "../board";
import { useTaskLabels } from "../hooks/useTaskLabels";

interface TaskLabelsDialogProps {
  open: boolean;
  onClose: () => void;
}

const PRIORITIES: TaskLabelPriorityCode[] = [
  TASK_LABEL_PRIORITY.Low,
  TASK_LABEL_PRIORITY.Normal,
  TASK_LABEL_PRIORITY.High,
  TASK_LABEL_PRIORITY.Urgent,
];

/**
 * Cadastro das etiquetas: nome, cor (uma amostra por chave da paleta) e
 * prioridade. Lista em cima, formulário embaixo — o mesmo formulário cria e
 * edita.
 */
export function TaskLabelsDialog({ open, onClose }: TaskLabelsDialogProps) {
  const ctl = useTaskLabels();
  const [toDelete, setToDelete] = useState<TaskLabelDto | null>(null);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 pb-3 pt-5">
          <DialogTitle>Etiquetas</DialogTitle>
          <DialogDescription>
            Nome, cor e prioridade. A prioridade é da etiqueta: o cartão herda a maior entre as que carrega.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {ctl.labels.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {ctl.isLoading ? "Carregando…" : "Nenhuma etiqueta ainda. Crie a primeira abaixo."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ctl.labels.map((label) => (
                <li key={label.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 flex-1 items-center rounded-md px-3 text-sm font-semibold",
                      labelClasses(label.color).chip,
                    )}
                  >
                    {label.name}
                  </span>
                  <span className="w-16 text-xs text-muted-foreground">
                    {LABEL_PRIORITY_LABEL[priorityCode(label.priority)]}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Editar etiqueta"
                    onClick={() => ctl.startEdit(label)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir etiqueta"
                    onClick={() => setToDelete(label)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ctl.submit();
          }}
          className="space-y-3 border-t bg-muted/30 px-5 py-4"
        >
          <p className="text-sm font-semibold">{ctl.editingId ? "Editar etiqueta" : "Nova etiqueta"}</p>

          <div className="space-y-1.5">
            <Label htmlFor="label-name">Nome</Label>
            <Input
              id="label-name"
              value={ctl.form.name}
              onChange={(e) => ctl.setForm({ ...ctl.form, name: e.target.value })}
              placeholder="Ex.: Bug, Ideia, Pedido de cliente…"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={ctl.form.color === color}
                  onClick={() => ctl.setForm({ ...ctl.form, color })}
                  className={cn(
                    "flex h-8 w-10 items-center justify-center rounded-md ring-offset-background transition-transform hover:scale-105",
                    labelClasses(color).swatch,
                    ctl.form.color === color && "ring-2 ring-ring ring-offset-2",
                  )}
                >
                  {ctl.form.color === color && <Check className="h-4 w-4 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select
              value={String(ctl.form.priority)}
              onValueChange={(value) =>
                ctl.setForm({ ...ctl.form, priority: Number(value) as TaskLabelPriorityCode })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={String(priority)}>
                    {LABEL_PRIORITY_LABEL[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-2">
            {ctl.editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={ctl.cancelEdit}>
                Cancelar edição
              </Button>
            )}
            <Button type="submit" size="sm" disabled={ctl.isSaving}>
              {ctl.isSaving ? "Salvando…" : ctl.editingId ? "Salvar" : "Criar etiqueta"}
            </Button>
          </div>
        </form>

        <ConfirmDialog
          open={toDelete !== null}
          onOpenChange={(value) => !value && setToDelete(null)}
          title="Excluir esta etiqueta?"
          itemName={toDelete?.name}
          description="Ela sai de todos os cartões que a usam. Os cartões continuam; só a etiqueta some."
          confirmLabel="Sim, excluir"
          destructive
          loading={ctl.isDeleting}
          onConfirm={async () => {
            if (toDelete) await ctl.remove(toDelete.id);
            setToDelete(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
