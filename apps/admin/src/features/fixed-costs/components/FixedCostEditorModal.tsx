import { FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import type { FixedCostForm } from "../types";

interface FixedCostEditorModalProps {
  open: boolean;
  editingId: number | null;
  form: FixedCostForm;
  onFormChange: (form: FixedCostForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  isSaving: boolean;
}

/**
 * Modal de cadastro/edição de custo fixo.
 *
 * As vigências usam `<input type="month">` porque a competência é mensal:
 * o backend normaliza qualquer dia para o dia 1, então não faz sentido o
 * usuário escolher um dia específico.
 */
export function FixedCostEditorModal({
  open,
  editingId,
  form,
  onFormChange,
  onClose,
  onSubmit,
  isSaving,
}: FixedCostEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Custo Fixo" : "Novo Custo Fixo"}</DialogTitle>
          <DialogDescription>
            O valor mensal entra cheio em cada mês da vigência, sem pró-rata, e é lançado nos fechamentos
            financeiros do período.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="fc-name">Nome *</Label>
            <Input
              id="fc-name"
              placeholder="Ex: Aluguel, Contador, Energia..."
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fc-amount">Valor mensal (R$) *</Label>
            <Input
              id="fc-amount"
              type="number"
              step="0.01"
              min={0}
              placeholder="0,00"
              value={form.monthlyAmount}
              onChange={(e) => onFormChange({ ...form, monthlyAmount: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fc-starts">Início da vigência *</Label>
              <Input
                id="fc-starts"
                type="month"
                value={form.startsOn}
                onChange={(e) => onFormChange({ ...form, startsOn: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fc-ends">Fim da vigência</Label>
              <Input
                id="fc-ends"
                type="month"
                value={form.endsOn}
                onChange={(e) => onFormChange({ ...form, endsOn: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Deixe em branco para custo ainda vigente.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fc-notes">Observações</Label>
            <Textarea
              id="fc-notes"
              placeholder="Detalhes do contrato, reajustes, etc. (opcional)"
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
