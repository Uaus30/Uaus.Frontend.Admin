import { useState } from "react";
import { Button, Input, useDebounce } from "@workspace/ui";
import { buildPublicImageUrl, useGetProductTable } from "@workspace/api-client-react";
import { Check, Search } from "lucide-react";

/** Quantos produtos a busca mostra por vez. */
const LIMITE = 8;

interface ProductGroupPickerProps {
  /** Produto escolhido, ou nulo. */
  value: number | null;
  /** Nome do escolhido, para a tela não consultar de novo só para exibir. */
  valueName: string;
  onChange: (productGroupId: number, productGroupName: string) => void;
  /** Bloqueia a troca — o produto de uma promoção já gravada não muda de dono. */
  disabled?: boolean;
}

/**
 * Escolha do produto promovido.
 *
 * Reusa `useGetProductTable`, que é a mesma consulta da listagem de Produtos:
 * uma requisição devolve grupo, preço e foto, e a busca é a mesma que o admin,
 * o PDV e a vitrine já usam. Um endpoint próprio de "busca de grupos" seria uma
 * segunda definição de busca para o mesmo catálogo.
 *
 * Não é um `Select`: com 894 grupos ativos, a lista suspensa obrigaria a rolar
 * até achar — o campo de busca responde ao que a pessoa já sabe do produto
 * (nome ou código de barras).
 */
export function ProductGroupPicker({ value, valueName, onChange, disabled }: ProductGroupPickerProps) {
  const [termo, setTermo] = useState("");
  const busca = useDebounce(termo, 300);

  const { data, isFetching } = useGetProductTable(
    { search: busca || undefined, page: 1, limit: LIMITE },
    // Sem termo e sem produto escolhido a lista não ajuda: os oito primeiros do
    // catálogo não são candidatos a promoção, são só os oito primeiros.
    { query: { enabled: busca.length >= 2 } },
  );

  if (value && !termo) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <span className="flex items-center gap-2 truncate">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate font-medium">{valueName}</span>
        </span>

        {!disabled && (
          <Button variant="ghost" size="sm" onClick={() => setTermo(" ")}>
            Trocar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={termo}
          disabled={disabled}
          placeholder="Busque pelo nome ou código de barras"
          className="pl-9"
          onChange={(event) => setTermo(event.target.value)}
        />
      </div>

      {busca.trim().length >= 2 && (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {isFetching && <p className="p-3 text-sm text-muted-foreground">Buscando...</p>}

          {!isFetching && (data?.data.length ?? 0) === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
          )}

          {data?.data.map((row) => (
            <button
              key={row.productGroupId}
              type="button"
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 hover-elevate"
              onClick={() => {
                onChange(row.productGroupId, row.productGroupName);
                setTermo("");
              }}
            >
              {row.images[0] ? (
                <img
                  src={buildPublicImageUrl(row.images[0].url)}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded bg-muted" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.productGroupName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.categoryName} · {row.variationCount} variação(ões)
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
