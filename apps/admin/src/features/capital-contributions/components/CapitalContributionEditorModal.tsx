import type { FormEvent } from "react";
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  formatDateInput,
  guardCalendarDismiss,
  parseDateInput,
} from "@workspace/ui";
import type { CapitalContributionForm, PartnerOption } from "../types";

interface CapitalContributionEditorModalProps {
  open: boolean;
  /** Editando um aporte gravado (e não lançando um novo). */
  editing: boolean;
  form: CapitalContributionForm;
  partners: PartnerOption[];
  onFormChange: (form: CapitalContributionForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  isSaving: boolean;
}

/** Tamanho máximo da observação — o mesmo `varchar(300)` da coluna. */
const NOTES_MAX_LENGTH = 300;

/**
 * Modal de lançamento e edição de aporte: data (hoje, por padrão), sócio (os
 * ativos), valor e para quê.
 *
 * A data não passa de hoje: aporte é dinheiro que já entrou. Mês fechado não
 * aceita aporte, e quem diz isso é o servidor, com a mensagem que cita o mês —
 * a modal não sabe quais meses estão fechados além do que a tela filtra.
 */
export function CapitalContributionEditorModal({
  open,
  editing,
  form,
  partners,
  onFormChange,
  onClose,
  onSubmit,
  isSaving,
}: CapitalContributionEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Editar aporte" : "Novo aporte"}</DialogTitle>
          <DialogDescription>
            O aporte entra como saldo disponível do mês e pode levar a faixa de compras ao verde. Não é dívida
            da loja com o sócio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contribution-date">Data *</Label>
              <DatePicker
                id="contribution-date"
                value={parseDateInput(form.contributionDate)}
                onChange={(date) => onFormChange({ ...form, contributionDate: formatDateInput(date) })}
                clearable={false}
                maxDate={new Date()}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribution-partner">Sócio *</Label>
              <Select
                value={form.partnerId}
                onValueChange={(value) => onFormChange({ ...form, partnerId: value })}
              >
                <SelectTrigger id="contribution-partner" className="h-10">
                  <SelectValue placeholder="Selecione o sócio" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={String(partner.id)}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contribution-amount">Valor (R$) *</Label>
            <Input
              id="contribution-amount"
              type="number"
              step="0.01"
              min={0.01}
              placeholder="0,00"
              value={form.amount}
              onChange={(event) => onFormChange({ ...form, amount: event.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contribution-notes">Para quê</Label>
            <Textarea
              id="contribution-notes"
              placeholder="Opcional — ex.: reforço para a compra de Natal"
              value={form.notes}
              maxLength={NOTES_MAX_LENGTH}
              onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : editing ? "Salvar alterações" : "Lançar aporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
