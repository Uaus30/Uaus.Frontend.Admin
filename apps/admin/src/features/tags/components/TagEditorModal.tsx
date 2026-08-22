import React from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Switch } from "@workspace/ui";
import { Button } from "@workspace/ui";
import type { TagForm } from "../types";

type TagEditorModalProps = {
  /** Visibility state of the modal dialog */
  open: boolean;
  /** Callback to trigger visibility state change */
  onOpenChange: (open: boolean) => void;
  /** Active tag ID being edited, or null if creating */
  editingId: number | null;
  /** Current form state values */
  formData: TagForm;
  /** Callback to update form state values */
  setFormData: React.Dispatch<React.SetStateAction<TagForm>>;
  /** Indicates if a request is actively being saved to API */
  saving: boolean;
  /** Callback to generate a random hex color */
  randomizeColor: () => void;
  /** Callback triggered on form submission */
  onSubmit: (event: React.FormEvent) => void;
};

/**
 * TagEditorModal
 *
 * Renders the modal dialog for creating or updating a Tag.
 */
export function TagEditorModal({
  open,
  onOpenChange,
  editingId,
  formData,
  setFormData,
  saving,
  randomizeColor,
  onSubmit,
}: TagEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {editingId ? "Editar Tag" : "Nova Tag"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              required
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cor</label>
            <div className="flex items-center gap-4">
              <Input
                type="color"
                value={formData.color}
                onChange={(event) => setFormData((current) => ({ ...current, color: event.target.value }))}
                className="h-12 w-16 cursor-pointer bg-background p-1"
              />
                <span className="font-mono text-sm text-muted-foreground">{formData.color}</span>
              <Button type="button" variant="outline" onClick={randomizeColor} className="ml-auto">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Gerar aleatoria
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Exibir no site</label>
                <p className="text-sm text-muted-foreground">
                  Use esta opcao para tornar a tag publica no catalogo.
                </p>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData((current) => ({ ...current, isPublic: checked }))}
              />
            </div>
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
