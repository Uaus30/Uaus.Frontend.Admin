export type QueryKey = readonly unknown[];

export interface TokenDto {
  type: string;
  value: string;
  expiration: string;
}

export interface UserDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: number;
  status: number;
}

export interface UserListDto {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: number;
  status: number;
}

export interface AuthenticatedUserDto {
  user: UserDto;
  token: TokenDto;
}

export interface EnumOptionDto {
  id: number;
  value: string;
  name: string;
  allowSelect: boolean;
}

export interface PaginationDto {
  page: number;
  size: number;
  filteredItems: number;
}

export interface BackendPagedResult<T> {
  items: T[];
  pagination: PaginationDto;
}

export interface UiPagedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * A API serializa enums pelo nome do membro em C# ("Paid", "Active"), mas os
 * filtros e os selects trabalham com o código numérico. Estes mapas e o helper
 * `enumCode` normalizam os dois formatos.
 */
export type EnumValue = number | string | null | undefined;

export const PAYMENT_STATUS = {
  None: 0,
  Pending: 1,
  Paid: 2,
  PartiallyPaid: 3,
  Overdue: 4,
  Cancelled: 5,
} as const;

export const PRODUCT_STATUS = {
  None: 0,
  Draft: 1,
  Active: 2,
  OutOfStock: 3,
  Inactive: 4,
} as const;

export const USER_STATUS = {
  None: 0,
  Pending: 1,
  Active: 2,
  Bloqued: 3,
  Inactive: 4,
} as const;

export const USER_ROLE = {
  None: 0,
  Admin: 1,
  Seller: 2,
} as const;

export const SUPPLIER_STATUS = {
  None: 0,
  Active: 1,
  Inactive: 2,
} as const;

/**
 * Como o cupom calcula o abatimento (enum `CouponDiscountType` do backend).
 *
 * `None` é o zero do `smallint` e existe para que a omissão não vire um tipo
 * válido: cupom gravado sem tipo é cadastro errado, não "percentual de 0%". O
 * backend recusa `None` tanto no cadastro quanto no payload da venda.
 *
 * A base do cálculo é sempre o subtotal dos itens MENOS o desconto global — o
 * encadeamento é item → global → cupom, com arredondamento a cada etapa. Quem
 * calcula é `computeDiscount` do `@workspace/core`; o servidor audita.
 */
export const COUPON_DISCOUNT_TYPE = {
  None: 0,
  /** Percentual sobre a base, de 1 a 100. */
  Percentage: 1,
  /** Valor fixo em reais, limitado à base (pode zerar a venda, nunca torná-la negativa). */
  Amount: 2,
} as const;

/**
 * Código do tipo de desconto no que é ENVIADO ao servidor.
 *
 * Nas respostas o campo é `EnumValue` (o backend serializa enum pelo nome, com
 * `JsonStringEnumConverter`) e se lê com `enumCode`. Nos payloads o tipo é este,
 * fechado nos três códigos: um `number` solto deixaria passar `discountType: 7`,
 * que só apareceria como 400 no salvamento.
 */
export type CouponDiscountTypeCode = (typeof COUPON_DISCOUNT_TYPE)[keyof typeof COUPON_DISCOUNT_TYPE];

/** Rótulos dos tipos de desconto, para tabela, select e comprovante. */
export const COUPON_DISCOUNT_TYPE_LABEL: Record<number, string> = {
  [COUPON_DISCOUNT_TYPE.Percentage]: "Percentual",
  [COUPON_DISCOUNT_TYPE.Amount]: "Valor fixo",
};

/**
 * Tipos que o administrador pode escolher no formulário.
 *
 * `None` fica de fora: ele existe só para o zero do banco não virar tipo válido.
 */
export const SELECTABLE_COUPON_DISCOUNT_TYPES = [
  COUPON_DISCOUNT_TYPE.Percentage,
  COUPON_DISCOUNT_TYPE.Amount,
] as const;

/** Converte o valor de um enum vindo da API (número ou nome) para o código numérico. */
export function enumCode(value: EnumValue, names: Record<string, number>): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  if (value in names) return names[value];
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface CustomerDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
}

export interface DepartmentDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  description: string | null;
}

export interface CategoryDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  departmentId: number;
  name: string;
  description: string | null;
  /** Produtos ativos vinculados à categoria, contados pela própria listagem. */
  productCount: number;
}

export interface ProductHistoryDto {
  id: number;
  createdAt: string;
  createdBy: string | null;
  userId: number | null;
  userFirstName: string | null;
  userLastName: string | null;
  type: number;
  description: string;
}

export interface ProductGroupDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  categoryId: number;
  name: string;
  description: string | null;
  hasVariations: boolean;
  /** Visibilidade pública do grupo (campo ShowOnSite do backend). */
  showOnSite: boolean;
  canDelete: boolean;
  productHistories?: ProductHistoryDto[];
}

export interface PaymentMethodInstallmentDto {
  id: number;
  paymentMethodId: number;
  installmentNumber: number;
  feePercentage: number;
  isActive: boolean;
}

export interface PaymentMethodDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  isActive: boolean;
  installments: PaymentMethodInstallmentDto[];
}

/** Sessão de caixa do PDV. */
export interface CashRegisterSessionDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  userId: number;
  userName?: string | null;
  openedAt: string;
  openingBalance: number;
  openingNotes: string | null;
  closedAt: string | null;
  closedByUserId: number | null;
  closedByUserName?: string | null;
  countedAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  closingNotes: string | null;
  /** 1 = Aberto, 2 = Fechado */
  status: number;
  summary?: CashRegisterSessionSummaryDto | null;
}

export interface CashRegisterSessionSummaryDto {
  salesCount: number;
  cancelledSalesCount: number;
  revenue: number;
  discounts: number;
  itemsCount: number;
  cashAmount: number;
  nonCashAmount: number;
  /** Fundo de troco + recebido em espécie. */
  expectedCashAmount: number;
  byPaymentMethod: Array<{
    paymentMethodId: number;
    paymentMethodName: string;
    count: number;
    amount: number;
  }>;
}

export const CASH_REGISTER_SESSION_OPEN = 1;
export const CASH_REGISTER_SESSION_CLOSED = 2;

/** Forma de pagamento "Dinheiro" — a única que entra na conferência da gaveta. */
export const CASH_PAYMENT_METHOD_ID = 1;

export interface CreatePaymentMethodInstallmentRequest {
  installmentNumber: number;
  feePercentage: number;
  isActive?: boolean;
}

export interface CreatePaymentMethodRequest {
  name: string;
  isActive?: boolean;
  installments?: CreatePaymentMethodInstallmentRequest[];
}

export interface UpdatePaymentMethodInstallmentRequest {
  id?: number;
  installmentNumber: number;
  feePercentage: number;
  isActive?: boolean;
}

export interface UpdatePaymentMethodRequest {
  id: number;
  name: string;
  isActive?: boolean;
  installments?: UpdatePaymentMethodInstallmentRequest[];
}

export interface ProductDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  productGroupId: number;
  name: string;
  description: string | null;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  /** Enum ProductStatus — pode vir como número ou nome; use `enumCode`. */
  status: EnumValue;
  canDelete: boolean;
}

export interface TagDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  color: string;
  isPublic: boolean;
  /** Produtos ativos marcados com a etiqueta, contados pela própria listagem. */
  productCount: number;
}

export interface ProductTagDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  productId: number;
  tagId: number;
}

export interface GradeOptionDto {
  id: number;
  gradeId: number;
  value: string;
  colorHex: string | null;
  displayOrder: number;
}

export interface GradeDto {
  id: number;
  createdAt?: string;
  updatedAt?: string | null;
  name: string;
  type: number; // GradeType (1 = Size, 2 = Color, 3 = Model, 4 = Print)
  categoryIds: number[];
  options: GradeOptionDto[];
}

export interface ImageDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  type: number;
  uuid: string;
  url: string;
  version: number;
}

export interface ProductImageDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  productId: number;
  imageId: number;
  displayOrder: number;
}

export interface SupplierDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  corporateName: string | null;
  document: string | null;
  salesRepresentative: string;
  phone: string;
  email: string | null;
  minimumPurchaseValue: number;
  status: number;
  city: string;
  state: string;
  avatarColor: string;
  description: string | null;
}

export interface SaleDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  customerId: number | null;
  /**
   * Consumidor da venda: o nome do cliente cadastrado quando há um, senão o
   * nome informado no balcão. Nulo em consumidor não identificado.
   */
  customerName?: string | null;
  /** CPF/CNPJ do consumidor, do cadastro ou informado no balcão. */
  customerDocument?: string | null;
  /** Operador que registrou a venda. Nulo nas vendas migradas. */
  userId?: number | null;
  /** Nome completo do operador que registrou a venda. */
  userName?: string | null;
  /** Sessão de caixa da venda. Nulo nas vendas migradas e fora do PDV. */
  cashRegisterSessionId?: number | null;
  total: number;
  /** Desconto TOTAL da venda. Quando há cupom, ele JÁ ESTÁ incluído aqui. */
  discount: number;
  /**
   * Parcela de `discount` atribuída ao cupom.
   *
   * **JÁ ESTÁ INCLUÍDA em `discount` — NÃO SOMAR.** Existe para discriminar a
   * origem do abatimento (e para excluir o cupom do limite de desconto do
   * vendedor). Somar os dois inflaria o desconto e reduziria o lucro em todo
   * relatório que consolida venda. Zero nas vendas sem cupom.
   *
   * A API sempre manda o campo (é `decimal`, não anulável); ele é opcional aqui
   * por causa das vendas gravadas no histórico local do PDV antes desta feature,
   * que sobem sem ele — leia com `?? 0`.
   */
  couponDiscount?: number;
  /**
   * Código do cupom como saiu impresso no comprovante daquela venda.
   *
   * Os cinco campos de cupom vêm do SNAPSHOT do resgate, não da definição atual
   * do cadastro: sem eles a reimpressão leria o cupom de hoje e a segunda via
   * sairia diferente da primeira depois de qualquer edição — pior que não
   * reimprimir. Ausente nas vendas sem cupom (o backend omite nulo).
   */
  couponCode?: string | null;
  /** Descrição do cupom impressa ao lado do código. Do snapshot do resgate. */
  couponDescription?: string | null;
  /**
   * Tipo do desconto do cupom no momento da venda (enum `CouponDiscountType`).
   * Pode vir como número ou nome; use `enumCode` com `COUPON_DISCOUNT_TYPE`.
   */
  couponDiscountType?: EnumValue;
  /**
   * Percentual ou reais do cupom no momento da venda, para o comprovante
   * escrever "(10%)" ou "(R$ 20,00)". Do snapshot do resgate.
   */
  couponDiscountValue?: number | null;
  /**
   * Administrador que autorizou um desconto acima do limite do vendedor
   * (auditoria do desconto gerencial). Nulo quando não houve autorização.
   */
  discountAuthorizedByUserId?: number | null;
  paymentMethodId?: number | null;
  paymentMethodInstallmentId?: number | null;
  paymentMethodName?: string | null;
  installments?: number;
  transactionFee?: number;
  /** Enum PaymentStatus — pode vir como número ou nome; use `enumCode`. */
  paymentStatus: EnumValue;
  notes: string | null;
  /** Formas de pagamento da venda (uma venda pode ter N formas). */
  payments?: SalePaymentDto[];
  items?: SaleItemDto[];
}

export interface SalePaymentDto {
  id: number;
  saleId: number;
  paymentMethodId: number;
  paymentMethodName?: string | null;
  paymentMethodInstallmentId?: number | null;
  /** Valor pago nesta forma. Nulo quando a origem não informou a divisão. */
  amount: number | null;
  installments: number;
  transactionFee: number;
  sequence: number;
}

export interface SaleItemDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  saleId: number;
  productId: number;
  productName?: string | null;
  /** Código de barras do produto, impresso no cupom para conferência. */
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  /**
   * Desconto unitário concedido no item, em reais, apenas para auditoria: o
   * preço de tabela no momento da venda era `unitPrice + discount`. O subtotal
   * continua sendo quantidade vezes o preço líquido.
   */
  discount?: number;
  subtotal: number;
  /** Custo unitário praticado no momento da venda. */
  unitCost: number;
  totalCost: number;
  profit: number;
}

// ---------------------------------------------------------------------------
// DTOs do módulo financeiro (custos fixos, sócios, relatório e fechamentos).
// Contrato do backend em Uaus.Backend.Api/docs/financeiro.md.
//
// Nota: o backend serializa com WhenWritingNull — campos null são OMITIDOS do
// JSON e chegam aqui como undefined. Compare com == null ou use ??.
// ---------------------------------------------------------------------------

/** Custo fixo mensal (aluguel, contador, energia...). */
export interface FixedCostDto {
  id: number;
  createdAt: string;
  updatedAt?: string | null;
  name: string;
  /** Valor mensal cheio. Entra por competência: cada mês tocado lança o valor inteiro, sem pró-rata. */
  monthlyAmount: number;
  /** Início da vigência, normalizado pelo backend para o dia 1 do mês (competência mensal). */
  startsOn: string;
  /** Fim da vigência (também dia 1 do mês). Null/omitido = custo ainda vigente. */
  endsOn?: string | null;
  notes?: string | null;
}

/** Dados enviados ao criar/editar um custo fixo (SaveFixedCostRequest do backend). */
export interface SaveFixedCostPayload {
  name: string;
  /** Deve ser maior que zero. */
  monthlyAmount: number;
  /** Data no formato "yyyy-MM-01" — o backend normaliza para o dia 1 do mês. */
  startsOn: string;
  /** "yyyy-MM-01" ou null/omitido para custo vigente; deve ser >= startsOn. */
  endsOn?: string | null;
  notes?: string | null;
}

/** Sócio da empresa, dono de um percentual do lucro líquido. */
export interface PartnerDto {
  id: number;
  createdAt: string;
  updatedAt?: string | null;
  name: string;
  /**
   * Percentual do lucro líquido (0–100). A soma entre os sócios ATIVOS deve ser
   * 100,00 para permitir um fechamento. Desativar o sócio zera o percentual.
   */
  profitSharePercentage: number;
  isActive: boolean;
}

/** Dados enviados ao criar um sócio (nasce ativo, com percentual 0). */
export interface CreatePartnerPayload {
  name: string;
}

/** Dados enviados ao editar um sócio. Desativar zera o percentual no backend. */
export interface UpdatePartnerPayload {
  name: string;
  isActive: boolean;
}

/** Percentual atual de um sócio na tela de distribuição de lucros. */
export interface PartnerProfitShareItemDto {
  partnerId: number;
  partnerName: string;
  percentage: number;
  isActive: boolean;
}

/** Distribuição de lucros vigente entre os sócios. */
export interface PartnerProfitSharesDto {
  /** Soma dos percentuais; precisa estar em 100,00 (entre ativos) para fechar um período. */
  totalPercentage: number;
  shares: PartnerProfitShareItemDto[];
}

/** Novos percentuais: deve conter EXATAMENTE todos os sócios ativos e somar 100,00. */
export interface UpdatePartnerProfitSharesPayload {
  shares: Array<{ partnerId: number; percentage: number }>;
}

/** Totais de vendas do período — mesma conta do Dashboard (fonte única no backend). */
export interface FinancialPeriodTotalsDto {
  revenue: number;
  cost: number;
  /** Lucro bruto = Σ lucro dos itens − descontos de cabeçalho, vendas canceladas excluídas. */
  profit: number;
  discount: number;
  marginPercentage: number;
  salesCount: number;
  cancelledSalesCount: number;
  itemsCount: number;
  averageTicket: number;
  startDate: string;
  endDate: string;
}

/** Perdas agrupadas por motivo (baixas de estoque confirmadas no período). */
export interface FinancialReportWriteOffByReasonDto {
  /** Enum StockWriteOffReason — pode vir como número ou nome; use `enumCode`. */
  reason: EnumValue;
  reasonName: string;
  totalCost: number;
  totalQuantity: number;
}

/** Perdas do período — INFORMATIVAS: não entram no lucro líquido (o CMV já cobre o custo vendido). */
export interface FinancialReportWriteOffsDto {
  totalCost: number;
  totalQuantity: number;
  byReason: FinancialReportWriteOffByReasonDto[];
}

/** Quanto um custo fixo pesou no período (meses de competência × valor mensal). */
export interface FinancialReportFixedCostItemDto {
  fixedCostId: number;
  name: string;
  monthlyAmount: number;
  /** Meses-calendário tocados pelo período em que o custo estava vigente — sem pró-rata. */
  monthsCount: number;
  total: number;
}

/** Custos fixos consolidados do período. */
export interface FinancialReportFixedCostsDto {
  total: number;
  items: FinancialReportFixedCostItemDto[];
}

/** Distribuição prevista para um sócio, calculada com os percentuais atuais. */
export interface PartnerDistributionItemDto {
  partnerId: number;
  partnerName: string;
  percentage: number;
  /**
   * Round(lucro líquido × percentual / 100, 2). O resíduo de arredondamento vai
   * para o sócio de maior percentual. Lucro negativo distribui prejuízo.
   */
  amount: number;
}

/** Relatório financeiro do período — PRÉVIA calculada ao vivo; o documento oficial é o fechamento. */
export interface FinancialReportSummaryDto {
  startDate: string;
  endDate: string;
  sales: FinancialPeriodTotalsDto;
  /** Compras do período — informativas, não entram no lucro líquido. */
  purchasesTotal: number;
  writeOffs: FinancialReportWriteOffsDto;
  fixedCosts: FinancialReportFixedCostsDto;
  /** = sales.profit. */
  grossProfit: number;
  /** = grossProfit − fixedCosts.total. */
  netProfit: number;
  /** Sócios ativos com os percentuais atuais; vazio se a distribuição não foi configurada. */
  partnerDistribution: PartnerDistributionItemDto[];
  /** Avisos como período parcial de mês ou distribuição não configurada. */
  warnings: string[];
}

/**
 * Rateio de um sócio dentro de um fechamento. Nome, percentual e valor são
 * CONGELADOS na confirmação: editar o sócio depois não altera este registro.
 */
export interface FinancialClosingShareDto {
  partnerId: number;
  partnerName: string;
  percentage: number;
  /** Valor congelado; o resíduo de arredondamento já foi aplicado ao sócio de maior percentual. */
  amount: number;
}

/**
 * Fechamento financeiro de um período. Todos os números são CONGELADOS na
 * confirmação — recalculados no servidor, nunca vindos do cliente.
 */
export interface FinancialClosingDto {
  id: number;
  createdAt: string;
  periodStart: string;
  /** Fim do período, inclusivo. */
  periodEnd: string;
  revenue: number;
  discounts: number;
  cogsCost: number;
  grossProfit: number;
  /** Compras do período — informativas, não entram no lucro líquido. */
  purchasesTotal: number;
  /** Custo FIFO das baixas confirmadas — informativo, não entra no lucro líquido. */
  writeOffLossesTotal: number;
  /** Total por competência mensal (valor cheio de cada mês tocado, sem pró-rata). */
  fixedCostsTotal: number;
  netProfit: number;
  salesCount: number;
  notes?: string | null;
  closedByUserId: number;
  closedByUserName?: string | null;
  shares: FinancialClosingShareDto[];
}

/**
 * Prévia de fechamento: mesmos números do fechamento, sem persistir nada.
 * Soma de percentuais ≠ 100 vira warning aqui (a confirmação é que recusa).
 */
export interface FinancialClosingPreviewDto {
  periodStart: string;
  /** Fim do período, inclusivo. */
  periodEnd: string;
  revenue: number;
  discounts: number;
  cogsCost: number;
  grossProfit: number;
  purchasesTotal: number;
  writeOffLossesTotal: number;
  fixedCostsTotal: number;
  netProfit: number;
  salesCount: number;
  shares: FinancialClosingShareDto[];
  /** Detalhamento dos custos fixos considerados no período. */
  fixedCosts: FinancialReportFixedCostsDto;
  /** Avisos como período parcial de mês ou soma de percentuais ≠ 100. */
  warnings: string[];
}

/** Período enviado para calcular a prévia do fechamento. */
export interface PreviewFinancialClosingPayload {
  periodStart: string;
  /** Inclusivo. */
  periodEnd: string;
}

/** Dados enviados ao confirmar um fechamento (o servidor recalcula tudo). */
export interface CreateFinancialClosingPayload {
  periodStart: string;
  /** Inclusivo. */
  periodEnd: string;
  notes?: string | null;
}

export interface AuthSession {
  user: UserDto;
  token: TokenDto;
}

export interface ApiResponse<T> {
  data: T | null;
  response: Response;
}

// ---------------------------------------------------------------------------
// Desempenho da loja — resumo consumido pela modal do PDV e pelo painel.
// Contrato do backend em Uaus.Backend.Api, DashboardService.Performance.cs.
// ---------------------------------------------------------------------------

/** Faturamento de um dia específico. */
export interface PerformanceDayDto {
  /** Data do dia, em ISO. */
  date: string;
  revenue: number;
  salesCount: number;
  averageTicket: number;
}

/**
 * Acumulado de um período contra o anterior equivalente.
 *
 * O anterior é recortado no MESMO avanço pelo servidor: comparar os dez dias
 * corridos do mês atual com os trinta e um dias fechados do anterior mostraria
 * uma queda que é só o calendário.
 */
export interface PerformanceRangeDto {
  revenue: number;
  salesCount: number;
  previousRevenue: number;
  /**
   * Variação percentual sobre o anterior.
   *
   * Ausente quando não houve base de comparação — "não há com o que comparar" é
   * diferente de "não variou", e a tela precisa distinguir os dois.
   *
   * **Chega `undefined`, não `null`.** O backend serializa com
   * `WhenWritingNull`, então o campo nulo é OMITIDO do JSON. Declarar só
   * `number | null` fazia o TypeScript garantir ao consumidor uma coisa que não
   * é verdade, e a tela de Desempenho do PDV ficou preta por causa de um
   * `=== null` que nunca dava true. Compare com `== null` ou use `??`.
   */
  changePercentage?: number | null;
}

/** Um dia da semana com as duas semanas sobrepostas. */
export interface WeekdayComparisonDto {
  /** 0 = segunda … 6 = domingo. A semana da loja começa na segunda. */
  weekday: number;
  date: string;
  revenue: number;
  previousRevenue: number;
  /**
   * O dia ainda não aconteceu nesta semana.
   *
   * Separa "vendeu zero" de "ainda não chegou" — sem isso o gráfico desenha os
   * dias futuros como queda a zero.
   */
  isFuture: boolean;
}

/**
 * Resumo de desempenho da loja.
 *
 * A comparação é com o último dia que teve VENDA, não com ontem: numa segunda o
 * dia anterior é o domingo fechado, e a variação seria sempre +100%.
 *
 * Não traz custo, lucro nem margem — o endpoint é liberado para o papel Seller.
 */
export interface StorePerformanceDto {
  referenceDate: string;
  /** Momento em que o servidor respondeu, para a tela mostrar a hora do dado. */
  serverTime: string;
  today: PerformanceDayDto;
  /**
   * Ausente quando a loja nunca vendeu antes de hoje.
   *
   * Chega `undefined`, não `null` — ver a nota em `changePercentage`.
   */
  previousSalesDay?: PerformanceDayDto | null;
  week: PerformanceRangeDto;
  month: PerformanceRangeDto;
  weekdayComparison: WeekdayComparisonDto[];
}

// ---------------------------------------------------------------------------
// Cupons de desconto e campanhas
//
// Contrato em PLANO-CUPONS-CAMPANHAS.md (raiz do repositório) e nos DTOs do
// backend (Uaus.Application/DTOs/Coupons|Campaigns|Pdv).
//
// INSTANTE, NÃO DATA. `validFrom`, `validUntil`, `startsAt`, `endsAt`,
// `windowStart`, `windowEnd` e `day` viajam como DateTime serializado sem fuso
// ("2026-09-30T23:59:59"). Nunca reduza um deles a "2026-09-30" para depois
// fazer `new Date("2026-09-30")`: a string só-data é interpretada como UTC e,
// no Brasil, volta um dia — o cupom apareceria vencendo na véspera do que o
// administrador salvou (armadilha 2 do CLAUDE.md). Para montar um instante a
// partir de um `Date` do calendário, formate os componentes locais à mão
// (`toDateKey` do `@workspace/core` + a hora escolhida), nunca `toISOString()`.
// ---------------------------------------------------------------------------

/** Cupom de desconto como o painel administrativo o exibe. */
export interface CouponDto {
  id: number;
  createdAt: string;
  updatedAt?: string | null;
  /** Código do panfleto, sempre em maiúsculas (`^[A-Z0-9-]{3,30}$`). */
  code: string;
  /** Texto curto que sai impresso no comprovante ao lado do código. */
  description?: string | null;
  /** Enum CouponDiscountType — pode vir como número ou nome; use `enumCode`. */
  discountType: EnumValue;
  /** Percentual (1 a 100) ou reais, conforme `discountType`. */
  discountValue: number;
  /** Início da vigência, inclusivo. Instante — leia a nota do topo da seção. */
  validFrom: string;
  /** Fim da vigência, inclusivo. Ausente = sem prazo. */
  validUntil?: string | null;
  /**
   * Teto de resgates como está gravado. **Zero significa ILIMITADO**, nunca
   * "zero usos" — negativos já chegam normalizados para 0. Para exibir, prefira
   * `remainingUses`, que não obriga a tela a conhecer esta convenção.
   */
  usageLimit: number;
  /** Resgates consumidos. É cache; a verdade é o livro-razão (ver `reconcileCoupon`). */
  redeemedCount: number;
  /**
   * Usos restantes. **Ausente/nulo = ILIMITADO**, e é por isso que o campo é
   * anulável em vez de trazer 0: cupom sem teto e cupom esgotado são situações
   * opostas no balcão, e representar as duas com o mesmo 0 faria a tela avisar
   * "esgotado" justamente no cupom que nunca esgota. Compare com `== null`.
   */
  remainingUses?: number | null;
  isActive: boolean;
  /** Campanha que fornece o questionário. Ausente = cupom sem perguntas. */
  campaignId?: number | null;
  /** Nome da campanha já resolvido, para a coluna da listagem não fazer uma chamada por linha. */
  campaignName?: string | null;
}

/**
 * Conferência entre o contador de uso do cupom e o livro-razão de resgates.
 *
 * `redeemedCount` é cache mantido por um UPDATE condicional dentro da transação
 * da venda; as linhas de resgate são o fato. Em operação normal batem — e sem
 * este retrato qualquer divergência só é vista e só é corrigida com SQL manual
 * em produção.
 */
export interface CouponReconciliationDto {
  couponId: number;
  code: string;
  /** O contador gravado no cupom. */
  redeemedCount: number;
  /** Resgates NÃO estornados no livro-razão. */
  activeRedemptions: number;
  /**
   * `redeemedCount − activeRedemptions`. Zero é o esperado. Positivo = o cupom
   * está valendo menos do que deveria; negativo = está valendo mais do que a
   * campanha pagou.
   */
  difference: number;
  /** Atalho de leitura: `difference` é zero. */
  isBalanced: boolean;
}

/** Alternativa de resposta de uma pergunta da campanha (conjunto fechado, nunca texto livre). */
export interface CampaignQuestionOptionDto {
  id: number;
  /** Texto do botão no balcão; é copiado para o snapshot do resgate. */
  label: string;
  /** Ordem de exibição dentro da pergunta. */
  sortOrder: number;
}

/** Uma pergunta do questionário da campanha, como o editor do admin a recebe. */
export interface CampaignQuestionDto {
  id: number;
  /** Texto exibido no balcão; vira `question_label_snapshot` no resgate. */
  label: string;
  sortOrder: number;
  /** Resposta obrigatória para aplicar o cupom. */
  isRequired: boolean;
  /** Alternativas ativas, ordenadas. Sempre pelo menos duas e no máximo oito. */
  options: CampaignQuestionOptionDto[];
}

/** Campanha de marketing como o painel administrativo a exibe. */
export interface CampaignDto {
  id: number;
  createdAt: string;
  updatedAt?: string | null;
  name: string;
  description?: string | null;
  /** Início do período, inclusivo. Instante — leia a nota do topo da seção. */
  startsAt: string;
  /** Fim do período, inclusivo. Ausente = em aberto. */
  endsAt?: string | null;
  /**
   * Campanha inativa deixa de apresentar o questionário no balcão, mas NÃO
   * invalida os cupons ligados a ela: quem decide dinheiro é a vigência do cupom.
   */
  isActive: boolean;
  /**
   * Questionário ordenado, sem as perguntas excluídas logicamente.
   *
   * Só vem preenchido na consulta por ID; a LISTAGEM devolve sempre `[]` porque
   * a tabela do admin não lê pergunta nenhuma e carregá-las custaria duas
   * consultas extras por página.
   */
  questions: CampaignQuestionDto[];
}

/** Uma alternativa de resposta na consulta do balcão. */
export interface CouponLookupQuestionOptionDto {
  optionId: number;
  label: string;
}

/** Uma pergunta já resolvida para o balcão — o PDV não sabe que veio de uma campanha. */
export interface CouponLookupQuestionDto {
  questionId: number;
  label: string;
  isRequired: boolean;
  /** Sempre de duas a oito alternativas; no balcão viram botões grandes, sem teclado. */
  options: CouponLookupQuestionOptionDto[];
}

/**
 * Resposta do `GET /Pdv/coupons/{code}`: o que o balcão precisa para aplicar o
 * cupom e, quando houver, o questionário a apresentar.
 *
 * **ESTA CONSULTA NÃO RESERVA NADA.** Nenhum uso é debitado, nenhuma linha é
 * travada. `remainingUses` é leitura do instante, boa para mostrar na tela e
 * nada mais — o gate real é o UPDATE condicional na gravação da venda. Tratar
 * esta resposta como reserva faria dois caixas acharem que têm o último uso, e
 * os dois teriam, porque nada foi reservado.
 *
 * **Não devolve valor em reais** de propósito: o abatimento sai de
 * `computeDiscount` do `@workspace/core` sobre o carrinho, que muda a cada item
 * bipado. Congelar o valor aqui deixaria o desconto estagnado quando o operador
 * acrescentasse um produto depois de aplicar o cupom.
 *
 * **Não diz de onde as perguntas vieram** — não existe `campaignId` aqui, nem no
 * payload da venda, nem na fila offline. O servidor fotografa a campanha na
 * gravação, e é isso que mantém offline, fila, idempotência e comprovante
 * estáveis a qualquer evolução do modelo de campanha.
 */
export interface CouponLookupDto {
  couponId: number;
  /** Código normalizado, como está gravado — sempre em maiúsculas. */
  code: string;
  description?: string | null;
  /** Enum CouponDiscountType — pode vir como número ou nome; use `enumCode`. */
  discountType: EnumValue;
  /** Percentual (1 a 100) ou reais, conforme `discountType`. */
  discountValue: number;
  /** Fim da vigência, inclusivo. Ausente = sem prazo. Instante, nunca data pura. */
  validUntil?: string | null;
  /** Usos restantes agora. **Ausente/nulo = ILIMITADO.** Não é reserva nem promessa. */
  remainingUses?: number | null;
  /**
   * Há pergunta OBRIGATÓRIA a responder antes de aplicar o cupom. Falso quando
   * não há campanha, quando ela está inativa, quando o instante corrente está
   * fora do período dela, ou quando todas as perguntas são opcionais.
   */
  requiresAnswers: boolean;
  /**
   * Questionário a apresentar, na ordem do editor. Vazio quando o cupom não tem
   * campanha, quando a campanha está inativa ou quando o instante corrente está
   * fora do período dela — e nesse caso o desconto continua valendo: vigência da
   * CAMPANHA decide apenas se as perguntas aparecem; quem decide dinheiro é a
   * vigência do CUPOM.
   */
  questions: CouponLookupQuestionDto[];
}

/**
 * Métricas de um conjunto de vendas no intervalo da campanha.
 *
 * É a forma do DENOMINADOR do relatório: as vendas da loja inteira no mesmo
 * intervalo. Sem esse grupo de controle, "a campanha funcionou" é afirmação sem
 * comparação — R$ 18 mil podem ser 15% de um mês bom ou 90% de um mês morto.
 */
export interface CampaignReportTotalsDto {
  /** Vendas não canceladas do recorte. */
  salesCount: number;
  revenue: number;
  /** Lucro dos itens menos o desconto das vendas — mesma fórmula do Dashboard. */
  profit: number;
  averageTicket: number;
  /** Margem sobre o faturamento, em pontos percentuais. */
  marginPercentage: number;
}

/** Métricas das vendas que usaram um cupom da campanha (resgate não estornado). */
export interface CampaignReportCampaignTotalsDto extends CampaignReportTotalsDto {
  /**
   * Reais abatidos pelos cupons — o custo da ação. É PARCELA do desconto de
   * cabeçalho, nunca uma adição: não some com `discount` da venda.
   */
  couponDiscount: number;
}

/** Quanto da loja a campanha moveu no intervalo dela, em pontos percentuais. */
export interface CampaignReportShareDto {
  salesPercentage: number;
  revenuePercentage: number;
  profitPercentage: number;
}

/**
 * Um dia da série comparativa. Dias sem movimento vêm com zero em vez de
 * faltarem, senão o gráfico emenda o dia 3 no dia 7 e uma semana parada vira
 * uma reta ascendente.
 */
export interface CampaignReportDailyPointDto {
  /** Dia-calendário à meia-noite, como instante ("2026-09-01T00:00:00"). */
  day: string;
  redemptions: number;
  campaignRevenue: number;
  /** Faturamento de TODAS as vendas da loja no dia — o denominador. */
  periodRevenue: number;
}

/**
 * Desempenho de um cupom dentro da campanha. O código exibido é o SNAPSHOT do
 * resgate — o que estava impresso no panfleto —, e continua legível mesmo se o
 * cupom tiver sido excluído do cadastro depois.
 */
export interface CampaignReportCouponDto {
  couponId: number;
  code: string;
  redemptions: number;
  revenue: number;
  couponDiscount: number;
}

/** Uma alternativa na distribuição de respostas. A agregação é por id; o rótulo é o do snapshot. */
export interface CampaignReportQuestionOptionDto {
  optionId: number;
  label: string;
  count: number;
  /** Participação sobre quem respondeu ESTA pergunta. */
  percentage: number;
  revenue: number;
  averageTicket: number;
}

/** Distribuição das respostas de uma pergunta. Só aparecem as alternativas escolhidas. */
export interface CampaignReportQuestionDto {
  questionId: number;
  /** Texto da pergunta como o operador leu no balcão (snapshot). */
  label: string;
  /** Resgates que responderam esta pergunta — menor que o total quando ela é opcional. */
  answered: number;
  options: CampaignReportQuestionOptionDto[];
}

/**
 * Relatório de uma campanha: o que ela moveu contra o que a loja fez no MESMO
 * intervalo.
 *
 * O recorte é sempre o intervalo da campanha (até agora quando o fim está em
 * aberto). Cupom vinculado a campanha encerrada continua valendo e o resgate
 * segue atribuído a ela, mas fica FORA deste relatório: não há denominador para
 * um dia em que a campanha não estava no ar, e incluí-lo produziria
 * participação acima de 100% da loja. Vendas canceladas ficam fora de tudo.
 */
export interface CampaignReportDto {
  campaignId: number;
  campaignName: string;
  startsAt: string;
  /** Ausente = campanha em aberto; os números vão até agora. */
  endsAt?: string | null;
  /** Resgates válidos — os que sustentam todos os valores em dinheiro. */
  redemptions: number;
  /** Estornados por cancelamento ou remoção do cupom na reedição; saem do faturamento. */
  reversed: number;
  /**
   * Resgates que entraram com o limite já esgotado, sempre pela fila offline.
   * Diferente de zero significa que a ação custou mais que o orçamento previa —
   * o backend nunca recusa venda já paga por causa do cupom.
   */
  overLimit: number;
  /** Resgates cujo snapshot não bate com a definição atual do cupom (editado no meio do caminho). */
  definitionDrift: number;
  campaign: CampaignReportCampaignTotalsDto;
  /** Todas as vendas da loja no mesmo intervalo — o grupo de controle. */
  period: CampaignReportTotalsDto;
  share: CampaignReportShareDto;
  daily: CampaignReportDailyPointDto[];
  coupons: CampaignReportCouponDto[];
  questions: CampaignReportQuestionDto[];
}

/**
 * Uma campanha no comparativo: o mesmo relatório achatado numa linha, para o
 * gráfico de barras e para a exportação em CSV.
 *
 * **Cada linha tem a própria janela.** Campanhas de meses diferentes têm
 * denominadores diferentes, e é por isso que os percentuais existem: R$ 30 mil
 * em dezembro e R$ 30 mil em fevereiro não são o mesmo resultado, mas 12% da
 * loja e 25% da loja são comparáveis.
 */
export interface CampaignComparisonRowDto {
  campaignId: number;
  campaignName: string;
  /** Início da campanha como cadastrado. */
  startsAt: string;
  /** Fim da campanha como cadastrado. Ausente = em aberto. */
  endsAt?: string | null;
  /**
   * Início do intervalo EFETIVAMENTE medido: a interseção da campanha com o
   * filtro de período. Viaja no DTO porque o CSV é lido fora do sistema, meses
   * depois — faturamento sem a janela ao lado é número que ninguém reproduz.
   */
  windowStart: string;
  /** Fim do intervalo medido, inclusivo. Nunca ausente: campanha em aberto é medida até agora. */
  windowEnd: string;
  redemptions: number;
  reversed: number;
  /** Vendas com cupom da campanha. Igual a `redemptions`: um cupom por venda. */
  salesCount: number;
  revenue: number;
  /** Lucro já líquido do rateio do cupom e do desconto manual. */
  profit: number;
  couponDiscount: number;
  averageTicket: number;
  marginPercentage: number;
  periodSalesCount: number;
  /** Faturamento da loja inteira na janela — o denominador desta linha. */
  periodRevenue: number;
  periodProfit: number;
  salesPercentage: number;
  revenuePercentage: number;
  profitPercentage: number;
}

/**
 * Dados enviados ao criar/editar um cupom (`SaveCouponRequest` do backend).
 *
 * O código é normalizado no servidor (`trim` + maiúsculas), mas mandá-lo já
 * canônico evita a surpresa de digitar "verao26" e ver "VERAO26" gravado.
 */
export interface SaveCouponPayload {
  code: string;
  description?: string | null;
  /** Nunca envie `None` (0): o backend recusa com 400. */
  discountType: CouponDiscountTypeCode;
  /** Maior que zero; até 100 quando o tipo é percentual. */
  discountValue: number;
  /** Instante "yyyy-MM-ddTHH:mm:ss", sem `Z`. Obrigatório. */
  validFrom: string;
  /** Instante ou null/omitido para cupom sem prazo. Deve ser >= `validFrom`. */
  validUntil?: string | null;
  /**
   * Teto de resgates. **0 = ILIMITADO** (negativo é normalizado para 0 no
   * servidor). Campo vazio no formulário vira 0 com `parseAmountOrNull`, nunca
   * `parseAmount`, que devolveria `NaN` e mandaria lixo ao servidor.
   */
  usageLimit: number;
  isActive: boolean;
  /** Campanha que fornece o questionário, ou null para cupom sem perguntas. */
  campaignId?: number | null;
}

/** Uma alternativa no salvamento do questionário. Sem `id` (ou com 0) o servidor cria. */
export interface SaveCampaignQuestionOptionPayload {
  id?: number | null;
  label: string;
  sortOrder: number;
}

/** Uma pergunta no salvamento do questionário. Precisa de 2 a 8 opções ativas. */
export interface SaveCampaignQuestionPayload {
  id?: number | null;
  label: string;
  sortOrder: number;
  isRequired: boolean;
  options: SaveCampaignQuestionOptionPayload[];
}

/**
 * Dados enviados ao criar/editar uma campanha (`SaveCampaignRequest` do backend).
 *
 * **`questions` é o estado final desejado, nunca um delta.** O servidor faz
 * upsert por id dentro de uma transação: com id atualiza, sem id cria, e o que
 * NÃO vier na lista é excluído logicamente. Mandar só as perguntas alteradas
 * apagaria todas as outras — e as respostas já gravadas continuariam apontando
 * para elas, porque a exclusão é lógica.
 *
 * Limites impostos pelo servidor: no máximo 6 perguntas, de 2 a 8 opções cada,
 * rótulos distintos dentro da mesma pergunta. É fila de caixa, não formulário de
 * pesquisa.
 */
export interface SaveCampaignPayload {
  name: string;
  description?: string | null;
  /** Instante "yyyy-MM-ddTHH:mm:ss", sem `Z`. Obrigatório. */
  startsAt: string;
  /** Instante ou null/omitido para período em aberto. Deve ser >= `startsAt`. */
  endsAt?: string | null;
  isActive: boolean;
  questions: SaveCampaignQuestionPayload[];
}

// ---------------------------------------------------------------------------
// Payloads de escrita
//
// Nove mutations recebiam `data: unknown`, o que anulava a verificação de tipo
// exatamente onde ela mais vale: no que é ENVIADO ao servidor. Campo com nome
// errado ou faltando passava batido no front e voltava como 400 em produção.
//
// Os payloads derivam dos DTOs com Omit dos campos que o servidor gera — assim
// um campo novo no DTO aparece aqui sozinho.
// ---------------------------------------------------------------------------

/** Campos que o servidor preenche e o cliente nunca envia. */
type CamposDoServidor = "id" | "createdAt" | "updatedAt";

export type CreateCategoryPayload = Omit<CategoryDto, CamposDoServidor | "productCount">;
export type UpdateCategoryPayload = CreateCategoryPayload;

export type CreateCustomerPayload = Omit<CustomerDto, CamposDoServidor>;
export type UpdateCustomerPayload = CreateCustomerPayload;

export type CreateUserPayload = Omit<UserDto, CamposDoServidor> & {
  /** Só no cadastro; a troca de senha tem endpoint próprio. */
  password?: string;
};
export type UpdateUserPayload = Omit<UserDto, CamposDoServidor>;

/** Grade de variação. O `values` é a lista de opções (P, M, G). */
export type SaveGradePayload = Omit<GradeDto, CamposDoServidor>;
