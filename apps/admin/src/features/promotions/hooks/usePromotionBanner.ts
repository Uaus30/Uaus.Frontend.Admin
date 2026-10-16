import { useCallback, useMemo, useRef, useState } from "react";
import { useToast } from "@workspace/ui";
import { waitForScreenToSettle } from "@workspace/receipt";
import { useGetPromotions } from "@workspace/api-client-react";
import { buildPromotionBannerSheetHtml, openPromotionBannerTab } from "../banner-print";
import {
  DEFAULT_BANNER_EDIT,
  bannerCandidates,
  bannerItemsOf,
  bannerTitleOf,
  type PromotionBannerEdit,
} from "./promotionBannerRules";
import type { PromotionRow } from "../types";

/**
 * Quantas promoções a modal pede de uma vez.
 *
 * Só as ATIVAS (o indicador), e a situação é filtrada aqui — a API não filtra
 * por vigência, e a listagem da tela é de 10 por página. Cem cobre meses numa
 * loja que faz uma relâmpago por semana; se um dia não cobrir, o que falta é a
 * encerrada mais antiga, que a modal não mostraria mesmo.
 */
export const BANNER_CANDIDATES_LIMIT = 100;

/**
 * Controlador da modal "Imprimir Banner": a lista das promoções que valem um
 * cartaz, o que a pessoa marcou e reescreveu, e a abertura da folha.
 *
 * Mora fora do `usePromotions` porque é um assunto inteiro, e porque a página
 * já recebe de lá tudo o que a listagem precisa.
 */
export function usePromotionBanner() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  /**
   * As edições SOBREVIVEM ao fechar da modal, de propósito: quem imprime
   * costuma reimprimir na hora (papel preso, folha torta), e remontar a
   * seleção e o nome reescrito a cada vez é o que a aba aberta e esta memória
   * evitam. A edição de uma promoção que saiu da lista não produz banner
   * (`bannerItemsOf`).
   */
  const [edits, setEdits] = useState<Record<number, PromotionBannerEdit | undefined>>({});

  /** O texto da faixa, como digitado. Vazio = "PROMOÇÃO" (`bannerTitleOf`). */
  const [title, setTitle] = useState("");

  // Só consulta com a modal aberta: a lista de promoções da tela é outra
  // query, de 10 por página, e esta não precisa existir antes do clique.
  const { data, isLoading } = useGetPromotions(
    { onlyActive: true, page: 1, limit: BANNER_CANDIDATES_LIMIT },
    { query: { enabled: open } },
  );

  /**
   * A situação é calculada AQUI, e não na linha da modal — a mesma razão do
   * `usePromotions`: a modal é componente puro, e um `new Date()` dentro dela
   * mudaria de resposta a cada render sem nada acusar.
   */
  const candidates = useMemo(() => bannerCandidates(data?.data ?? []), [data?.data]);

  const editOf = useCallback(
    (promotion: PromotionRow): PromotionBannerEdit => edits[promotion.id] ?? DEFAULT_BANNER_EDIT,
    [edits],
  );

  const patch = useCallback((id: number, change: Partial<PromotionBannerEdit>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_BANNER_EDIT), ...change } }));
  }, []);

  const toggle = useCallback((promotion: PromotionRow) => {
    setEdits((prev) => {
      const atual = prev[promotion.id] ?? DEFAULT_BANNER_EDIT;
      return { ...prev, [promotion.id]: { ...atual, selected: !atual.selected } };
    });
  }, []);

  const setName = useCallback(
    (promotion: PromotionRow, name: string) => patch(promotion.id, { name }),
    [patch],
  );

  const setCopies = useCallback(
    (promotion: PromotionRow, copies: number) => patch(promotion.id, { copies }),
    [patch],
  );

  const items = useMemo(() => bannerItemsOf(candidates, edits), [candidates, edits]);
  const bannerCount = useMemo(() => items.reduce((total, item) => total + item.copies, 0), [items]);

  /**
   * Uma impressão em voo por vez.
   *
   * Durante a animação de saída a modal continua montada e o botão clicável;
   * um duplo clique (hábito de balcão) disparava dois `imprimir`. O primeiro
   * `window.open` consome a ativação do clique, o segundo volta `null`, e a
   * modal reaparecia com o aviso de pop-up bloqueado — um diagnóstico falso
   * (achado da revisão, 16/10/2026). Ref, e não estado: é guarda, não desenho.
   */
  const printing = useRef(false);

  /**
   * Fecha a modal, espera a animação de saída terminar e SÓ ENTÃO abre a aba.
   *
   * A ordem é correção, não polimento (achado do dono no primeiro uso,
   * 16/10/2026): a aba nova chama `window.print()` logo que carrega, e isso
   * congela o processo que ela divide com a aba do admin. Abrindo a aba primeiro,
   * o congelamento caía no meio da animação de saída da modal e o `Presence` do
   * Radix nunca recebia o `animationend` — a modal ficava na tela, logicamente
   * fechada, com o X sem efeito. É o mesmo defeito que o cupom do PDV já teve
   * (`waitForScreenToSettle`, no pacote do cupom, existe por isso).
   *
   * O `window.open` continua dentro da ativação do clique: o Chrome aceita
   * pop-up por 5 segundos depois do gesto, e a espera tem teto de 400 ms. Se
   * ainda assim o navegador segurar, a modal volta para a pessoa tentar de novo.
   */
  const imprimir = useCallback(async () => {
    if (items.length === 0 || printing.current) return;
    printing.current = true;

    try {
      const html = buildPromotionBannerSheetHtml(items, bannerTitleOf(title));

      setOpen(false);
      await waitForScreenToSettle();

      if (!openPromotionBannerTab(html)) {
        setOpen(true);
        toast({
          title: "O navegador bloqueou a aba da impressão",
          description: "Libere as janelas pop-up para este endereço e clique em Imprimir de novo.",
          variant: "destructive",
        });
      }
    } finally {
      printing.current = false;
    }
  }, [items, title, toast]);

  const abrir = useCallback(() => setOpen(true), []);

  return {
    open,
    abrir,
    onOpenChange: setOpen,
    candidates,
    isLoading,
    title,
    setTitle,
    editOf,
    toggle,
    setName,
    setCopies,
    /** Quantos banners saem no papel, somadas as cópias. */
    bannerCount,
    imprimir,
  };
}
