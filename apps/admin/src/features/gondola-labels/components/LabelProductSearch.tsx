import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/formatters";
import type { ProductDto } from "@workspace/api-client-react";

interface LabelProductSearchProps {
  search: string;
  setSearch: (value: string) => void;
  results: ProductDto[];
  isLoading: boolean;
  onAdd: (product: ProductDto) => void;
}

/** Busca de produtos da aba de geração; cada resultado entra no lote pelo botão +. */
export function LabelProductSearch({
  search,
  setSearch,
  results,
  isLoading,
  onAdd,
}: LabelProductSearchProps) {
  return (
    <Card className="border-border/50 shadow-lg shadow-black/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Adicionar Produtos</CardTitle>
        <CardDescription>Busque por nome ou código de barras.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-background pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/50">
            {results.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product.barcode?.trim() ? product.barcode : "Sem código de barras"}
                    {" · "}
                    {formatCurrency(product.price)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  title="Adicionar ao lote"
                  onClick={() => onAdd(product)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
