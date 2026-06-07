import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { buildPublicImageUrl } from "@/services/core";
import { Edit2, ImageIcon, Loader2, Search, Trash2, AlertTriangle } from "lucide-react";
import type { EnrichedProduct } from "@/services/mappers";
import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ProductTableProps = {
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (value: number | ((current: number) => number)) => void;
  limit: number;
  setLimit: (value: number) => void;
  totalPages: number;
  productPageTotal: number;
  enrichedProducts: EnrichedProduct[];
  statusOptions: any[];
  onEdit: (product: EnrichedProduct) => void;
  onDelete: (product: EnrichedProduct) => void;
};

export function ProductTable({
  isLoading,
  search,
  setSearch,
  page,
  setPage,
  limit,
  setLimit,
  totalPages,
  productPageTotal,
  enrichedProducts,
  statusOptions,
  onEdit,
  onDelete,
}: ProductTableProps) {
  const [productToDelete, setProductToDelete] = useState<EnrichedProduct | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="border-b border-border/50 p-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="bg-background pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4 w-16">Imagem</th>
              <th className="px-6 py-4 min-w-[250px]">Nome</th>
              <th className="px-6 py-4">Departamento</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Preço</th>
              <th className="px-6 py-4">Estoque</th>
              <th className="px-6 py-4">Etiquetas</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : (
              enrichedProducts.map((product, index) => {
                const mainImage = product.images[0]?.image;

                return (
                  <tr key={`${product.id}-${index}`} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                    <td className="px-6 py-4">
                      {mainImage ? (
                        <img src={buildPublicImageUrl(mainImage.url)} alt={mainImage.name} className="h-10 w-10 rounded-lg border border-border/50 object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{product.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{product.department?.name || "-"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{product.category?.name || "-"}</td>
                    <td className="px-6 py-4 font-medium text-primary">{formatCurrency(product.price)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${product.stock < 10 ? "bg-destructive/20 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                        {product.stock} un
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {product.tags.map((tag) => (
                          <span key={tag.id} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: tag.color, color: tag.color, backgroundColor: `${tag.color}15` }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={product.status === 2 ? "default" : "outline"}>
                        {statusOptions.find((option) => option.id === product.status)?.name ?? product.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                          onClick={() => onEdit(product)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                          onClick={() => setProductToDelete(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
          <span className="ml-2">Total: {productPageTotal}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <span className="px-2 text-xs">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
            Próxima
          </Button>
        </div>
      </div>
      <AlertDialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="border-border/50 bg-card sm:max-w-[450px]">
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2">
              Você está prestes a excluir o produto <span className="font-bold text-foreground">"{productToDelete?.name}"</span>. 
              Esta ação é permanente e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-6">
            <AlertDialogCancel className="mt-0 sm:mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (productToDelete) {
                  onDelete(productToDelete);
                  setProductToDelete(null);
                }
              }}
            >
              Sim, excluir produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
