import { useEffect, useRef } from "react";

/**
 * Histórico do navegador a serviço da tela de detalhe do produto.
 *
 * A tela não é uma rota (`pages/products.tsx` explica por quê), mas quem a usa
 * não precisa saber disso: o id do grupo aparece na barra de endereços
 * (`/produtos?id=907`) e o botão voltar do navegador a fecha, como faria em
 * qualquer página. Tudo sem `popstate` seria possível de metade — a URL
 * mudaria, mas voltar sairia de `/produtos` inteiro.
 *
 * O desenho é o clássico de tela sem rota:
 *
 * - abrir **empurra** uma entrada de histórico com o `?id=`; o id que nasce de
 *   um salvar apenas **substitui** a entrada corrente;
 * - fechar pela interface devolve a entrada empurrada (`history.back()`), então
 *   o próximo voltar segue para onde o usuário estava antes de abrir;
 * - fechar pelo voltar do navegador é o `popstate` chegando: só fecha;
 * - a entrada de quem CHEGA por link (`/produtos?id=` colado na barra) já é a do
 *   detalhe, então nada é empurrado — e voltar dela sai da página, como em
 *   qualquer link direto.
 */

/** Parâmetro de URL que carrega o id do grupo em edição. */
export const PARAM_DETALHE = "id";

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

  /** URL de agora com o `?id=` refletindo o produto aberto. */
  function urlDoDetalhe(): URL {
    const url = new URL(window.location.href);
    if (productIdRef.current != null) {
      url.searchParams.set(PARAM_DETALHE, String(productIdRef.current));
    } else {
      url.searchParams.delete(PARAM_DETALHE);
    }
    return url;
  }

  // URL: espelha abrir/fechar e o id que nasce do primeiro salvar.
  useEffect(() => {
    if (open) {
      const url = urlDoDetalhe();

      if (eraAbertaRef.current) {
        // Já estava aberto: é o id que acabou de nascer de um salvar — a entrada
        // é a mesma, só ganha o parâmetro.
        window.history.replaceState(ESTADO_DETALHE, "", hrefDa(url));
      } else if (
        productId != null &&
        new URL(window.location.href).searchParams.get(PARAM_DETALHE) === String(productId)
      ) {
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
        url.searchParams.delete(PARAM_DETALHE);
        window.history.replaceState(null, "", hrefDa(url));
      }
    }

    eraAbertaRef.current = open;
  }, [open, productId]);

  // Voltar do navegador: fecha a tela — ou segura a saída se há alterações.
  useEffect(() => {
    function onPopState() {
      if (!openRef.current) {
        // Entrada órfã com `?id=` sobrando (avançar depois de fechar, por
        // exemplo): tira o parâmetro para a listagem não renascer "aberta".
        const url = new URL(window.location.href);
        if (!url.searchParams.has(PARAM_DETALHE)) return;
        url.searchParams.delete(PARAM_DETALHE);
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
