import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce, useToast } from "@workspace/ui";
import {
  PROMOTION_TYPE,
  createPromotion,
  getGetPromotionByIdQueryKey,
  getGetPromotionsQueryKey,
  updatePromotion,
  useGetCompanySettings,
  useGetPromotionById,
  useGetPromotionPreview,
} from "@workspace/api-client-react";
import { describeApiError, parseAmountOrNull } from "@workspace/core";
import { buildPublicImageUrl } from "@/services/core";
import {
  buildPromotionPayload,
  describeFormProblem,
  emptyPromotionForm,
  formFromPromotion,
  parsePositiveIntegerOrNaN,
  repeatFormFromPromotion,
} from "./promotionRules";
import { usePromotionArtwork, uploadPendingArtwork } from "./usePromotionArtwork";
import { promotionRepeatSourceFromSearch } from "../promotion-route";
import type { PromotionPromptInput } from "./promotionPrompt";
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

  // `isNew` muda UMA recusa: a relâmpago cujo horário de hoje já passou. Cadastro
  // novo com a janela vencida nasceria "Encerrada"; a mesma promoção EDITADA é
  // gesto legítimo — corrigir a meta depois que ela acabou.
  const problem = useMemo(() => describeFormProblem(form, { isNew: !promotionId }), [form, promotionId]);

  const { pickArtwork, clearArtwork, rememberUploaded } = usePromotionArtwork(setForm);

  // Endereço e nome da loja saem de Configurações da Empresa — os mesmos campos
  // que o cupom imprime. Duas das três artes publicadas trazem o endereço, e é
  // por isso que o bloco é condicional em vez de obrigatório.
  const { data: empresa } = useGetCompanySettings();

  /**
   * O que o prompt precisa, ou `null` quando ainda não dá para montá-lo.
   *
   * Depende da PRÉVIA, e não do formulário: o preço que vai no cartaz é o
   * promocional resolvido por variação, que é a mesma conta do balcão. Montá-lo
   * aqui a partir do percentual digitado seria a segunda implementação do preço
   * — exatamente o que a prévia existe para impedir.
   */
  const promptInput = useMemo<Omit<PromotionPromptInput, "format" | "signature"> | null>(() => {
    if (!form.productGroupId || !preview || preview.variations.length === 0) return null;

    const vigencia = buildPromotionPayload(form);

    return {
      productName: form.productGroupName || preview.productGroupName,
      productDescription: preview.productGroupDescription,
      price: preview.promotionalPriceMin,
      priceMax: preview.promotionalPriceMax,
      maxQuantityPerSale: parsePositiveIntegerOrNaN(form.maxQuantityPerSale) ?? undefined,
      validFrom: vigencia.validFrom,
      validUntil: vigencia.validUntil,
      addressLine: empresa?.addressLine,
      cityState: empresa?.cityState,
    };
  }, [form, preview, empresa?.addressLine, empresa?.cityState]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // As artes sobem PRIMEIRO, e só então o payload é montado: o id de uma
      // imagem que ainda não existe não pode entrar na promoção. Falha de upload
      // derruba a mutação inteira — meia promoção gravada, com a arte do feed e
      // sem a do story, seria pior que nenhuma.
      const nome = form.productGroupName || "Promoção";
      const feedImageId = await uploadPendingArtwork(form.feedImage, `${nome} 4x5`, "4:5", (id) =>
        rememberUploaded("feed", id),
      );
      const storyImageId = await uploadPendingArtwork(form.storyImage, `${nome} 9x16`, "9:16", (id) =>
        rememberUploaded("story", id),
      );

      const payload = buildPromotionPayload(form, { feedImageId, storyImageId });
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
    /*
     * Reavaliada AQUI, e não lida do `useMemo`.
     *
     * Uma das recusas é de HORA ("esta relâmpago já teria terminado"), e o
     * relógio não está nas dependências do memo — ele congela no último render.
     * O caminho é real e nasceu nesta mesma fase: 17h50, a pessoa abre a modal
     * do prompt, copia o texto, monta a arte na ferramenta de IA e volta às
     * 18h10 para salvar. Nada disso toca o formulário, o memo não reexecuta, e a
     * promoção nasceria "Encerrada".
     */
    const problemaAgora = describeFormProblem(form, { isNew: !promotionId });

    // A frase do problema é a mesma do servidor, e barrar aqui poupa o 400 —
    // mas as três recusas que dependem do banco (sobreposição, banner ocupado e
    // preço final acima do de tabela) continuam vindo de lá.
    if (problemaAgora) {
      toast({ title: "Confira o formulário", description: problemaAgora, variant: "destructive" });
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
    pickArtwork,
    clearArtwork,
    promptInput,
    /**
     * Capa do produto, para anexar junto do prompt na ferramenta de IA.
     *
     * Sai da PRÉVIA antes do detalhe: a modal do prompt é aberta no cadastro
     * novo, onde `promotion` ainda não existe — e é ali que a arte da semana é
     * montada, na sexta à tarde.
     */
    coverImageUrl: coverDoProdutoEscolhido(form.productGroupId, preview, promotion),
  };
}

/**
 * A capa do produto que está escolhido AGORA, em URL pública.
 *
 * A comparação do id não é zelo. `WhenWritingNull` faz o campo SUMIR quando o
 * grupo não tem foto, e "ausente" é indistinguível de "a prévia ainda não
 * chegou": trocar o produto para um grupo sem foto oferecia a capa do produto
 * ANTERIOR, com a frase "é ela que impede a IA de inventar um produto que a loja
 * não tem" do lado. O cartaz sairia com o produto errado.
 *
 * A guarda do vazio também não é: `buildPublicImageUrl("")` devolve a base da
 * API com uma barra — string verdadeira que vira `<img>` quebrado na modal.
 */
function coverDoProdutoEscolhido(
  productGroupId: number | null,
  preview?: { productGroupId: number; productGroupImageUrl?: string | null },
  promotion?: { productGroupId: number; productGroupImageUrl?: string | null },
): string | null {
  const fonte = [preview, promotion].find((candidato) => candidato?.productGroupId === productGroupId);
  return fonte?.productGroupImageUrl ? buildPublicImageUrl(fonte.productGroupImageUrl) : null;
}

/** Meta que a prévia aceita: inteiro positivo, ou nada. */
function normalizeTargetForPreview(value: string): number | null {
  const parsed = parsePositiveIntegerOrNaN(value);
  return parsed == null || Number.isNaN(parsed) ? null : parsed;
}
