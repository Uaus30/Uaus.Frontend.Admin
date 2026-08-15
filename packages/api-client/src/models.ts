

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
  discount: number;
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
   * `null` quando não houve base de comparação — "não há com o que comparar" é
   * diferente de "não variou", e a tela precisa distinguir os dois.
   */
  changePercentage: number | null;
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
  /** `null` quando a loja nunca vendeu antes de hoje. */
  previousSalesDay: PerformanceDayDto | null;
  week: PerformanceRangeDto;
  month: PerformanceRangeDto;
  weekdayComparison: WeekdayComparisonDto[];
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
