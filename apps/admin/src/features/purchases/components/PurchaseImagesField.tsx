import { useState } from "react";
import { Globe, ImagePlus, Link2, Loader2, X } from "lucide-react";
import { Button, Input } from "@workspace/ui";
import type { PurchaseFormImage } from "../types";

type PurchaseImagesFieldProps = {
  images: PurchaseFormImage[];
  readOnly: boolean;
  uploading: boolean;
  /** Habilita a busca na web — sem nome não há o que procurar. */
  productName: string;
  onFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Devolve `false` quando a URL não serve; aí o campo não se limpa. */
  onAddUrl: (url: string) => Promise<boolean>;
  onRemove: (imageId: number) => void;
  onSearchWeb: () => void;
};

/**
 * As fotos da compra: enviar arquivo, colar (Ctrl+V), informar URL ou buscar na
 * web. A colagem é escutada pelo diálogo inteiro (ver `PurchaseEditorModal`),
 * porque exigir o clique numa área específica antes do Ctrl+V é justamente o
 * passo que o atalho existe para eliminar.
 *
 * A PRIMEIRA foto é a principal — a que vira imagem principal do produto no
 * recebimento. O rótulo diz isso na própria miniatura, porque a ordem só é
 * óbvia depois que alguém explica.
 */
export function PurchaseImagesField({
  images,
  readOnly,
  uploading,
  productName,
  onFileSelection,
  onAddUrl,
  onRemove,
  onSearchWeb,
}: PurchaseImagesFieldProps) {
  const [url, setUrl] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);

  async function submitUrl() {
    if (!url.trim() || addingUrl) return;

    setAddingUrl(true);
    try {
      if (await onAddUrl(url)) setUrl("");
    } finally {
      setAddingUrl(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Fotos</label>
        <div className={`flex gap-2 ${readOnly ? "hidden" : ""}`}>
          <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
            <label className="cursor-pointer">
              <ImagePlus className="h-3.5 w-3.5" /> Enviar
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onFileSelection}
                disabled={uploading}
              />
            </label>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={uploading || !productName.trim()}
            onClick={onSearchWeb}
            title={productName.trim() ? "Buscar foto na web" : "Informe o nome do produto para buscar"}
          >
            <Globe className="h-3.5 w-3.5" /> Buscar na web
          </Button>
        </div>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              // O campo vive dentro de um <form>: sem isto, o Enter registraria
              // a compra em vez de anexar a foto.
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void submitUrl();
              }}
              placeholder="Cole a URL de uma imagem — ou Ctrl+V com a foto copiada"
              className="h-9 bg-background pl-9 text-sm"
              aria-label="URL da imagem"
              disabled={uploading || addingUrl}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!url.trim() || uploading || addingUrl}
            onClick={() => void submitUrl()}
          >
            {addingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <div
            key={image.imageId}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-border/50 bg-white"
          >
            <img src={image.url} alt={image.name} className="h-full w-full object-contain" />
            {index === 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-primary/85 py-0.5 text-center text-[10px] font-medium text-primary-foreground">
                Principal
              </span>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemove(image.imageId)}
                aria-label="Remover foto"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {uploading && (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border/50">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {images.length === 0 && !uploading ? (
        <p className="text-xs text-muted-foreground">
          Opcional. Em produto novo, as fotos viram a galeria do cadastro no recebimento.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          A primeira foto é a principal. No recebimento ela assume a imagem principal do produto, e as que já
          existiam descem de posição sem serem perdidas.
        </p>
      )}
    </div>
  );
}
