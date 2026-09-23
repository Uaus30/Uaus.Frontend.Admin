import { useQuery } from "@tanstack/react-query";
import { getProductById } from "@/services/products.service";

/**
 * O produto como o servidor o tem AGORA — custo da última entrada e saldo —, na
 * mesma consulta (`product-for-entry`) que a aba Estoque e a contagem invalidam
 * ao gravar.
 *
 * É hook porque dois blocos da aba Dados leem dela: "Último custo" e "Estoque
 * atual" (`ProductCostAndStock`) e a margem abaixo do preço (`ProductPricing`).
 * Com a mesma chave, o React Query faz UMA requisição para os dois, e a margem
 * se refaz sozinha quando uma entrada nova troca o custo com a tela aberta.
 *
 * @param productId Id do produto simples; `null` no cadastro novo e no grupo
 *   com variações — e aí não há consulta.
 */
export function useProductForEntry(productId: number | null) {
  return useQuery({
    queryKey: ["product-for-entry", productId],
    enabled: productId !== null,
    queryFn: () => getProductById(productId as number),
  });
}
