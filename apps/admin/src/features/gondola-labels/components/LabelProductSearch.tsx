import { ImageIcon, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@workspace/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { buildPublicImageUrl, type ProductPdvSearchDto } from "@workspace/api-client-react";
import { openProductEditTab } from "@/features/products/product-edit-link";

interface LabelProductSearchProps {
  search: string;
  setSearch: (value: string) => void;
  /** Dispara a busca na hora — o Enter do campo. */
  onSubmit: () => void;
  results: ProductPdvSearchDto[];
  isLoading: boolean;
  /** Existe busca em vigor. Separa "ainda não procurei" de "não achei". */
  hasSearched: boolean;
  /** A busca falhou — é diferente de não ter achado nada. */
  hasFailed: boolean;
  onAdd: (product: ProductPdvSearchDto) => void;
}

/**
 * Busca de produtos da aba de geração; cada resultado entra no lote pelo "+".
 *
 * A lista nasce VAZIA e só aparece depois de uma busca — antes ela abria com os
 * oito primeiros produtos do catálogo, que não respondem pergunta nenhuma e
 * ainda faziam parecer que o filtro já estava aplicado.
 *
 * A miniatura existe porque o catálogo tem muito nome parecido ("REFRIG COLA 2L"
 * em três marcas): conferir pela foto é mais rápido do que ler o código de
 * barras inteiro, e a etiqueta errada só aparece depois de impressa e colada na
 * gôndola. Ela é carregada com `lazy`, então as fotos fora da área visível da
 * lista rolável não chegam a ser baixadas.
 *
 * O lápis abre o produto no cadastro em nova aba — nova, e não navegação, porque
 * o lote montado até aqui só existe em memória e some se a tela sair.
 */
export function LabelProductSearch({
  search,
  setSearch,
  onSubmit,
  results,
  isLoading,
  hasSearched,
  hasFailed,
  onAdd,
}: LabelProductSearchProps) {
  return (
    <Card className="border-border/50 shadow-lg shadow-black/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Adicionar Produtos</CardTitle>
        <CardDescription>
          Busque por nome ou código de barras. A lista aparece a partir de 3 caracteres, ou no Enter.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-background pl-9"
          />
        </form>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : hasFailed ? (
          // "Nenhum produto encontrado" num 502 manda a pessoa procurar outro
          // termo quando o problema é que ninguém respondeu.
          <p className="py-4 text-center text-sm text-destructive">
            Não foi possível buscar agora. Tente de novo em instantes.
          </p>
        ) : !hasSearched ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Digite o nome ou o código de barras do produto.
          </p>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          // A rolagem é da LISTA, e não da página: com o teto de 20 resultados a
          // tela inteira crescia e empurrava para baixo a tabela do lote, que é
          // justamente onde a pessoa confere o que já adicionou.
          <ul className="flex max-h-[420px] flex-col divide-y divide-border/50 overflow-y-auto pr-1">
            {results.map((product) => (
              <li key={product.id} className="flex items-center gap-3 py-2">
                {product.imageUrl ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={buildPublicImageUrl(product.imageUrl)}
                    alt={product.name}
                    className="h-10 w-10 shrink-0 rounded-lg border border-border/50 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
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
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                  title="Editar produto no cadastro (abre em nova aba)"
                  aria-label={`Editar ${product.name} no cadastro`}
                  onClick={() => openProductEditTab(product)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  title="Adicionar ao lote"
                  aria-label={`Adicionar ${product.name} ao lote`}
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
