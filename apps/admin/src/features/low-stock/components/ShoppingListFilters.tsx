import { Search } from "lucide-react";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import type { SupplierDto } from "@workspace/api-client-react";
import type { CityOption } from "../lib/shopping-list";

type ShoppingListFiltersProps = {
  /** Valor do seletor que não filtra nada ("Todos" e "Todas"). */
  allValue: string;
  supplierId: string;
  setSupplierId: (value: string) => void;
  supplierOptions: SupplierDto[];
  city: string;
  setCity: (value: string) => void;
  cityOptions: CityOption[];
  search: string;
  setSearch: (value: string) => void;
  minRecentSales: string;
  setMinRecentSales: (value: string) => void;
};

/**
 * Os filtros da Lista de Compras (14/10/2026): fornecedor e cidade — as duas
 * perguntas de quem planeja a viagem ("o que comprar na Master?", "o que trazer
 * de Maringá?") —, a busca e o mínimo de vendas em 30 dias.
 *
 * Os seletores abrem em "Todos"/"Todas" e ficam no começo da lista, fora da
 * ordem alfabética: é a opção de desfazer o filtro, e no meio das cidades ela
 * se perderia. Fornecedor segue a ordem de todo o admin (Shopee primeiro).
 */
export function ShoppingListFilters({
  allValue,
  supplierId,
  setSupplierId,
  supplierOptions,
  city,
  setCity,
  cityOptions,
  search,
  setSearch,
  minRecentSales,
  setMinRecentSales,
}: ShoppingListFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 basis-full sm:basis-64 lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, código de barras ou grade..."
          className="pl-9"
          aria-label="Buscar produto"
        />
      </div>
      <Select value={supplierId} onValueChange={setSupplierId}>
        <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Fornecedor">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>Todos os fornecedores</SelectItem>
          {supplierOptions.map((supplier) => (
            <SelectItem key={supplier.id} value={String(supplier.id)}>
              {supplier.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={city} onValueChange={setCity}>
        <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Cidade do fornecedor">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>Todas as cidades</SelectItem>
          {cityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
        Vendeu ao menos
        <Input
          type="number"
          min={1}
          step={1}
          value={minRecentSales}
          onChange={(event) => setMinRecentSales(event.target.value)}
          placeholder="un."
          aria-label="Vendeu ao menos, em 30 dias"
          className="h-9 w-20"
        />
        em 30d
      </label>
    </div>
  );
}
