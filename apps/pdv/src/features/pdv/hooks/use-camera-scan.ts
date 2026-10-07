import { useCallback } from "react";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import type { ScanFeedback } from "@workspace/ui";
import { searchProducts } from "@/lib/product-search";

export interface UseCameraScanParams {
  /** A API está respondendo. Decide a busca: servidor ou base local. */
  online: boolean;
  /** A entrada do balcão no carrinho; devolve se o produto entrou. */
  addProductToCart: (product: ProductPdvSearchDto) => boolean;
}

/**
 * O código lido pela câmera do celular vira item no carrinho (07/10/2026).
 *
 * No celular não há leitor de mão: a câmera faz o papel dele. A busca é a do
 * balcão (`searchProducts`, servidor ou base local — sem internet, a câmera
 * continua achando o produto), e só entra sozinho o produto com o código
 * **exato**, como no leitor de mão. A resposta vai para o aviso embaixo do
 * vídeo, que é para onde o operador está olhando.
 *
 * **A câmera fica aberta entre um produto e outro** — o contrário da tela de
 * Etiquetas do admin, que fecha a cada um. Lá se escolhe UMA etiqueta na
 * prateleira; aqui se passam os itens da compra, um atrás do outro, como no
 * balcão. Para a mesma unidade duas vezes, afasta-se o produto e aproxima-se de
 * novo (o filtro de repetição do leitor espera 2,5 s), ou soma-se no carrinho.
 *
 * @returns A função que recebe cada código e responde o aviso.
 */
export function useCameraScan({ online, addProductToCart }: UseCameraScanParams) {
  return useCallback(
    async (code: string): Promise<ScanFeedback> => {
      const wanted = code.trim();

      let found: ProductPdvSearchDto[];
      try {
        found = await searchProducts(wanted, { online });
      } catch (error) {
        return { tone: "error", message: describeApiError(error) };
      }

      const exact = found.filter((product) => (product.barcode ?? "").trim() === wanted);
      if (exact.length === 0) {
        return { tone: "warning", message: `Nenhum produto com o código ${wanted}.` };
      }
      // Dois cadastros com o mesmo código: escolher sozinho seria vender o
      // produto errado. A escolha volta para a busca, com a lista à vista.
      if (exact.length > 1) {
        return {
          tone: "warning",
          message: `${exact.length} produtos com o código ${wanted}. Feche e escolha pela busca.`,
        };
      }

      const [product] = exact;
      if (!addProductToCart(product)) {
        return {
          tone: "error",
          message:
            product.stock <= 0
              ? `${product.name}: sem estoque.`
              : `${product.name}: só há ${product.stock} no estoque.`,
        };
      }

      return { tone: "success", message: `${product.name} no carrinho.` };
    },
    [online, addProductToCart],
  );
}
