import { useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@workspace/ui";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui";
import { formatQuantity } from "@workspace/core";
import { getProductsPage } from "@/services/products.service";

/**
 * Produto devolvido pela busca.
 *
 * `price` e `costPrice` viajam junto porque a entrada de estoque sugere os dois
 * ao escolher o produto; a baixa de estoque simplesmente os ignora. Trazê-los
 * aqui evita uma segunda consulta só para preencher dois campos que a listagem
 * já devolveu.
 */
export type ProductSearchOption = {
  id: number;
  name: string;
  barcode: string | null;
  stock: number;
  /** Preço de venda vigente do cadastro. */
  price: number;
  /** Último custo apurado pelo backend a partir dos lotes. */
  costPrice: number;
};

/** Quantos produtos a busca traz por vez. */
const SEARCH_LIMIT = 20;

type ProductSearchPickerProps = {
  /** Chamado quando o operador escolhe um produto. */
  onSelect: (product: ProductSearchOption) => void;
  /** IDs já presentes no rascunho, só para marcar visualmente. */
  selectedIds: number[];
  disabled?: boolean;
  /** Texto do gatilho quando nada foi escolhido ainda. */
  placeholder?: string;
};

/**
 * ProductSearchPicker
 *
 * Busca de produto no molde do `TagMultiSelect`: `Command` com `shouldFilter`
 * desligado, porque quem filtra é a API — o catálogo passa de mil itens e não
 * cabe inteiro no navegador, muito menos dentro de um `Select`.
 *
 * Mora em `components/` e não numa feature porque baixa e entrada de estoque
 * fazem a mesma pergunta ao mesmo endpoint; duas cópias divergiriam no dia em
 * que uma delas ganhasse filtro por status ou por grupo.
 */
export function ProductSearchPicker({
  onSelect,
  selectedIds,
  disabled,
  placeholder = "Buscar produto por nome ou código de barras...",
}: ProductSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: productsPage, isFetching } = useQuery({
    queryKey: ["products-search", debouncedSearch],
    enabled: open,
    queryFn: () => getProductsPage({ search: debouncedSearch.trim() || undefined, limit: SEARCH_LIMIT }),
  });

  const options: ProductSearchOption[] = (productsPage?.data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    barcode: product.barcode || null,
    stock: product.stock,
    price: product.price,
    costPrice: product.costPrice,
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
          <span className="text-muted-foreground">{placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>{isFetching ? "Buscando produtos..." : "Nenhum produto encontrado."}</CommandEmpty>
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
