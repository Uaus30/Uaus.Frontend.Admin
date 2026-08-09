import { FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, TriangleAlert } from "lucide-react";
import type { PartnerFormValues } from "../types";

interface PartnerEditorModalProps {
  open: boolean;
  editingId: number | null;
  /** O sócio estava ativo ao abrir a modal — dispara o aviso ao desativar. */
  editingWasActive: boolean;
  formData: PartnerFormValues;
  onClose: () => void;
  onFormChange: (data: PartnerFormValues) => void;
  onSubmit: (e: FormEvent) => void;
  isSaving: boolean;
}

/**
 * PartnerEditorModal
 *
 * Modal de cadastro/edição de sócio. No cadastro só o nome é pedido: o sócio
 * nasce ativo, com percentual 0. Na edição é possível alternar o status — e
 * desativar zera o percentual, por isso o aviso aparece antes de salvar.
 */
export function PartnerEditorModal({
  open,
  editingId,
  editingWasActive,
  formData,
  onClose,
  onFormChange,
  onSubmit,
  isSaving,
}: PartnerEditorModalProps) {
  const showDeactivationWarning = editingId !== null && editingWasActive && !formData.isActive;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Sócio" : "Novo Sócio"}</DialogTitle>
          <DialogDescription>
            {editingId
              ? "Altere o nome ou o status do sócio."
              : "O sócio nasce ativo, com percentual 0 — ajuste depois na distribuição de lucros."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6 pt-2">
          <div className="space-y-2">
            <Label htmlFor="partner-name">Nome do Sócio *</Label>
            <Input
              id="partner-name"
              placeholder="Ex: Maria Silva"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {editingId !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-muted/20">
                <Label htmlFor="partner-status" className="cursor-pointer text-sm font-medium">
                  {formData.isActive ? "Ativo" : "Inativo"}
                </Label>
                <Switch
                  id="partner-status"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => onFormChange({ ...formData, isActive: checked })}
                />
              </div>

              {showDeactivationWarning && (
                <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500">
                  <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Desativar zera o percentual de lucro deste sócio. Rebalanceie a
                    distribuição antes do próximo fechamento.
                  </span>
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="hover-elevate">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
