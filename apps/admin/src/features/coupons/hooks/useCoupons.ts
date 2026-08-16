import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseDateInput, useDebounce, useToast } from "@workspace/ui";
import {
  COUPON_DISCOUNT_TYPE,
  createCoupon,
  deleteCoupon,
  enumCode,
  getGetCouponByIdQueryKey,
  getGetCouponsQueryKey,
  updateCoupon,
  useGetCampaigns,
  useGetCoupons,
  type CouponDiscountTypeCode,
  type CouponDto,
  type SaveCouponPayload,
} from "@workspace/api-client-react";
import { describeApiError, parseAmountOrNull, toDateKey } from "@workspace/core";
import type { CouponConfirm, CouponForm } from "../types";

/** Itens por página na tabela de cupons. */
export const PAGE_SIZE = 10;

/** Campanhas carregadas para o seletor do formulário e para o filtro. */
const CAMPAIGN_OPTIONS_LIMIT = 100;

/** Valor do `Select` que representa "sem campanha" — o Radix recusa item de valor vazio. */
export const SEM_CAMPANHA = "sem-campanha";

/** Valor do `Select` do filtro que representa "todas as campanhas". */
export const TODAS_CAMPANHAS = "todas";

/** Hora inicial padrão: o cupom vale desde o primeiro minuto do dia escolhido. */
export const DEFAULT_START_TIME = "00:00";

/**
 * Hora final padrão.
 *
 * Sem ela o campo nasceria "00:00" e o cupom morreria à MEIA-NOITE do último dia
 * do panfleto — que é o dia mais movimentado da campanha, com o cliente no
 * balcão segurando o papel que diz "válido até 30/09".
 */
export const DEFAULT_END_TIME = "23:59";

/**
 * Monta o instante enviado ao servidor a partir do dia do calendário e da hora.
 *
 * `toISOString()` é proibido aqui: ele converte para UTC e, no Brasil, joga o dia
 * para trás — o cupom apareceria vencendo na véspera do que foi salvo. Os
 * componentes locais são formatados à mão (`toDateKey`) e a string viaja sem
 * fuso, como o backend espera ("2026-09-30T23:59:59").
 *
 * @param edge `"fim"` fecha o instante em `:59` porque a vigência é INCLUSIVA:
 *   "até 23:59" tem de valer até 23:59:59, senão o último minuto do último dia
 *   fica de fora justamente na corrida de encerramento da campanha.
 */
export function composeInstant(date: Date, time: string, edge: "inicio" | "fim"): string {
  const [rawHours = "00", rawMinutes = "00"] = time.split(":");
  const hours = rawHours.padStart(2, "0");
  const minutes = rawMinutes.padStart(2, "0");
  return `${toDateKey(date)}T${hours}:${minutes}:${edge === "fim" ? "59" : "00"}`;
}

/** Dia-calendário de um instante da API, sem passar por `new Date(string)`. */
export function instantToDate(instant?: string | null): Date | undefined {
  return parseDateInput(instant?.slice(0, 10));
}

/** Hora "HH:mm" de um instante da API; o padrão entra quando o campo não veio. */
export function instantToTime(instant: string | null | undefined, fallback: string): string {
  const time = instant?.slice(11, 16);
  return time && /^\d{2}:\d{2}$/.test(time) ? time : fallback;
}

/**
 * O cupom pode ser EXCLUÍDO?
 *
 * Só enquanto nunca foi usado — é a regra do backend, antecipada aqui para o
 * botão já nascer como "Desativar" em vez de virar um 400 depois do clique.
 * `redeemedCount` é o melhor sinal que a listagem tem, mas quem decide é o
 * servidor: um resgate ESTORNADO devolve o contador a zero e mesmo assim barra o
 * DELETE, porque a linha do livro-razão continua lá. Por isso a recusa dele
 * ainda precisa virar toast legível.
 */
export function canDeleteCoupon(coupon: CouponDto): boolean {
  return coupon.redeemedCount <= 0;
}

/**
 * Converte o cupom gravado no payload de salvamento, para as ações que mexem em
 * UM campo só (desativar) sem abrir o formulário.
 *
 * `discountType` chega como `EnumValue` — o backend serializa enum pelo NOME — e
 * precisa voltar como código numérico: reenviar "Percentage" faria o servidor ler
 * `None` e recusar com 400.
 */
export function couponToPayload(coupon: CouponDto): SaveCouponPayload {
  return {
    code: coupon.code,
    description: coupon.description ?? null,
    discountType: enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE) as CouponDiscountTypeCode,
    discountValue: coupon.discountValue,
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil ?? null,
    usageLimit: coupon.usageLimit,
    isActive: coupon.isActive,
    campaignId: coupon.campaignId ?? null,
  };
}

/**
 * A edição mexe no que o panfleto em circulação promete?
 *
 * Compara só até o minuto: o formulário não expressa segundos avulsos, e a
 * comparação da string inteira acusaria mudança em todo cupom cuja vigência
 * tivesse sido gravada com segundo diferente do padrão da tela.
 */
function definicaoMudou(coupon: CouponDto, payload: SaveCouponPayload): boolean {
  const ateOMinuto = (value?: string | null) => value?.slice(0, 16) ?? null;
  return (
    payload.discountValue !== coupon.discountValue ||
    payload.discountType !== enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE) ||
    ateOMinuto(payload.validFrom) !== ateOMinuto(coupon.validFrom) ||
    ateOMinuto(payload.validUntil) !== ateOMinuto(coupon.validUntil)
  );
}

/** Formulário em branco: percentual, vigência começando hoje e sem teto de usos. */
function emptyForm(): CouponForm {
  return {
    code: "",
    description: "",
    discountType: COUPON_DISCOUNT_TYPE.Percentage,
    discountValue: "",
    validFromDate: new Date(),
    validFromTime: DEFAULT_START_TIME,
    validUntilDate: undefined,
    validUntilTime: DEFAULT_END_TIME,
    usageLimit: "",
    isActive: true,
    campaignId: "",
  };
}

/**
 * useCoupons
 *
 * Hook controlador da tela de cupons: listagem paginada com busca debounced,
 * formulário de cadastro/edição e as ações de excluir/desativar. A página só
 * renderiza o que sai daqui — nenhuma query ou mutação mora lá.
 *
 * As regras de negócio estão no README da feature; a mais fácil de quebrar em
 * silêncio é o teto de usos: **campo vazio é ILIMITADO e vira 0**, e ler esse
 * campo com `parseAmount` mandaria `NaN` ao servidor.
 */
export function useCoupons() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Busca com debounce de 300ms (padrão useFixedCosts): o texto digitado só vira
  // filtro depois da pausa. O recuo para a página 1 é feito nos SETTERS, e não
  // num efeito que observa o filtro: efeito que chama setState renderiza em
  // cascata e é erro de lint neste repositório.
  const [searchInput, setSearchInputState] = useState("");
  const search = useDebounce(searchInput, 300);
  const [onlyActive, setOnlyActiveState] = useState(false);
  const [campaignFilter, setCampaignFilterState] = useState<string>(TODAS_CAMPANHAS);
  const [page, setPage] = useState(1);

  /** Digitar na busca sempre volta à primeira página — filtro novo, contagem nova. */
  function setSearchInput(value: string) {
    setSearchInputState(value);
    setPage(1);
  }

  /** Liga/desliga o filtro de ativos, voltando à primeira página. */
  function setOnlyActive(value: boolean) {
    setOnlyActiveState(value);
    setPage(1);
  }

  /** Troca a campanha filtrada, voltando à primeira página. */
  function setCampaignFilter(value: string) {
    setCampaignFilterState(value);
    setPage(1);
  }

  const { data: pagedData, isLoading } = useGetCoupons({
    search: search.trim() || undefined,
    campaignId: campaignFilter === TODAS_CAMPANHAS ? undefined : Number(campaignFilter),
    onlyActive,
    page,
    limit: PAGE_SIZE,
  });
  const coupons = pagedData?.data ?? [];

  // Campanhas do seletor. O rótulo da COLUNA vem de `campaignName`, que já viaja
  // dentro do cupom; esta lista existe só para escolher o vínculo e filtrar.
  const { data: campaignsPage } = useGetCampaigns({ page: 1, limit: CAMPAIGN_OPTIONS_LIMIT });
  const campaigns = campaignsPage?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CouponDto | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [confirmRequest, setConfirmRequest] = useState<CouponConfirm | null>(null);

  /** Invalida o PREFIXO das duas chaves: a listagem e o detalhe do cupom. */
  const invalidateCoupons = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCouponsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCouponByIdQueryKey() }),
    ]);

  const saveMutation = useMutation({
    mutationFn: (input: {
      id: number | null;
      payload: SaveCouponPayload;
      /** Desativação rápida pela tabela, que não passa pelo formulário. */
      desativando?: boolean;
    }): Promise<CouponDto | null> =>
      input.id ? updateCoupon(input.id, input.payload) : createCoupon(input.payload),
    onSuccess: async (_result, input) => {
      await invalidateCoupons();
      toast({
        title: input.desativando
          ? "Cupom desativado."
          : input.id
            ? "Cupom atualizado."
            : "Cupom cadastrado.",
        description: input.desativando
          ? "Ele para de valer no balcão agora; os resgates e os comprovantes continuam."
          : undefined,
      });
      if (!input.desativando) handleCloseModal();
    },
    // Recusas de negócio ("já existe um cupom com este código", "não é possível
    // alterar o código de um cupom já utilizado") chegam com o texto pronto.
    onError: (error: unknown) =>
      toast({
        title: "Erro ao salvar o cupom",
        description: describeApiError(error),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCoupon(id),
    onSuccess: async () => {
      // Excluir o ÚLTIMO item da última página deixaria a tela presa numa página
      // que deixou de existir, e a listagem vazia faria parecer que o cadastro
      // inteiro sumiu. O recuo é feito aqui, na causa.
      if (coupons.length === 1 && page > 1) setPage(page - 1);
      await invalidateCoupons();
      toast({ title: "Cupom excluído." });
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao excluir o cupom",
        description: describeApiError(error),
        variant: "destructive",
      }),
  });

  /** Abre o formulário em modo de cadastro. */
  function handleOpenCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  /** Abre o formulário com os dados do cupom, quebrando os instantes em dia + hora. */
  function handleOpenEdit(coupon: CouponDto) {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discountType: enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE) as CouponDiscountTypeCode,
      discountValue: String(coupon.discountValue),
      validFromDate: instantToDate(coupon.validFrom),
      validFromTime: instantToTime(coupon.validFrom, DEFAULT_START_TIME),
      validUntilDate: instantToDate(coupon.validUntil),
      validUntilTime: instantToTime(coupon.validUntil, DEFAULT_END_TIME),
      // 0 no banco é ILIMITADO; no formulário isso é o campo VAZIO. Trazer "0"
      // faria o administrador ler "zero usos" e "corrigir" para 1, encerrando um
      // cupom que não tinha teto nenhum.
      usageLimit: coupon.usageLimit > 0 ? String(coupon.usageLimit) : "",
      isActive: coupon.isActive,
      campaignId: coupon.campaignId != null ? String(coupon.campaignId) : "",
    });
    setModalOpen(true);
  }

  /** Fecha o formulário descartando o que não foi salvo. */
  function handleCloseModal() {
    setModalOpen(false);
    setEditing(null);
  }

  /** Toast de recusa do formulário — a mutação não chega a ser chamada. */
  function recusar(title: string, description: string) {
    toast({ title, description, variant: "destructive" });
  }

  /** Valida o formulário, monta o payload e salva (ou pede confirmação antes). */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const code = form.code.trim().toUpperCase();
    const discountValue = parseAmountOrNull(form.discountValue);
    // `parseAmountOrNull`, nunca `parseAmount`: o campo é opcional e vazio
    // significa ILIMITADO (0). `parseAmount("")` devolve NaN, que vira `null` no
    // JSON — o servidor gravaria 0 por outro caminho e ninguém veria a diferença
    // até um cupom sem teto aparecer esgotado no balcão.
    const usageLimit = parseAmountOrNull(form.usageLimit);

    if (!code || !form.validFromDate) {
      recusar("Preencha os campos obrigatórios", "Informe o código e o início da vigência.");
      return;
    }
    if (discountValue == null || discountValue <= 0) {
      recusar("Valor de desconto inválido", "O desconto precisa ser maior que zero.");
      return;
    }
    if (form.discountType === COUPON_DISCOUNT_TYPE.Percentage && discountValue > 100) {
      recusar("Percentual inválido", "O desconto percentual não pode passar de 100%.");
      return;
    }
    if (usageLimit == null) {
      recusar("Teto de usos inválido", "Informe um número ou deixe em branco para ilimitado.");
      return;
    }

    const validFrom = composeInstant(form.validFromDate, form.validFromTime, "inicio");
    const validUntil = form.validUntilDate
      ? composeInstant(form.validUntilDate, form.validUntilTime, "fim")
      : null;

    // "yyyy-MM-ddTHH:mm:ss" ordena como instante, então comparar as strings basta.
    if (validUntil != null && validUntil < validFrom) {
      recusar("Vigência inválida", "O fim da vigência não pode ser anterior ao início.");
      return;
    }

    const payload: SaveCouponPayload = {
      code,
      description: form.description.trim() || null,
      discountType: form.discountType,
      discountValue,
      validFrom,
      validUntil,
      // Negativo é normalizado para 0 no servidor; normalizar aqui também mantém
      // uma representação só de "sem teto" dos dois lados da rede.
      usageLimit: Math.max(0, Math.trunc(usageLimit)),
      isActive: form.isActive,
      campaignId: form.campaignId ? Number(form.campaignId) : null,
    };

    if (editing && editing.redeemedCount > 0 && definicaoMudou(editing, payload)) {
      setConfirmRequest({ kind: "salvar", coupon: editing, payload });
      return;
    }

    saveMutation.mutate({ id: editing?.id ?? null, payload });
  }

  /**
   * Pede a remoção do cupom.
   *
   * Cupom com resgate NÃO é excluído: vira desativação. O backend também recusa,
   * mas descobrir isso pelo erro depois do clique é UX ruim — e deixaria o
   * operador sem saber qual é o caminho certo.
   */
  function handleDelete(coupon: CouponDto) {
    setConfirmRequest({ kind: canDeleteCoupon(coupon) ? "excluir" : "desativar", coupon });
  }

  /** Executa o que foi confirmado. */
  function handleConfirmAccept() {
    if (!confirmRequest) return;

    if (confirmRequest.kind === "excluir") {
      deleteMutation.mutate(confirmRequest.coupon.id);
    } else if (confirmRequest.kind === "desativar") {
      saveMutation.mutate({
        id: confirmRequest.coupon.id,
        payload: { ...couponToPayload(confirmRequest.coupon), isActive: false },
        desativando: true,
      });
    } else {
      saveMutation.mutate({ id: confirmRequest.coupon.id, payload: confirmRequest.payload });
    }

    setConfirmRequest(null);
  }

  /** Confirmação recusada: nada é enviado e o formulário continua onde estava. */
  function handleConfirmDismiss() {
    setConfirmRequest(null);
  }

  return {
    // Listagem
    coupons,
    pagination: pagedData
      ? { page: pagedData.page, total: pagedData.total, totalPages: pagedData.totalPages }
      : undefined,
    isLoading,
    page,
    setPage,

    // Filtros
    searchInput,
    setSearchInput,
    onlyActive,
    setOnlyActive,
    campaignFilter,
    setCampaignFilter,
    campaigns,

    // Formulário
    modalOpen,
    editing,
    form,
    setForm,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmit,
    isSaving: saveMutation.isPending,

    // Ações da tabela e confirmação
    handleDelete,
    confirmRequest,
    handleConfirmAccept,
    handleConfirmDismiss,
    isConfirming: saveMutation.isPending || deleteMutation.isPending,
  };
}
