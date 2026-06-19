import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoryForm, Department } from "../types";

type CategoryEditorModalProps = {
  /** Boolean state flag indicating whether the modal is visible */
  isOpen: boolean;
  /** Setter callback to update visibility state of the modal */
  onOpenChange: (open: boolean) => void;
  /** Database ID of category being edited, null for creation mode */
  editingId: number | null;
  /** Form data model representing current fields input values */
  formData: CategoryForm;
  /** Setter callback to update fields values in the form state */
  setFormData: React.Dispatch<React.SetStateAction<CategoryForm>>;
  /** List of all departments for select dropdown options */
  departments: Department[];
  /** Saving/submitting state flag to display loading spinners */
  saving: boolean;
  /** Submission event handler */
  onSubmit: (event: React.FormEvent) => Promise<void>;
};

/**
 * CategoryEditorModal
 * 
 * Renders the modal sheet containing the Category creation/editing form.
 */
export function CategoryEditorModal({
  isOpen,
  onOpenChange,
  editingId,
  formData,
  setFormData,
  departments,
  saving,
  onSubmit,
}: CategoryEditorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {editingId ? "Editar Categoria" : "Nova Categoria"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Departamento</label>
            <Select
              value={formData.departmentId}
              onValueChange={(value) =>
                setFormData((current) => ({ ...current, departmentId: value }))
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id.toString()}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
