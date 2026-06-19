import React, { useRef } from "react";
import { Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type ImageUploadModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback triggered when visibility status changes */
  onOpenChange: (open: boolean) => void;
  /** Image preview URL string (for selected files pending upload) or null */
  preview: string | null;
  /** Filename input value */
  formName: string;
  /** Callback to change filename input value */
  setFormName: (val: string) => void;
  /** Selected image type value */
  formType: string;
  /** Callback to change selected image type value */
  setFormType: (val: string) => void;
  /** List of selectable image types */
  selectableTypes: any[];
  /** File instance selected from disk, or null */
  file: File | null;
  /** True if request is actively uploading */
  uploading: boolean;
  /** Callback triggered when file selection input changes */
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to upload the file */
  onUpload: () => void;
};

/**
 * ImageUploadModal
 * 
 * Renders the dialog box to select files and upload them to the images database.
 */
export function ImageUploadModal({
  open,
  onOpenChange,
  preview,
  formName,
  setFormName,
  formType,
  setFormType,
  selectableTypes,
  file,
  uploading,
  onFileChange,
  onUpload,
}: ImageUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Nova Imagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div
            className="cursor-pointer rounded-xl border-2 border-dashed border-border/50 p-6 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="preview" className="mx-auto max-h-40 rounded-lg object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8 opacity-50" />
                <p className="text-sm">Clique para selecionar uma imagem</p>
                <p className="text-xs">JPG, PNG, GIF, WebP</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>

          <div className="space-y-1.5">
            <Label>Nome da imagem</Label>
            <Input
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableTypes.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onUpload} disabled={!file || !formName || !formType || uploading} className="hover-elevate">
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Enviando..." : "Salvar Imagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
