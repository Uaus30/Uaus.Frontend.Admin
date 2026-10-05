import React from "react";
import { Globe, HelpCircle, ImagePlus, X } from "lucide-react";
import {
  Button,
  ImageHoverZoom,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-images";
import type { LocalImage } from "../types";

type ProductImagesSectionProps = {
  /** As fotos do grupo, na ordem de exibição. A primeira é a capa. */
  images: LocalImage[];
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
  /** Arquivos escolhidos no seletor — o limite de 3 é aplicado por quem recebe. */
  handleSimpleFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Troca de posição por arrasto. */
  reorderProductImage: (oldIndex: number, newIndex: number) => void;
  /** Sem nome não há o que buscar na web. */
  productName: string;
  onSearchWebImage?: () => void;
};

/**
 * As fotos do produto na aba Dados (04/10/2026): a CAPA grande e, embaixo, duas
 * menores — o limite de {@link MAX_PRODUCT_IMAGES} fotos por produto, que é
 * novidade desta data. Ocupa o lugar da prévia do código de barras com o botão
 * de imprimir, que o dono tirou por não ter uso na prática (a impressão continua
 * na tela Etiquetas).
 *
 * Os três lugares estão sempre na tela: o vazio é o botão de acrescentar, e o
 * produto sem foto (118 vendáveis em produção, 04/10/2026) mostra os três vazios
 * em vez de uma área genérica. Arrastar uma foto sobre outra troca a ordem — a
 * que vai para o primeiro lugar vira a capa da vitrine, do PDV e da listagem.
 */
export function ProductImagesSection({
  images,
  setImages,
  handleSimpleFileSelection,
  reorderProductImage,
  productName,
  onSearchWebImage,
}: ProductImagesSectionProps) {
  const cheio = images.length >= MAX_PRODUCT_IMAGES;

  function remover(index: number) {
    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function lugar(index: number, grande: boolean) {
    const image = images[index];

    if (!image) {
      return (
        <label
          className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/40 bg-background/20 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 ${grande ? "text-sm" : "text-[11px]"}`}
          aria-label={index === 0 ? "Adicionar a foto principal" : "Adicionar foto"}
        >
          <ImagePlus className={grande ? "h-8 w-8 opacity-60" : "h-5 w-5 opacity-60"} />
          <span className="px-2 text-center font-medium">{index === 0 ? "Foto principal" : "Adicionar"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSimpleFileSelection}
          />
        </label>
      );
    }

    return (
      <div
        className="group relative aspect-square w-full cursor-grab overflow-hidden rounded-xl border border-border/50 bg-white ring-primary/50 transition-all hover:ring-2 active:cursor-grabbing"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", index.toString());
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const origem = parseInt(event.dataTransfer.getData("text/plain"), 10);
          if (!isNaN(origem) && origem !== index) reorderProductImage(origem, index);
        }}
      >
        {/* A capa já é grande: ampliar no hover só cobriria a tela. As menores
            ampliam, como em todo o admin. `draggable={false}` deixa o arrasto
            com o cartão, que é quem reordena. */}
        {grande ? (
          <img src={image.url} alt={image.name} draggable={false} className="h-full w-full object-contain" />
        ) : (
          <ImageHoverZoom
            src={image.url}
            alt={image.name}
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}
        {index === 0 && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-primary/85 py-0.5 text-center text-[10px] font-medium text-primary-foreground">
            Principal
          </span>
        )}
        <button
          type="button"
          className="absolute right-1.5 top-1.5 cursor-pointer rounded bg-card/90 p-1 text-destructive transition-colors hover:bg-destructive/10"
          onClick={() => remover(index)}
          aria-label={`Remover a foto ${index + 1}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium">
            Imagens{" "}
            <span className="text-xs font-normal text-muted-foreground">(até {MAX_PRODUCT_IMAGES})</span>
          </label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger type="button" tabIndex={-1}>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  A primeira é a capa da vitrine, do PDV e da listagem. Arraste uma foto sobre outra para
                  trocar a ordem, ou cole (Ctrl+V) uma imagem copiada. Cada produto tem no máximo{" "}
                  {MAX_PRODUCT_IMAGES} fotos.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {onSearchWebImage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSearchWebImage}
            disabled={!productName.trim() || cheio}
            className="h-8 gap-1.5 text-xs"
            title={
              cheio
                ? `O produto já tem ${MAX_PRODUCT_IMAGES} fotos. Remova uma para buscar outra.`
                : !productName.trim()
                  ? "Preencha o nome do produto para habilitar a busca"
                  : "Buscar imagens na internet"
            }
          >
            <Globe className="h-3.5 w-3.5" />
            Buscar na Web
          </Button>
        )}
      </div>

      {lugar(0, true)}
      <div className="grid grid-cols-2 gap-3">
        {lugar(1, false)}
        {lugar(2, false)}
      </div>
    </div>
  );
}
