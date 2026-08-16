import { useEffect, useRef, useState } from "react";
import { useToast } from "@workspace/ui";
import type { EnrichedProduct } from "@/services/mappers";

/**
 * Abertura automática da modal de edição por link direto
 * (`/produtos?busca=<grupo>&editar=<id do produto>`).
 *
 * Existe para o botão de editar do balcão do PDV: o operador vê preço errado na
 * hora de vender, clica no lápis e espera cair NA EDIÇÃO daquele produto. Antes
 * disso o link só levava à lista filtrada, e quem chegava lá tinha que procurar
 * e clicar de novo — com a venda parada no caixa.
 *
 * O `busca` continua sendo o que traz o produto para a página; o `editar` só
 * escolhe a linha. Os dois são necessários: a lista é paginada e mostra grupos,
 * então sem o filtro o produto pedido pode simplesmente não estar na página 1.
 */

/** Parâmetro que carrega o id do produto a editar. */
const PARAM_EDITAR = "editar";

/**
 * Id pedido na URL, lido UMA vez na montagem.
 *
 * Continuar reagindo à URL reabriria a modal que o usuário acabou de fechar,
 * porque o parâmetro só some depois — ver {@link limparParametro}.
 */
function idInicialDaUrl(): number | null {
  if (typeof window === "undefined") return null;
  const bruto = new URLSearchParams(window.location.search).get(PARAM_EDITAR);
  if (bruto === null) return null;

  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Tira o `editar` da barra de endereços preservando o resto.
 *
 * Sem isso, fechar a modal e recarregar (ou voltar para a aba depois) abriria
 * tudo de novo: o link é uma instrução de uma vez só, não um estado da tela.
 */
function limparParametro(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM_EDITAR)) return;

  url.searchParams.delete(PARAM_EDITAR);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

type UseProductDeepLinkParams = {
  /** Carregamento da listagem inteira, incluindo os atributos em cascata. */
  isLoading: boolean;
  /** Linhas da página atual, já enriquecidas — o mesmo objeto que o botão de editar da tabela entrega. */
  enrichedProducts: EnrichedProduct[];
  /** `openModal` do `useProductEditor`. */
  openModal: (product?: EnrichedProduct) => void;
};

export function useProductDeepLink({
  isLoading,
  enrichedProducts,
  openModal,
}: UseProductDeepLinkParams): void {
  const [idPedido] = useState(idInicialDaUrl);
  const jaResolvido = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (idPedido === null || jaResolvido.current || isLoading) return;

    // A tabela mostra UM produto representante por grupo. Quando o produto
    // pedido é uma variação, ele não é o representante e o id não bate — mas o
    // grupo é o mesmo, e a modal edita o grupo inteiro. Por isso a linha única
    // do filtro serve de segunda chance: é o produto certo, por outro caminho.
    const alvo =
      enrichedProducts.find((produto) => produto.id === idPedido) ??
      (enrichedProducts.length === 1 ? enrichedProducts[0] : undefined);

    jaResolvido.current = true;
    limparParametro();

    if (!alvo) {
      // Silenciar aqui seria o pior desfecho: a pessoa clicou em "editar", a
      // aba abriu numa lista e nada explica por que a modal não veio.
      toast({
        title: "Produto não encontrado no catálogo",
        description: "Ajuste a busca e use o botão de editar da linha.",
        variant: "destructive",
      });
      return;
    }

    openModal(alvo);
  }, [enrichedProducts, idPedido, isLoading, openModal, toast]);
}
