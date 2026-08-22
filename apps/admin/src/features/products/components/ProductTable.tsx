import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { PRODUCT_STATUS, enumCode } from "@workspace/api-client-react";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { buildPublicImageUrl } from "@/services/core";
import {
  Edit2,
  ImageIcon,
  Loader2,
  Search,
  Trash2,
  AlertTriangle,
  MoreVertical,
  Package,
  History,
} from "lucide-react";
import type { EnumOptionDto } from "@workspace/api-client-react";
import type { ProductTableRow } from "../types";
import React, { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui";
import { Dialog, DialogContent, DialogTitle } from "@workspace/ui";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@workspace/ui";
import { useLocation } from "wouter";

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
  enrichedProducts: ProductTableRow[];
  statusOptions: EnumOptionDto[];
  onEdit: (product: ProductTableRow) => void;
  onDelete: (product: ProductTableRow) => void;
  onViewHistory?: (product: ProductTableRow) => void;
  onUpdatePrice?: (product: ProductTableRow, newPrice: number) => Promise<void>;
  updatingPriceId?: number | null;
  onUpdateStock?: (product: ProductTableRow, newStock: number) => Promise<void>;
  updatingStockId?: number | null;
  onSearchInternetImage?: (product: ProductTableRow) => void;
};

function CurrencyInputInline({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (val: number) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value.toFixed(2).replace(".", ","));

  // Sync value when it changes from outside
  React.useEffect(() => {
    if (!focused) {
      setLocalValue(value.toFixed(2).replace(".", ","));
    }
  }, [value, focused]);

  const handleBlurOrEnter = () => {
    setFocused(false);
    const numericValue = Number(localValue.replace(",", "."));
    if (!isNaN(numericValue) && numericValue !== value) {
      onSave(numericValue);
    } else {
      setLocalValue(value.toFixed(2).replace(".", ","));
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={focused ? localValue : value.toFixed(2).replace(".", ",")}
      disabled={disabled}
      onChange={(e) => {
        let val = e.target.value;
        val = val.replace(/\./g, ",");
        val = val.replace(/[^\d,]/g, "");
        const parts = val.split(",");
        if (parts.length > 2) {
          val = parts[0] + "," + parts.slice(1).join("");
        }
        setLocalValue(val);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={handleBlurOrEnter}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-20 bg-transparent border-transparent hover:border-border/50 focus:bg-background focus:border-border px-1.5 font-medium text-orange-500 text-left shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
    />
  );
}

function StockInputInline({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (val: number) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  React.useEffect(() => {
    if (!focused) {
      setLocalValue(String(value));
    }
  }, [value, focused]);

  const handleBlurOrEnter = () => {
    setFocused(false);
    const numericValue = Number(localValue);
    if (!isNaN(numericValue) && numericValue !== value) {
      onSave(numericValue);
    } else {
      setLocalValue(String(value));
    }
  };

  const isLowStock = value < 10;

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="numeric"
        value={focused ? localValue : String(value)}
        disabled={disabled}
        onChange={(e) => {
          let val = e.target.value;
          val = val.replace(/[^\d]/g, "");
          setLocalValue(val);
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={handleBlurOrEnter}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className={`h-7 w-12 text-center px-1 font-semibold rounded-md border text-xs focus-visible:ring-1 focus-visible:ring-primary/30 transition-all duration-150 shadow-none ${
          focused
            ? "bg-background border-border text-foreground"
            : isLowStock
              ? "bg-destructive/20 border-transparent text-destructive hover:border-destructive/30"
              : "bg-secondary border-transparent text-secondary-foreground hover:border-secondary-foreground/20"
        }`}
      />
      <span className="text-xs text-muted-foreground font-semibold select-none">un</span>
    </div>
  );
}

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
  onViewHistory,
  onUpdatePrice,
  updatingPriceId,
  onUpdateStock,
  updatingStockId,
  onSearchInternetImage,
}: ProductTableProps) {
  const [productToDelete, setProductToDelete] = useState<ProductTableRow | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [, setLocation] = useLocation();
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
              <th className="px-6 py-4">Tags</th>
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
                  <ContextMenu key={`${product.id}-${index}`}>
                    <ContextMenuTrigger asChild>
                      <tr className="border-b border-border/50 transition-colors hover:bg-muted/20">
                        <td className="px-6 py-4">
                          <div className="relative h-10 w-10 group/img w-max">
                            {mainImage ? (
                              <HoverCard openDelay={0} closeDelay={0}>
                                <HoverCardTrigger asChild>
                                  <img
                                    loading="lazy"
                                    decoding="async"
                                    src={buildPublicImageUrl(mainImage.url)}
                                    alt={mainImage.name}
                                    className="h-10 w-10 rounded-lg border border-border/50 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      setSelectedImage({ url: mainImage.url, name: mainImage.name })
                                    }
                                  />
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 h-80 p-0 overflow-hidden border-border/50 shadow-2xl rounded-xl">
                                  <img
                                    loading="lazy"
                                    decoding="async"
                                    src={buildPublicImageUrl(mainImage.url)}
                                    alt={mainImage.name}
                                    className="w-full h-full object-cover"
                                  />
                                </HoverCardContent>
                              </HoverCard>
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                                <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSearchInternetImage?.(product);
                              }}
                              className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow hover:scale-110 active:scale-95 transition-transform"
                              title="Buscar imagem na internet (pelo nome e código de barras)"
                            >
                              <Search className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td
                          className="px-6 py-4 font-medium text-foreground cursor-pointer hover:text-primary hover:underline transition-colors"
                          onClick={() => onEdit(product)}
                        >
                          {product.name}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{product.department?.name || "-"}</td>
                        <td className="px-6 py-4 text-muted-foreground">{product.category?.name || "-"}</td>
                        <td className="px-6 py-4 font-medium text-orange-500">
                          {product.productGroup?.hasVariations ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-orange-500">
                                {formatCurrency(product.price)}
                              </span>
                              <span className="text-[10px] text-orange-500 font-semibold uppercase mt-0.5">
                                Variações
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-orange-500 font-semibold">R$</span>
                              <CurrencyInputInline
                                value={product.price}
                                onSave={(newPrice) => onUpdatePrice?.(product, newPrice)}
                                disabled={updatingPriceId === product.id}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {product.productGroup?.hasVariations ? (
                            <div className="flex flex-col">
                              <span
                                className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold w-max ${product.stock < 10 ? "bg-destructive/20 text-destructive" : "bg-secondary text-secondary-foreground"}`}
                              >
                                {product.stock} un
                              </span>
                              <span className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">
                                Variações
                              </span>
                            </div>
                          ) : (
                            <StockInputInline
                              value={product.stock}
                              onSave={(newStock) => onUpdateStock?.(product, newStock)}
                              disabled={updatingStockId === product.id}
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {product.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  borderColor: tag.color,
                                  color: tag.color,
                                  backgroundColor: `${tag.color}15`,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              enumCode(product.status, PRODUCT_STATUS) === PRODUCT_STATUS.Active
                                ? "default"
                                : "outline"
                            }
                          >
                            {statusOptions.find(
                              (option) => option.id === enumCode(product.status, PRODUCT_STATUS),
                            )?.name ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 border-border/50 bg-card">
                                <DropdownMenuItem
                                  onClick={() => onEdit(product)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setLocation(`/estoque/entradas?productId=${product.id}`)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  Estoque
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onViewHistory?.(product)}
                                  className="cursor-pointer gap-2"
                                >
                                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                                  Histórico
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setProductToDelete(product)}
                                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-36 border-border/50 bg-card">
                      <ContextMenuItem onClick={() => onEdit(product)} className="cursor-pointer gap-2">
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Editar
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => setLocation(`/estoque/entradas?productId=${product.id}`)}
                        className="cursor-pointer gap-2"
                      >
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        Estoque
                      </ContextMenuItem>
                      {onViewHistory && (
                        <ContextMenuItem
                          onClick={() => onViewHistory(product)}
                          className="cursor-pointer gap-2"
                        >
                          <History className="h-3.5 w-3.5 text-muted-foreground" />
                          Histórico
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem
                        onClick={() => setProductToDelete(product)}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
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
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">Total: {productPageTotal}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </Button>
          <span className="px-2 text-xs">
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
      <AlertDialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="border-border/50 bg-card sm:max-w-[450px]">
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2">
              Você está prestes a excluir o produto{" "}
              <span className="font-bold text-foreground">"{productToDelete?.name}"</span>. Esta ação é
              permanente e não poderá ser desfeita.
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
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-[600px] border-border/50 bg-black/95 p-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col items-center justify-center gap-0"
        >
          <DialogTitle className="sr-only">Visualizar Imagem</DialogTitle>
          {selectedImage && (
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <img
                loading="lazy"
                decoding="async"
                src={buildPublicImageUrl(selectedImage.url)}
                alt={selectedImage.name}
                className="max-h-[500px] max-w-[500px] rounded-lg object-contain shadow-2xl w-auto h-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
