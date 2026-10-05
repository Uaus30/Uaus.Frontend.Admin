/**
 * PDV — busca de balcão, histórico do turno e venda completa.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { ApiError, apiGet, apiGetOrThrow, apiPost, apiPut, extractCreatedId } from "../client";
import type {
  CouponDiscountTypeCode,
  CouponLookupDto,
  CouponRedemptionChannelCode,
  CreateCustomerPayload,
  EnumValue,
  QueryKey,
  SaleDto,
  StorePerformanceDto,
} from "../models";

// ---------------------------------------------------------------------------
// PDV — busca de balcão, histórico do turno, reedição de venda e venda
// completa do painel administrativo
//
// Contrato do backend em Uaus.Backend.Api/docs/pdv-offline.md.
// ---------------------------------------------------------------------------

/**
 * Produto na busca do balcão (`GET /Pdv/products/search`): só o que o operador
 * precisa para encontrar o produto e vendê-lo. Custo, margem e fornecedor
 * ficam fora de propósito: o balcão não os usa.
 */
export interface ProductPdvSearchDto {
  id: number;
  name: string;
  barcode: string;
  /** Preço de tabela atual do produto. */
  price: number;
  /** Saldo denormalizado atual, para o balcão avisar "sem estoque". */
  stock: number;
  /** Nome do grupo do produto, para desambiguar itens de nome parecido. */
  groupName?: string | null;
  /**
   * Grupo do produto.
   *
   * A promoção é do GRUPO, não da variação: sem este id o carrinho não teria como
   * saber que o copo azul e o copo vermelho dividem o mesmo limite de "6 por
   * cliente". Opcional por segurança de versão — uma API anterior a 19/09/2026
   * não devolve o campo, e aí o balcão simplesmente não aplica promoção.
   */
  productGroupId?: number;
  /** URL da primeira imagem do produto, ou nulo quando não há foto. */
  imageUrl?: string | null;
}

/**
 * Busca produtos para o balcão, por nome ou código de barras (termo só de
 * dígitos é tratado como código de barras pelo servidor).
 *
 * @param term Termo digitado pelo operador. Vazio devolve lista vazia sem ir à
 *   rede — o servidor responderia o mesmo.
 * @param limit Máximo de resultados (padrão 20; o servidor limita a 100).
 */
export async function searchPdvProducts(term: string, limit = 20): Promise<ProductPdvSearchDto[]> {
  const query = term.trim();
  if (!query) return [];

  return (await apiGet<ProductPdvSearchDto[]>("/Pdv/products/search", { term: query, limit })) ?? [];
}

/**
 * Vendas de uma sessão de caixa com itens e pagamentos embutidos, mais
 * recentes primeiro. Alimenta o histórico do turno e a reimpressão de cupom
 * sem uma chamada extra por venda.
 *
 * @param sessionId Sessão de caixa.
 */
export async function getPdvSessionSales(sessionId: number): Promise<SaleDto[]> {
  return (await apiGet<SaleDto[]>(`/Pdv/sessions/${sessionId}/sales`)) ?? [];
}

/**
 * Vendas do DIA CORRENTE, no mesmo formato do histórico por sessão.
 *
 * É o histórico do PDV na loja que **não usa controle de caixa**: ali a venda é
 * gravada sem `cashRegisterSessionId`, e a consulta por sessão devolvia sempre
 * lista vazia — o operador não conseguia reimprimir o cupom da venda que acabou
 * de fazer.
 *
 * O recorte do dia é feito no SERVIDOR, no relógio da loja. Filtrar por data no
 * navegador exigiria baixar mais vendas do que a tela usa e ainda erraria o
 * corte da meia-noite em qualquer máquina com fuso desconfigurado.
 *
 * Cada venda traz o `userId` de quem a registrou: a lista é do dia inteiro, mas
 * quem decide o que pode ser cancelado é a tela.
 */
export async function getPdvTodaySales(): Promise<SaleDto[]> {
  return (await apiGet<SaleDto[]>("/Pdv/sales/today")) ?? [];
}

/**
 * Consulta o cupom pelo código lido do panfleto e devolve, junto, o
 * questionário a apresentar no balcão (`GET /Pdv/coupons/{code}`).
 *
 * **NÃO É HOOK DE QUERY, e isso é deliberado.** A resposta vale para o instante
 * da consulta e não reserva nada: guardá-la em cache faria o segundo caixa ler
 * "restam 2 usos" de um cupom que o primeiro acabou de esgotar, e o operador
 * cobraria o desconto acreditando na tela. A leitura é sempre nova, disparada
 * quando o operador digita ou bipa o código.
 *
 * **A consulta não debita nem trava nada.** O gate real é o UPDATE condicional
 * na gravação da venda, que é o único ponto sem janela entre conferir e
 * consumir.
 *
 * @param code Código digitado ou lido. É normalizado para maiúsculas no
 *   servidor; a codificação da URL protege o caminho quando o operador digita
 *   algo fora do charset do cupom (espaço, `%`, `/`).
 * @returns A definição do cupom e o questionário, quando houver.
 * @throws {ApiError} 400 com mensagem pronta para o balcão quando o cupom não
 *   existe, está inativo, fora da vigência ou esgotado — recusa prevista, que o
 *   servidor de propósito não registra como erro. Mostre `error.message`.
 */
export async function lookupPdvCoupon(code: string): Promise<CouponLookupDto> {
  return apiGetOrThrow<CouponLookupDto>(`/Pdv/coupons/${encodeURIComponent(code.trim())}`);
}

/** Uma resposta do questionário, por id. O rótulo exibido é gravado pelo servidor. */
export interface RegisterPdvSaleCouponAnswerPayload {
  /** Pergunta respondida, como veio no `lookupPdvCoupon`. */
  questionId: number;
  /** Opção escolhida, entre as da pergunta. */
  optionId: number;
}

/**
 * O cupom aplicado na venda. Um bloco, não campos soltos: ou o cupom inteiro
 * veio, ou não veio nenhum — não existe estado intermediário com código
 * preenchido e valor vazio. **Um cupom por venda, não cumulativo** (a
 * invariante é um índice único no servidor).
 *
 * **`discountAmount` JÁ ESTÁ INCLUÍDO em `RegisterPdvSalePayload.discount` —
 * NÃO SOMAR.** O desconto da venda continua sendo o total e o cupom é uma
 * parcela dele; é por isso que a conferência de total contra itens não muda.
 * Somar os dois faria o servidor recusar a venda por total divergente.
 *
 * **A campanha não vem aqui.** O PDV nunca sabe de onde as perguntas vieram —
 * quem fotografa o vínculo é o servidor, na gravação.
 *
 * Os valores são AUDITADOS no servidor: online a divergência recusa a venda; na
 * fila offline ela é carimbada e prevalece o valor do cliente, que foi o
 * impresso no comprovante que ele levou.
 */
export interface RegisterPdvSaleCouponPayload {
  couponId: number;
  /**
   * Código como o operador leu do panfleto. Serve de conferência contra
   * `couponId`: cache offline velho pode trazer um id que hoje pertence a outro
   * código.
   */
  code: string;
  /** Código do tipo (`COUPON_DISCOUNT_TYPE`); `None` (0) é recusado. */
  discountType: CouponDiscountTypeCode;
  /** Percentual (1 a 100) ou reais, conforme `discountType`. */
  discountValue: number;
  /**
   * Base sobre a qual o abatimento foi calculado: subtotal dos itens **menos o
   * desconto global**, nunca o subtotal cru. O encadeamento é item → global →
   * cupom, com arredondamento a cada etapa; calcular sobre o subtotal cru daria
   * um abatimento maior que o impresso no comprovante.
   */
  baseAmount: number;
  /** Reais efetivamente abatidos. Já incluídos em `discount`, e nunca maiores que `baseAmount`. */
  discountAmount: number;
  /** Respostas do questionário. Vazio é o caso normal — a maioria dos cupons não tem campanha. */
  answers: RegisterPdvSaleCouponAnswerPayload[];
  /**
   * Como o cupom chegou à venda (01/10/2026). Ausente vale código. O prêmio do
   * cartão fidelidade vai com `loyaltyRewardId` e é conferido pelo prêmio do
   * cliente; o cupom do programa pelo código é recusado.
   */
  channel?: CouponRedemptionChannelCode;
  /** O prêmio do cartão trocado nesta venda. Só no canal fidelidade. */
  loyaltyRewardId?: number | null;
}

/** Um item vendido, no formato que `POST /Pdv/sales` e `PUT /Pdv/sales/{id}` esperam. */
export interface RegisterPdvSaleItemPayload {
  productId: number;
  quantity: number;
  /** Preço unitário praticado, já líquido do desconto do item. */
  unitPrice: number;
  /**
   * Desconto unitário concedido no item, em reais, apenas para auditoria: o
   * preço de tabela no momento da venda era `unitPrice + discount - surcharge`.
   * Não participa da validação de totais.
   */
  discount?: number;
  /**
   * Acréscimo unitário cobrado no item, em reais — o serviço embutido no
   * produto, como gravar músicas no pendrive.
   *
   * **Já está dentro do `unitPrice`.** A conferência de total do servidor
   * (itens menos desconto) não o soma por fora; mandá-lo em dobro faria a venda
   * ser recusada com o cliente no balcão. Serve para o cupom e para o histórico.
   */
  surcharge?: number;
  /**
   * Justificativa do acréscimo. Obrigatória no servidor quando `surcharge` é
   * maior que zero; recusada em silêncio (vira nula) quando o acréscimo é zero.
   */
  surchargeReason?: string | null;
  /**
   * Promoção aplicada nesta linha, ou nula.
   *
   * O servidor confere três portas — a promoção existe, cobre o grupo daquele
   * produto, e a janela dela alcança o `occurredAt` (nunca a hora do sync).
   * Falhando qualquer uma, a atribuição some e o abatimento continua na linha
   * como desconto manual do operador: **venda paga nunca é recusada por promoção**.
   */
  promotionId?: number | null;
  /**
   * Parcela de `discount` que veio da promoção, por unidade. **Não somar** — ela
   * já está dentro do desconto, e o total da venda não a conhece.
   */
  promotionDiscount?: number;
}

/**
 * Promoção como o PDV a recebe — no snapshot e em `GET /Pdv/promotions`.
 *
 * É a REGRA, não um preço pronto: o balcão avalia a janela pelo relógio local, e
 * é isso que faz a relâmpago das 14h valer numa sessão aberta às 9h, com ou sem
 * internet.
 */
export interface PdvPromotionDto {
  id: number;
  /**
   * Grupo promovido. Vale para todas as variações ativas dele. **Zero no combo** —
   * quem diz que grupos entram é `productGroupIds`.
   */
  productGroupId: number;
  /**
   * Os grupos que a promoção alcança: os do combo, ou o grupo único das outras
   * espécies. Ausente numa API anterior ao combo (29/09/2026).
   */
  productGroupIds?: number[] | null;
  /** Unidades do combo (o "3" de "3 por R$ 20"). A API omite fora do combo. */
  comboQuantity?: number | null;
  /** Enum PromotionType — chega pelo nome; normalize com `enumCode`. */
  type: EnumValue;
  /** Enum PromotionDiscountType — idem. */
  discountType: EnumValue;
  discountValue: number;
  validFrom: string;
  validUntil?: string | null;
  /** Teto de unidades do grupo por venda. Ausente = sem limite. */
  maxQuantityPerSale?: number | null;
}

/**
 * Só as promoções vigentes e as dos próximos dias.
 *
 * O snapshot é baixado uma vez, na abertura da sessão de caixa; promoção é
 * decidida no dia — às vezes no próprio sábado de manhã. Sem esta chamada, a
 * relâmpago cadastrada às 13h exigiria fechar e reabrir o caixa para valer no
 * balcão.
 *
 * Devolve lista vazia quando a API é anterior a esta feature: o balcão
 * simplesmente não aplica promoção, que é o comportamento de antes.
 */
export async function getPdvPromotions(): Promise<PdvPromotionDto[]> {
  return (await apiGet<PdvPromotionDto[]>("/Pdv/promotions")) ?? [];
}

/** Uma forma de pagamento no formato que os endpoints de venda esperam. */
export interface SalePaymentPayload {
  paymentMethodId: number;
  paymentMethodInstallmentId?: number | null;
  /** Valor pago nesta forma. A soma das formas precisa fechar com o total. */
  amount: number;
  installments?: number;
  transactionFee?: number;
}

/**
 * Venda completa do PDV — cabeçalho, itens e formas de pagamento — no formato
 * de `POST /Pdv/sales` (registro) e `PUT /Pdv/sales/{id}` (reedição).
 */
export interface RegisterPdvSalePayload {
  /**
   * Chave de idempotência gerada pelo PDV (UUID). Reenviar a mesma referência
   * devolve a venda já gravada em vez de duplicar. Obrigatória na
   * sincronização offline; no registro online protege contra duplo clique.
   */
  clientReference?: string | null;
  /**
   * Momento real da venda, no horário da loja e sem fuso
   * ("2026-07-25T17:34:12"). Sem ele o servidor usa a hora do recebimento.
   */
  occurredAt?: string | null;
  /**
   * Instante que o balcão congelou para decidir a promoção — o primeiro item da
   * venda, e **não** o pagamento.
   *
   * O servidor confere a janela da promoção contra ele, limitado à janela da
   * própria venda (nunca depois do `occurredAt`, nunca mais de 12h antes). Sem
   * ele, a venda que começou 17:59:40 numa relâmpago que acaba às 18:00 e foi
   * paga 18:00:12 perderia a atribuição — e o abatimento que o cliente já levou
   * impresso viraria desconto manual do operador.
   *
   * Nulo é o normal de quem não congela nada; aí vale o `occurredAt`.
   */
  promotionReferenceAt?: string | null;
  /** Sessão de caixa da venda, ou nulo quando a loja não controla caixa. */
  cashRegisterSessionId: number | null;
  customerId?: number | null;
  /** Nome do consumidor digitado no balcão. Ignorado quando há `customerId`. */
  customerName?: string | null;
  /** CPF/CNPJ digitado no balcão. Ignorado quando há `customerId`. */
  customerDocument?: string | null;
  /**
   * Cliente cadastrado no caixa SEM internet, que ainda não tem ID (01/10/2026).
   * O servidor acha quem já tem aquele telefone ou CPF, ou cria o cadastro, e a
   * venda fica com ele. Ignorado quando há `customerId`.
   */
  newCustomer?: CreateCustomerPayload | null;
  /**
   * Total da venda: soma dos itens menos o desconto. O servidor refaz a conta e
   * recusa divergência. Pode ser zero quando o cupom cobre tudo — nunca
   * negativo — e nesse caso a lista de pagamentos vai vazia.
   */
  total: number;
  /** Desconto TOTAL aplicado sobre a venda. Quando há cupom, ele JÁ ESTÁ incluído aqui. */
  discount: number;
  /**
   * Cupom aplicado na venda, ou ausente quando não houve cupom.
   *
   * Opcional também por compatibilidade da fila offline: venda enfileirada antes
   * desta feature sobe sem o bloco e continua sendo aceita.
   */
  coupon?: RegisterPdvSaleCouponPayload | null;
  notes?: string | null;
  items: RegisterPdvSaleItemPayload[];
  payments: SalePaymentPayload[];
}

/**
 * Reedita uma venda já gravada — itens, pagamentos e desconto — numa única
 * transação no servidor: o estoque dos itens antigos é devolvido e o dos novos
 * consumido. Venda cancelada e sessão de caixa já fechada são recusadas.
 *
 * @param id Venda que está sendo editada.
 * @param payload Mesmo shape do `POST /Pdv/sales`.
 * @returns A venda regravada, com itens e pagamentos embutidos.
 * @throws {ApiError} Quando o servidor recusa (estoque, venda cancelada,
 *   sessão fechada ou desconto acima do limite sem autorização).
 */
export async function updatePdvSale(id: number, payload: RegisterPdvSalePayload): Promise<SaleDto | null> {
  const response = await apiPut<SaleDto>(`/Pdv/sales/${id}`, payload);
  return response.data;
}

/** Um item da venda completa do painel administrativo. */
export interface CreateCompleteSaleItemPayload {
  productId: number;
  quantity: number;
  /** Preço unitário praticado. */
  unitPrice: number;
}

/**
 * Venda completa do painel administrativo (`POST /Sales/complete`): cabeçalho,
 * itens e formas de pagamento numa única transação.
 *
 * O total NÃO é enviado de propósito — o servidor o calcula como itens menos
 * desconto (piso zero), e a soma das formas de pagamento precisa fechar com
 * ele.
 */
export interface CreateCompleteSalePayload {
  customerId?: number | null;
  /** Desconto aplicado sobre a soma dos itens. */
  discount: number;
  notes?: string | null;
  items: CreateCompleteSaleItemPayload[];
  payments: SalePaymentPayload[];
}

/**
 * Registra uma venda completa pelo painel (Admin) validando o estoque de todos
 * os itens antes de gravar. Ou entra tudo, ou não entra nada — substitui o
 * fluxo antigo que criava a venda e lançava os itens um a um e podia parar no
 * meio.
 *
 * @returns O ID criado (do header Location) ou null se o header não vier.
 * @throws {ApiError} Quando algum item não tem estoque ou os pagamentos não
 *   fecham com o total calculado no servidor.
 */
export async function createCompleteSale(payload: CreateCompleteSalePayload): Promise<number | null> {
  const response = await apiPost<SaleDto>("/Sales/complete", payload);
  return extractCreatedId(response.response);
}

// ---------------------------------------------------------------------------
// Desempenho da loja — a espiada rápida pelo balcão
// ---------------------------------------------------------------------------

/** Chave de cache do resumo de desempenho. */
export const getGetStorePerformanceQueryKey = (): QueryKey => ["PdvPerformance"];

/**
 * Resumo de desempenho da loja para a modal do PDV.
 *
 * Vive sob `/Pdv` e não sob `/Dashboard` porque nasceu quando existia o perfil
 * Vendedor (até 03/10/2026), que não alcançava o painel. Continua separado
 * porque devolve só o que o balcão mostra — sem custo, lucro nem margem.
 *
 * A comparação vem pronta do servidor contra o último dia que teve VENDA, não
 * contra ontem.
 */
export function useGetStorePerformance(options?: {
  query?: Omit<
    UseQueryOptions<StorePerformanceDto, ApiError, StorePerformanceDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<StorePerformanceDto, ApiError, StorePerformanceDto, QueryKey>({
    queryKey: [...getGetStorePerformanceQueryKey(), {}],
    queryFn: () => apiGetOrThrow<StorePerformanceDto>("/Pdv/performance"),
    ...options?.query,
  });
}
