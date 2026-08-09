import { FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Switch } from "@workspace/ui";
import { Plus, Trash2, Percent } from "lucide-react";
import type { PaymentMethodFormValues, InstallmentFormValue } from "../types";

interface PaymentMethodEditorModalProps {
  open: boolean;
  editingId: number | null;
  formData: PaymentMethodFormValues;
  onClose: () => void;
  onFormChange: (data: PaymentMethodFormValues) => void;
  onAddInstallment: () => void;
  onRemoveInstallment: (index: number) => void;
  onInstallmentChange: (index: number, field: keyof InstallmentFormValue, value: any) => void;
  onSubmit: (e: FormEvent) => void;
  isSaving: boolean;
}

export function PaymentMethodEditorModal({
  open,
  editingId,
  formData,
  onClose,
  onFormChange,
  onAddInstallment,
  onRemoveInstallment,
  onInstallmentChange,
  onSubmit,
  isSaving
}: PaymentMethodEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
          </DialogTitle>
          <DialogDescription>
            Configure o nome da forma de pagamento, status de disponibilidade e as taxas cobradas por parcelamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6 pt-2">
          {/* Nome e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="pm-name">Nome da Forma de Pagamento *</Label>
              <Input
                id="pm-name"
                placeholder="Ex: Cartão Visa, Pix, Dinheiro, Boleto..."
                value={formData.name}
                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-3 p-2.5 rounded-lg border bg-muted/20">
              <Label htmlFor="pm-status" className="cursor-pointer text-sm font-medium">
                {formData.isActive ? "Ativa" : "Inativa"}
              </Label>
              <Switch
                id="pm-status"
                checked={formData.isActive}
                onCheckedChange={(checked) => onFormChange({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          {/* Seção de Parcelamentos e Taxas */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Parcelamentos & Taxas (%)</h4>
                <p className="text-xs text-muted-foreground">
                  Defina as opções permitidas e a taxa cobrada para cada parcela (ex: 1x 0%, 2x 2.5%).
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddInstallment}
                className="gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Parcela
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {formData.installments.map((inst, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2.5 rounded-md border bg-card text-sm"
                >
                  <div className="w-24 shrink-0 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Parcela</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        value={inst.installmentNumber}
                        onChange={(e) =>
                          onInstallmentChange(index, "installmentNumber", Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="h-8 text-center font-bold"
                      />
                      <span className="text-xs font-bold text-muted-foreground">x</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Taxa da Transação (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={inst.feePercentage}
                        onChange={(e) =>
                          onInstallmentChange(index, "feePercentage", Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        className="h-8 pr-7"
                      />
                      <Percent className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-4">
                    <Switch
                      checked={inst.isActive}
                      onCheckedChange={(checked) => onInstallmentChange(index, "isActive", checked)}
                      title={inst.isActive ? "Parcela Ativa" : "Parcela Inativa"}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveInstallment(index)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Remover parcela"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


