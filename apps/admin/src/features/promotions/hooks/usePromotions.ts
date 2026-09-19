import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";
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
  PROMOTIONS_PATH,
  promotionCreatePathname,
  promotionDetailPathname,
  promotionScreenFromPathname,
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

  /**
   * A tela vem da URL, e a URL vem do ROTEADOR.
   *
   * Antes isto era estado próprio sincronizado à mão com `pushState` e um
   * ouvinte de `popstate` — e faltava metade: o wouter navega por `pushState`,
   * que **não dispara `popstate`**. Clicar em "Promoções" no menu estando no
   * detalhe trocava a URL e deixava a tela no detalhe. Derivando da location, o
   * menu, o voltar do navegador e os botões da própria tela entram pelo mesmo
   * caminho.
   */
  const [location, setLocation] = useLocation();
  const screen = useMemo<PromotionScreen>(() => promotionScreenFromPathname(location), [location]);

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

  const abrirNova = useCallback(() => setLocation(promotionCreatePathname()), [setLocation]);

  const abrirDetalhe = useCallback((id: number) => setLocation(promotionDetailPathname(id)), [setLocation]);

  const voltarParaLista = useCallback(() => setLocation(PROMOTIONS_PATH), [setLocation]);

  /**
   * Fim do salvamento: volta para a listagem SUBSTITUINDO a entrada do histórico.
   *
   * `replace` e não `push` porque o formulário já cumpriu o papel dele: com
   * `push`, o voltar do navegador reabriria o cadastro que acabou de ser salvo —
   * e era isso que fazia o botão "Voltar" da tela precisar de dois cliques,
   * porque o primeiro desempilhava para uma tela igual à que estava na frente.
   */
  const aoSalvar = useCallback(() => setLocation(PROMOTIONS_PATH, { replace: true }), [setLocation]);

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
    aoSalvar,
    /** Encerra agora, preservando a janela em que a promoção valeu. */
    encerrar: (id: number) => endMutation.mutateAsync(id),
    excluir: (id: number) => deleteMutation.mutateAsync(id),
    isBusy: endMutation.isPending || deleteMutation.isPending,
    tipos: [PROMOTION_TYPE.Everyday, PROMOTION_TYPE.Flash] as const,
  };
}
