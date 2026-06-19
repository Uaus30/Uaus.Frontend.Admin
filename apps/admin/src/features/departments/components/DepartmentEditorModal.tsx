import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DepartmentForm } from "../types";

type DepartmentEditorModalProps = {
  /** Boolean state flag indicating whether the modal is open */
  isOpen: boolean;
  /** Setter callback to update visibility state of the modal */
  onOpenChange: (open: boolean) => void;
  /** Database ID of the department being edited, null for creation mode */
  editingId: number | null;
  /** Form data model representing current fields input values */
  formData: DepartmentForm;
  /** Setter callback to update fields values in the form state */
  setFormData: React.Dispatch<React.SetStateAction<DepartmentForm>>;
  /** Saving/submitting state flag to display loading spinners */
  saving: boolean;
  /** Submission event handler */
  onSubmit: (event: React.FormEvent) => Promise<void>;
};

/**
 * DepartmentEditorModal
 * 
 * Renders the modal sheet containing the Department creation/editing form.
 */
export function DepartmentEditorModal({
  isOpen,
  onOpenChange,
  editingId,
  formData,
  setFormData,
  saving,
  onSubmit,
}: DepartmentEditorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {editingId ? "Editar Departamento" : "Novo Departamento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              required
              value={formData.name}
              onChange={(event) =>
                setFormData((current) => ({ ...current, name: event.target.value }))
              }
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição (opcional)</label>
            <Input
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({ ...current, description: event.target.value }))
              }
              className="bg-background"
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="hover-elevate">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
