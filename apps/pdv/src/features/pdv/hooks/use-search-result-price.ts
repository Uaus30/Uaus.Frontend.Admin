import { useCallback, useMemo } from "react";
import { shelfPrice, toLocalTimestamp, type ShelfPrice } from "@workspace/core";
import { searchResultPrice, toShelfRules } from "@/lib/shelf-price";
import { usePdvStore } from "@/stores/use-pdv-store";

/**
 * O preço que cada linha da busca anuncia, já com a promoção.
 *
 * Lê a MESMA lista que o carrinho vai usar: com uma venda em curso, a lista e o
 * relógio congelados no primeiro item (`salePromotions`, `promotionInstant`);
 * com o caixa livre, a lista viva e agora. Sem isso, uma relâmpago que acabou às
 * 18h no meio de uma venda aberta às 17h58 apareceria na busca com o preço cheio
 * e entraria no carrinho com desconto — exatamente a dúvida que a busca existe
 * para tirar.
 *
 * **Na reedição de uma venda, nada de promoção** — o carrinho não aplica nenhuma
 * ali (`allocatedLines` em `stores/use-pdv-store.ts`), e a busca anunciando "por
 * R$ 9,90" para o item que entra a R$ 12,90 é a dúvida de novo (achado da revisão
 * de 05/10/2026).
 */
export function useSearchResultPrice(): (product: {
  price: number;
  productGroupId?: number | null;
}) => ShelfPrice {
  const promotions = usePdvStore((state) => state.salePromotions ?? state.promotions);
  const promotionInstant = usePdvStore((state) => state.promotionInstant);
  const editingSale = usePdvStore((state) => state.editingSaleId !== null);

  const rules = useMemo(() => toShelfRules(promotions), [promotions]);

  return useCallback(
    (product) =>
      editingSale
        ? shelfPrice(product.price, null)
        : searchResultPrice(rules, product, promotionInstant ?? toLocalTimestamp()),
    [rules, promotionInstant, editingSale],
  );
}
