import React from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { buildPublicImageUrl } from "@/services/core";
import type { CatalogImage } from "../types";

type ImageRenameModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback triggered when visibility status changes */
  onOpenChange: (open: boolean) => void;
  /** Image object being renamed */
  renameImage: CatalogImage | null;
  /** Temporary text value of the new name */
  renameName: string;
  /** Callback to update temporary text value */
  setRenameName: (val: string) => void;
  /** True if request is actively saving */
  renaming: boolean;
  /** Callback to trigger the rename action */
  onRename: () => void;
};

/**
 * ImageRenameModal
 * 
 * Dialog box for updating the description name of an existing image.
 */
export function ImageRenameModal({
  open,
  onOpenChange,
  renameImage,
  renameName,
  setRenameName,
  renaming,
  onRename,
}: ImageRenameModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Renomear Imagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {renameImage && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <img
                src={buildPublicImageUrl(renameImage.url)}
                alt={renameImage.name}
                className="h-12 w-12 flex-shrink-0 rounded-lg border border-border/50 object-cover"
              />
              <div>
                <p className="text-xs text-muted-foreground">Arquivo atual</p>
                <p className="max-w-[220px] truncate text-sm font-medium">{renameImage.name}</p>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Novo nome</Label>
            <Input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              className="bg-background"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onRename();
                }
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Apenas o nome é alterado. Para mudar o arquivo, exclua e faça um novo upload.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onRename} disabled={!renameName.trim() || renaming} className="hover-elevate">
            {renaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


