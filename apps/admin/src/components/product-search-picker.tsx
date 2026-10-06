import { useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@workspace/ui";
import { Command, CommandEmpty, CommandInput, CommandList } from "@workspace/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui";
import { getProductsPage } from "@/services/products.service";
import { toProductSearchOption, type ProductSearchOption } from "./product-search-option";
import { ProductSearchResults } from "./product-search-results";

export type { ProductSearchOption };

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
 *
 * As linhas (foto, preço, estoque) são do `ProductSearchResults`.
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

  const options: ProductSearchOption[] = (productsPage?.data ?? []).map(toProductSearchOption);

  function handleSelect(product: ProductSearchOption) {
    onSelect(product);
    setSearch("");
    setOpen(false);
  }

  return (
    // `modal`: as três telas que usam a busca (compra, recebimento e baixa) a
    // abrem DENTRO de um diálogo, e a lista vai para um portal fora dele. O
    // diálogo trava a rolagem de tudo o que está fora da caixa dele, e a roda
    // do mouse morria na lista — a barra aparecia, mas só andava arrastada
    // (relatado pelo dono em 06/10/2026). Modal, a busca vira a trava mais
    // recente, e a rolagem vale dentro dela.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-background font-normal"
        >
          {/* `truncate` + `min-w-0`: o botão do kit não quebra linha, e o texto
              de ~85 letras do recebimento ("Veio uma variação que não estava no
              pedido?...") vazava ~250px no celular, fazendo o diálogo inteiro
              deslizar de lado. */}
          <span className="min-w-0 truncate text-muted-foreground">{placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar produto..." />
          {/* Mais alta que os 300px do kit: com a miniatura a linha cresce, e
              cinco produtos por vez é pouco para comparar parecidos. */}
          <CommandList className="max-h-[360px]">
            <CommandEmpty>{isFetching ? "Buscando produtos..." : "Nenhum produto encontrado."}</CommandEmpty>
            <ProductSearchResults options={options} selectedIds={selectedIds} onSelect={handleSelect} />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
