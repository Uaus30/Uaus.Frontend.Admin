import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce, useToast } from "@workspace/ui";
import {
  PROMOTION_TYPE,
  deletePromotion,
  endPromotionNow,
  getGetPromotionByIdQueryKey,
  getGetPromotionsQueryKey,
  useGetPromotions,
  type PromotionTypeCode,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import {
  promotionCreatePathname,
  promotionDetailPathname,
  promotionScreenFromPathname,
  promotionsListPathname,
  type PromotionScreen,
} from "../promotion-route";
import { promotionSituation } from "./promotionRules";
import type { PromotionRow } from "../types";

/** Itens por página na tabela de promoções. */
export const PAGE_SIZE = 10;

/** Valor do `Select` do filtro que representa "todos os tipos" — o Radix recusa item vazio. */
export const TODOS_OS_TIPOS = "todos";

/**
 * Controlador da tela de Promoções: listagem, filtros, navegação entre as três
 * telas e as duas ações de linha.
 *
 * A página não contém query nem mutação — ela desenha o que este hook devolve.
 */
export function usePromotions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [screen, setScreen] = useState<PromotionScreen>(() =>
    promotionScreenFromPathname(window.location.pathname),
  );
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<PromotionTypeCode | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);

  const search = useDebounce(searchInput, 300);

  const { data, isLoading } = useGetPromotions({
    search: search || undefined,
    type: typeFilter ?? undefined,
    onlyActive: onlyActive || undefined,
    page,
    limit: PAGE_SIZE,
  });

  /**
   * A situação é calculada AQUI, e não na linha da tabela: a tabela é componente
   * puro, e um cálculo com `new Date()` dentro dela mudaria de resposta a cada
   * render sem nada acusar.
   */
  const promotions = useMemo<PromotionRow[]>(
    () => (data?.data ?? []).map((item) => ({ ...item, situation: promotionSituation(item) })),
    [data?.data],
  );

  /**
   * Trocar filtro volta para a PÁGINA 1.
   *
   * Sem isto, quem está na página 3 e busca "copo" (2 resultados) recebe uma
   * lista vazia — e o bloco de paginação some junto, porque o total não passa do
   * tamanho da página. Não sobra nem um "Anterior" para voltar. É o mesmo
   * cuidado de `useCoupons` e `useCampaigns`.
   */
  const comReset = useCallback(<T>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }, []);

  // ------------------------------------------------------------- navegação

  /**
   * O voltar do navegador fecha o cadastro e o detalhe.
   *
   * Sem isto, quem abre a promoção e aperta "voltar" sai da tela inteira — a
   * listagem e o detalhe dividem a mesma entrada de rota, então o histórico é a
   * única coisa que distingue os dois.
   */
  useEffect(() => {
    const aoVoltar = () => setScreen(promotionScreenFromPathname(window.location.pathname));
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);

  const irPara = useCallback((destino: PromotionScreen, pathname: string) => {
    // A marca no estado é o que distingue a entrada que ESTA tela empilhou —
    // ver `voltarParaLista`.
    window.history.pushState({ promocoes: true }, "", pathname);
    setScreen(destino);
  }, []);

  const abrirNova = useCallback(() => irPara({ kind: "nova" }, promotionCreatePathname()), [irPara]);

  const abrirDetalhe = useCallback(
    (id: number) => irPara({ kind: "detalhe", id }, promotionDetailPathname(id)),
    [irPara],
  );

  /**
   * Volta para a listagem DEVOLVENDO a entrada do histórico, quando foi esta tela
   * que a empilhou.
   *
   * Empilhar uma terceira entrada faria o "voltar" do navegador reabrir o
   * cadastro que a pessoa acabou de fechar. É o mesmo desenho de
   * `useProductDetailHistory`.
   */
  const voltarParaLista = useCallback(() => {
    if (window.history.state?.promocoes) {
      window.history.back();
      return;
    }

    irPara({ kind: "lista" }, promotionsListPathname());
  }, [irPara]);

  // ---------------------------------------------------------------- ações

  /**
   * Invalida os dois prefixos.
   *
   * O detalhe tem prefixo próprio justamente para não ser arrastado por
   * casamento parcial — e por isso precisa ser invalidado nominalmente, senão a
   * tela de detalhe continua mostrando a promoção como ela era antes da ação.
   */
  const invalidar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetPromotionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPromotionByIdQueryKey() });
  }, [queryClient]);

  const endMutation = useMutation({
    mutationFn: (id: number) => endPromotionNow(id),
    onSuccess: () => {
      invalidar();
      toast({
        title: "Promoção encerrada",
        description: "O preço volta ao normal no balcão na próxima venda.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao encerrar a promoção",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePromotion(id),
    onSuccess: () => {
      invalidar();
      toast({ title: "Promoção excluída" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir a promoção",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  return {
    screen,
    promotions,
    pagination: data ? { page: data.page, total: data.total, totalPages: data.totalPages } : undefined,
    isLoading,
    page,
    setPage,
    searchInput,
    setSearchInput: comReset(setSearchInput),
    typeFilter,
    setTypeFilter: comReset(setTypeFilter),
    onlyActive,
    setOnlyActive: comReset(setOnlyActive),
    abrirNova,
    abrirDetalhe,
    voltarParaLista,
    /** Encerra agora, preservando a janela em que a promoção valeu. */
    encerrar: (id: number) => endMutation.mutateAsync(id),
    excluir: (id: number) => deleteMutation.mutateAsync(id),
    isBusy: endMutation.isPending || deleteMutation.isPending,
    tipos: [PROMOTION_TYPE.Everyday, PROMOTION_TYPE.Flash] as const,
  };
}
