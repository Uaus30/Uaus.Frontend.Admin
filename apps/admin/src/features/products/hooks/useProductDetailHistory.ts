import { useEffect, useRef } from "react";
import {
  productDetailPathname,
  productGroupIdFromPathname,
  productsListPathname,
} from "../product-detail-route";

/**
 * Histórico do navegador a serviço da tela de detalhe do produto.
 *
 * O detalhe TEM rota — `/produtos/<grupo>/detalhes` —, mas divide a entrada do
 * `<Switch>` com a listagem para a página não desmontar entre as duas (o
 * porquê está em `product-detail-route.ts`). Quem manda no que aparece na tela
 * continua sendo o `open`; este hook é quem mantém a barra de endereços e o
 * botão voltar de acordo com ele.
 *
 * O desenho é o clássico de tela que troca sem trocar de página:
 *
 * - abrir **empurra** uma entrada de histórico com o caminho do detalhe; o id
 *   que nasce de um salvar apenas **substitui** a entrada corrente;
 * - fechar pela interface devolve a entrada empurrada (`history.back()`), então
 *   o próximo voltar segue para onde o usuário estava antes de abrir;
 * - fechar pelo voltar do navegador é o `popstate` chegando: só fecha;
 * - a entrada de quem CHEGA por link já é a do detalhe, então nada é empurrado
 *   — e voltar dela sai da página, como em qualquer link direto.
 *
 * As escritas são de `history` direto, e não do `setLocation` do wouter, porque
 * o que está sendo manipulado é a PILHA (empurrar, substituir, voltar), não a
 * rota corrente. O wouter observa `pushState`/`replaceState`, então ele
 * acompanha de qualquer jeito.
 */

/** Marca da entrada de histórico empurrada por esta tela. */
const ESTADO_DETALHE = { uausDetalheProduto: true } as const;

function hrefDa(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

type UseProductDetailHistoryParams = {
  /** A tela de detalhe está aberta? */
  open: boolean;
  /** Id do grupo em edição; `null` em cadastro novo ainda não salvo. */
  productId: number | null;
  /** Há alterações não salvas? Decide se o voltar pergunta antes de fechar. */
  isDirty: boolean;
  /** Fecha a tela sem perguntar nada — a decisão já foi tomada. */
  close: () => void;
  /** O voltar do navegador esbarrou em alterações não salvas: perguntar. */
  interceptClose: () => void;
};

export function useProductDetailHistory({
  open,
  productId,
  isDirty,
  close,
  interceptClose,
}: UseProductDetailHistoryParams): void {
  /** A entrada corrente foi empurrada por esta tela? */
  const pushedRef = useRef(false);
  /** `open` da última vez que o efeito da URL rodou. */
  const eraAbertaRef = useRef(false);
  // Espelhos legíveis dentro do listener de popstate, que não re-assina a cada
  // render.
  const openRef = useRef(open);
  const dirtyRef = useRef(isDirty);
  const productIdRef = useRef(productId);
  const closeRef = useRef(close);
  const interceptRef = useRef(interceptClose);

  useEffect(() => {
    openRef.current = open;
    dirtyRef.current = isDirty;
    productIdRef.current = productId;
    closeRef.current = close;
    interceptRef.current = interceptClose;
  });

  /**
   * URL de agora com o CAMINHO refletindo o produto aberto.
   *
   * Cadastro novo ainda não salvo não tem id, e por isso fica no caminho da
   * listagem: uma rota `/produtos/null/detalhes` seria mentira, e o id aparece
   * sozinho no primeiro salvar, que só substitui esta entrada.
   */
  function urlDoDetalhe(): URL {
    const url = new URL(window.location.href);
    url.pathname =
      productIdRef.current != null ? productDetailPathname(productIdRef.current) : productsListPathname();
    return url;
  }

  // URL: espelha abrir/fechar e o id que nasce do primeiro salvar.
  useEffect(() => {
    if (open) {
      const url = urlDoDetalhe();

      if (eraAbertaRef.current) {
        // Já estava aberto: é o id que acabou de nascer de um salvar — a entrada
        // é a mesma, só ganha o id no caminho.
        window.history.replaceState(ESTADO_DETALHE, "", hrefDa(url));
      } else if (productId != null && productGroupIdFromPathname(window.location.pathname) === productId) {
        // Chegou por link/recarga: a entrada corrente JÁ é a do detalhe. Empurrar
        // outra criaria um voltar que não sai de lugar nenhum.
        pushedRef.current = false;
      } else {
        window.history.pushState(ESTADO_DETALHE, "", hrefDa(url));
        pushedRef.current = true;
      }
    } else if (eraAbertaRef.current) {
      if (pushedRef.current) {
        // Fechada pela interface: devolve a entrada da listagem que ficou embaixo.
        // O popstate que isso dispara encontra a tela já fechada e não faz nada.
        pushedRef.current = false;
        window.history.back();
      } else {
        const url = new URL(window.location.href);
        url.pathname = productsListPathname();
        window.history.replaceState(null, "", hrefDa(url));
      }
    }

    eraAbertaRef.current = open;
  }, [open, productId]);

  // Voltar do navegador: fecha a tela — ou segura a saída se há alterações.
  useEffect(() => {
    function onPopState() {
      if (!openRef.current) {
        // Entrada órfã no caminho do detalhe (avançar depois de fechar, por
        // exemplo): devolve para a listagem, senão a barra de endereços promete
        // um detalhe que a tela não está mostrando.
        if (productGroupIdFromPathname(window.location.pathname) === null) return;
        const url = new URL(window.location.href);
        url.pathname = productsListPathname();
        window.history.replaceState(null, "", hrefDa(url));
        return;
      }

      if (dirtyRef.current) {
        // O navegador já pulou; reempurra a entrada do detalhe para a URL não
        // ficar na da listagem com a tela aberta, e deixa a confirmação decidir.
        window.history.pushState(ESTADO_DETALHE, "", hrefDa(urlDoDetalhe()));
        pushedRef.current = true;
        interceptRef.current();
        return;
      }

      // O próprio navegador já caiu na entrada da listagem — só fecha.
      pushedRef.current = false;
      closeRef.current();
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
