import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce, useToast } from "@workspace/ui";
import {
  PROMOTION_TYPE,
  createPromotion,
  getGetPromotionByIdQueryKey,
  getGetPromotionsQueryKey,
  updatePromotion,
  useGetPromotionById,
  useGetPromotionPreview,
} from "@workspace/api-client-react";
import { describeApiError, parseAmountOrNull } from "@workspace/core";
import {
  buildPromotionPayload,
  describeFormProblem,
  emptyPromotionForm,
  formFromPromotion,
  parsePositiveIntegerOrNaN,
  repeatFormFromPromotion,
} from "./promotionRules";
import { promotionRepeatSourceFromSearch } from "../promotion-route";
import type { PromotionForm } from "../types";

/**
 * Controlador do cadastro e do detalhe de uma promoção.
 *
 * @param promotionId Promoção que está sendo editada, ou `undefined` no cadastro novo.
 * @param onSaved Chamado depois de gravar — a página leva de volta para a listagem.
 */
export function usePromotionEditor(promotionId: number | undefined, onSaved: () => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<PromotionForm>(() => emptyPromotionForm());
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [confirmingBelowCost, setConfirmingBelowCost] = useState(false);

  /**
   * A promoção que este cadastro está copiando, quando veio de "Repetir".
   *
   * Lida uma vez, do `window.location`, e não por estado de rota: o cadastro é
   * uma tela, e um F5 no meio do preenchimento não pode devolver um formulário
   * em branco. Só vale no cadastro NOVO — repetir sobre um detalhe aberto
   * reescreveria a promoção que está na tela.
   */
  const [repeatSourceId] = useState(() =>
    promotionId ? undefined : promotionRepeatSourceFromSearch(window.location.search),
  );

  const { data: promotion, isLoading } = useGetPromotionById(promotionId);
  const { data: repeatSource, isLoading: isLoadingRepeat } = useGetPromotionById(repeatSourceId);

  /**
   * Preenche o formulário quando o detalhe chega.
   *
   * Ajuste de estado **durante o render**, e não num `useEffect`: é o padrão que
   * a documentação do React indica para "estado derivado de props que mudaram", e
   * é o que o lint cobra (`setState` síncrono dentro de efeito dispara renders em
   * cascata).
   *
   * A guarda é o ID, e não o `updatedAt`: depois de salvar, a invalidação traz a
   * promoção de novo, e reescrever o formulário ali apagaria o que a pessoa já
   * tivesse digitado depois do salvamento.
   */
  if (promotion && promotion.id !== loadedId) {
    setLoadedId(promotion.id);
    setForm(formFromPromotion(promotion));
  }

  // O mesmo ajuste em render, e pela mesma razão, para a promoção copiada. A
  // guarda pelo id impede que uma reconsulta em segundo plano (foco na janela)
  // apague o que a pessoa já corrigiu no formulário.
  if (repeatSource && repeatSource.id !== loadedId) {
    setLoadedId(repeatSource.id);
    setForm(repeatFormFromPromotion(repeatSource, new Date()));
  }

  // Os dois campos são digitados caractere a caractere; sem o debounce a prévia
  // dispararia uma requisição por tecla — "1000" na meta seriam quatro.
  const discountValue = useDebounce(form.discountValue, 300);
  const targetQuantity = useDebounce(form.targetQuantity, 300);

  const { data: preview, isFetching: isPreviewing } = useGetPromotionPreview({
    productGroupId: form.productGroupId ?? undefined,
    discountType: form.discountType,
    discountValue: parseAmountOrNull(discountValue) ?? 0,
    // `Number("1.000")` é 1 em JavaScript, e a meta viraria um investimento mil
    // vezes menor na tela. O parser do core entende o formato pt-BR; `NaN` vira
    // nulo aqui para a prévia não sumir com um 400 enquanto a pessoa digita — o
    // campo inválido é cobrado no submit.
    targetQuantity: normalizeTargetForPreview(targetQuantity),
  });

  const problem = useMemo(() => describeFormProblem(form), [form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPromotionPayload(form);
      return promotionId ? updatePromotion(promotionId, payload) : createPromotion(payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: getGetPromotionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPromotionByIdQueryKey() });

      toast({
        title: promotionId ? "Promoção atualizada" : "Promoção criada",
        description: "O preço passa a valer no balcão dentro da vigência.",
      });

      if (saved?.id) onSaved();
    },
    onError: (error) => {
      toast({
        title: promotionId ? "Erro ao atualizar a promoção" : "Erro ao criar a promoção",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  /**
   * Variações que ficariam abaixo do custo, pelo nome.
   *
   * O plano exige confirmação **nomeando o produto** para este caso: num grupo de
   * oito variações em que só uma custa mais que o preço promocional, um alerta na
   * coluna da direita não compete com o botão Salvar no alto da esquerda.
   */
  const belowCost = useMemo(
    () => (preview?.variations ?? []).filter((row) => row.promotionalPrice < row.costPrice),
    [preview?.variations],
  );

  function handleSubmit() {
    // A frase do problema é a mesma do servidor, e barrar aqui poupa o 400 —
    // mas as três recusas que dependem do banco (sobreposição, banner ocupado e
    // preço final acima do de tabela) continuam vindo de lá.
    if (problem) {
      toast({ title: "Confira o formulário", description: problem, variant: "destructive" });
      return;
    }

    // Vender abaixo do custo é decisão possível da loja — a isca da porta é
    // assim. Por isso confirma, e não recusa.
    if (belowCost.length > 0 && !confirmingBelowCost) {
      setConfirmingBelowCost(true);
      return;
    }

    setConfirmingBelowCost(false);
    saveMutation.mutate();
  }

  return {
    form,
    setForm,
    promotion,
    // Os DOIS estados de carga, cada um da sua query. Compor só o do detalhe não
    // fazia nada no modo "repetir" (query desabilitada tem `isLoading` falso no
    // React Query v5): num link lento a tela pintava o formulário vazio, e a
    // cópia que chegasse depois apagaria o que a pessoa já tivesse digitado.
    isLoading: (!!promotionId && isLoading) || (!!repeatSourceId && isLoadingRepeat),
    preview,
    isPreviewing,
    problem,
    handleSubmit,
    isSaving: saveMutation.isPending,
    isFlash: form.type === PROMOTION_TYPE.Flash,
    /** Variações abaixo do custo à espera de confirmação. Vazio quando não há. */
    belowCost,
    confirmingBelowCost,
    dismissBelowCost: () => setConfirmingBelowCost(false),
  };
}

/** Meta que a prévia aceita: inteiro positivo, ou nada. */
function normalizeTargetForPreview(value: string): number | null {
  const parsed = parsePositiveIntegerOrNaN(value);
  return parsed == null || Number.isNaN(parsed) ? null : parsed;
}
