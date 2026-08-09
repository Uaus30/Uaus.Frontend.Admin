import React from "react";
import { Check, Copy, ExternalLink, ImageIcon, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { buildPublicImageUrl } from "@/services/core";
import type { CatalogImage } from "../types";

type ImageCatalogProps = {
  /** Search text filter query */
  search: string;
  /** Callback triggered when search text changes */
  setSearch: (val: string) => void;
  /** Selected image type filter value or "all" */
  typeFilter: string;
  /** Callback triggered when type filter dropdown changes */
  setTypeFilter: (val: string) => void;
  /** List of selectable image types */
  selectableTypes: any[];
  /** Full list of image types from backend */
  imageTypes: any[];
  /** True if list query is loading */
  isLoading: boolean;
  /** Grid items list */
  filteredImages: CatalogImage[];
  /** ID of the image whose URL was copied recently, or null */
  copiedId: number | null;
  /** Current page index */
  page: number;
  /** Callback to update page index */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Page size limit */
  limit: number;
  /** Callback to update page size limit */
  setLimit: (limit: number) => void;
  /** Paginated payload object from API */
  imagePage: any;
  /** Total count of pages */
  totalPages: number;
  /** Callback to copy image URL to clipboard */
  copyUrl: (id: number, url: string) => void;
  /** Callback to start image renaming flow */
  onRenameOpen: (image: CatalogImage) => void;
  /** Callback to delete an image */
  onDelete: (id: number) => void;
};

/**
 * ImageCatalog
 * 
 * Grid list catalog displaying images, filters, action triggers, and pagination.
 */
export function ImageCatalog({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  selectableTypes,
  imageTypes,
  isLoading,
  filteredImages,
  copiedId,
  page,
  setPage,
  limit,
  setLimit,
  imagePage,
  totalPages,
  copyUrl,
  onRenameOpen,
  onDelete,
}: ImageCatalogProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="bg-background pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52 bg-background">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {selectableTypes.map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <ImageIcon className="h-12 w-12 opacity-30" />
          <p>Nenhuma imagem encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-background transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted/30">
                <img
                  src={buildPublicImageUrl(image.url)}
                  alt={image.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium" title={image.name}>
                  {image.name}
                </p>
                <Badge className="mt-1 border-0 bg-emerald-500/20 text-[10px] text-emerald-400">
                  {imageTypes.find((type) => type.id === image.type)?.name ?? image.type}
                </Badge>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(image.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => copyUrl(image.id, image.url)}
                  className="rounded-lg border border-border/50 bg-card/90 p-1.5 backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-primary/10"
                  title="Copiar URL"
                >
                  {copiedId === image.id ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                <a
                  href={buildPublicImageUrl(image.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border/50 bg-card/90 p-1.5 backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-primary/10"
                  title="Abrir imagem"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  onClick={() => onRenameOpen(image)}
                  className="rounded-lg border border-border/50 bg-card/90 p-1.5 backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-primary/10"
                  title="Renomear"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Remover esta imagem?")) {
                      void onDelete(image.id);
                    }
                  }}
                  className="rounded-lg border border-border/50 bg-card/90 p-1.5 backdrop-blur-sm transition-colors hover:border-destructive/50 hover:bg-destructive/20 hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Itens por página:</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              setLimit(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">Total: {imagePage?.total || 0}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <span className="px-2 py-1 text-xs">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}


