import { Check, ImageIcon } from "lucide-react";
import { CommandGroup, CommandItem, ImageHoverZoom } from "@workspace/ui";
import { formatQuantity } from "@workspace/core";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { ShelfPriceView } from "@/components/shelf-price";
import { useShelfPrice } from "@/hooks/use-shelf-price";
import type { ProductSearchOption } from "./product-search-option";

type ProductSearchResultsProps = {
  options: ProductSearchOption[];
  /** IDs já presentes no rascunho, só para marcar visualmente. */
  selectedIds: number[];
  onSelect: (product: ProductSearchOption) => void;
};

/**
 * As linhas da busca de produto, no molde da busca do balcão e da de etiquetas
 * (pedido do dono, 06/10/2026): miniatura, nome inteiro, código e estoque, e o
 * preço à direita.
 *
 * A foto e o preço existem para separar produto parecido — "CABO CARREGADOR
 * IPHONE 1M [LEHMOX]" e "[ORIGINAL]" lado a lado, só com o código de barras para
 * diferenciar. Comprar ou baixar o produto errado só aparece no estoque, dias
 * depois. Passar o mouse na miniatura amplia (`ImageHoverZoom`); a ampliação
 * abre para a ESQUERDA porque a lista ocupa a largura da modal, e para a
 * direita ela cobriria as linhas que se está comparando.
 *
 * O nome não trunca, pela mesma razão do balcão: o fim do nome é onde mora o
 * colchete da variação.
 *
 * O preço já sai com a promoção que vale agora (`useShelfPrice`), como em toda
 * tela do admin que mostra preço. A lista de promoções só é consultada quando a
 * busca abre: este componente mora dentro do `PopoverContent`, que não monta
 * fechado.
 */
export function ProductSearchResults({ options, selectedIds, onSelect }: ProductSearchResultsProps) {
  const { shelfPriceOf } = useShelfPrice();

  return (
    <CommandGroup>
      {options.map((product) => (
        <CommandItem
          key={product.id}
          onSelect={() => onSelect(product)}
          // `group`: o texto apagado precisa clarear na linha destacada — cinza
          // sobre o fundo de destaque sumia (o estoque ficava ilegível).
          className="group gap-3 py-2"
        >
          <Check className={selectedIds.includes(product.id) ? "opacity-100" : "opacity-0"} />
          {product.imageUrl ? (
            <ImageHoverZoom
              src={buildPublicImageUrl(product.imageUrl)}
              alt=""
              side="left"
              className="h-10 w-10 shrink-0 cursor-zoom-in rounded-lg border border-border/50 bg-white object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50"
              aria-hidden="true"
            >
              <ImageIcon className="text-muted-foreground/50" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="break-words font-medium leading-tight">{product.name}</span>
            <span className="font-mono text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">
              {product.barcode ? `${product.barcode} · ` : ""}Estoque: {formatQuantity(product.stock)}
            </span>
          </div>
          {/* `size-3!`: o item do `Command` força 16px em todo svg de dentro, e o
              ícone do selo de promoção é de 12px, do tamanho do texto dele. */}
          <div className="shrink-0 text-sm [&_svg]:size-3!">
            <ShelfPriceView
              shelf={shelfPriceOf(product.productGroupId, product.price)}
              priceClassName="font-semibold"
              align="end"
            />
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
