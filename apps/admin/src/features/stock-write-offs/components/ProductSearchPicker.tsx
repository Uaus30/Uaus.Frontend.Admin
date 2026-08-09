import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@workspace/ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui";
import { formatQuantity } from "@/lib/formatters";
import { getProductsPage } from "@/services/products.service";
import type { ProductSearchOption } from "../types";

type ProductSearchPickerProps = {
  /** Chamado quando o operador escolhe um produto. */
  onSelect: (product: ProductSearchOption) => void;
  /** IDs já presentes no rascunho, só para marcar visualmente. */
  selectedIds: number[];
  disabled?: boolean;
};

/**
 * ProductSearchPicker
 *
 * Busca de produto no molde do `TagMultiSelect`: `Command` com `shouldFilter`
 * desligado, porque quem filtra é a API — o catálogo é grande demais para vir
 * inteiro para o navegador.
 */
export function ProductSearchPicker({ onSelect, selectedIds, disabled }: ProductSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: productsPage, isFetching } = useQuery({
    queryKey: ["products-search-for-write-offs", debouncedSearch],
    enabled: open,
    queryFn: () => getProductsPage({ search: debouncedSearch.trim() || undefined, limit: 20 }),
  });

  const options: ProductSearchOption[] = (productsPage?.data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    barcode: product.barcode || null,
    stock: product.stock,
  }));

  function handleSelect(product: ProductSearchOption) {
    onSelect(product);
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-background font-normal"
        >
          <span className="text-muted-foreground">Buscar produto por nome ou código de barras...</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar produto..."
          />
          <CommandList>
            <CommandEmpty>
              {isFetching ? "Buscando produtos..." : "Nenhum produto encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((product) => (
                <CommandItem key={product.id} onSelect={() => handleSelect(product)}>
                  <Check
                    className={`h-4 w-4 ${selectedIds.includes(product.id) ? "opacity-100" : "opacity-0"}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{product.name}</span>
                    {product.barcode ? (
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {product.barcode}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Estoque: {formatQuantity(product.stock)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


