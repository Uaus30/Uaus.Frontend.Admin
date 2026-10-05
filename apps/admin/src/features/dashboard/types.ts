/**
 * Contratos do painel administrativo, espelhando os DTOs de `/Dashboard` no
 * backend (`Uaus.Application/DTOs/Dashboard`).
 *
 * Convenções que valem para todos eles:
 * - `revenue` já vem líquido do desconto da venda.
 * - `profit` é o lucro dos itens menos o desconto do cabeçalho.
 * - Vendas canceladas nunca entram nos números.
 * - Datas chegam como `"2026-07-25T00:00:00"`, sem fuso: são horário de Brasília.
 */

/**
 * Períodos pré-configurados. O catálogo é compartilhado com as telas de BI (Curva
 * ABC, Desempenho de produtos e de fornecedores); cada tela oferece o seu
 * subconjunto — ver `PERIOD_PRESETS` e `DASHBOARD_PRESETS`.
 */
export type PeriodPreset = "today" | "month" | "lastMonth" | "7d" | "30d" | "90d" | "1y";

/** Modo de seleção de período: pré-configurado ou intervalo livre no calendário. */
export type PeriodMode = "preset" | "custom";

/** Intervalo resolvido que vai para a API, no formato `yyyy-MM-dd`. */
export type ResolvedPeriod = {
  startDate: string;
  endDate: string;
  label: string;
};

/**
 * Base contra a qual os cards calculam a variação.
 *
 * `label` acompanha o percentual no card; `description` vai para a dica que abre
 * ao passar o mouse, com as datas exatas e o porquê da escolha.
 */
export type ComparisonPeriod = {
  startDate: string;
  endDate: string;
  label: string;
  description: string;
};

export type PeriodTotals = {
  startDate: string;
  endDate: string;
  revenue: number;
  cost: number;
  profit: number;
  discount: number;
  marginPercentage: number;
  salesCount: number;
  cancelledSalesCount: number;
  itemsCount: number;
  averageTicket: number;
};

export type DashboardSeriesPoint = {
  date: string;
  revenue: number;
  profit: number;
  salesCount: number;
  itemsCount: number;
};

/** Fatia de uma quebra do faturamento (departamento, categoria, forma de pagamento). */
export type DashboardBreakdown = {
  id: number | null;
  name: string;
  revenue: number;
  profit: number;
  salesCount: number;
  itemsCount: number;
  percentageOfTotal: number;
  /** Na categoria, o departamento dela. Omitido pela API quando não se aplica. */
  parentId?: number | null;
  /** Faturamento na base de comparação — só no departamento. Omitido quando não calculado. */
  previousRevenue?: number | null;
};

export type DashboardTopProduct = {
  id: number;
  name: string;
  barcode: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
  marginPercentage: number;
  stock: number;
  minStock: number;
};

export type DashboardOverview = {
  current: PeriodTotals;
  previous: PeriodTotals;
  series: DashboardSeriesPoint[];
  byCategory: DashboardBreakdown[];
  /** Departamentos, com `previousRevenue`; as categorias de cada um ligam por `parentId`. */
  byDepartment: DashboardBreakdown[];
  byPaymentMethod: DashboardBreakdown[];
  topProducts: DashboardTopProduct[];
};

export type DashboardHourPoint = {
  hour: number;
  revenue: number;
  profit: number;
  salesCount: number;
};

export type DashboardToday = {
  referenceDate: string;
  serverTime: string;
  revenue: number;
  profit: number;
  discount: number;
  salesCount: number;
  cancelledSalesCount: number;
  itemsCount: number;
  averageTicket: number;
  marginPercentage: number;
  lastSaleAt: string | null;
  yesterdayRevenue: number;
  /** Faturamento de ontem acumulado até este mesmo horário. */
  yesterdaySameTimeRevenue: number;
  weekdayAverageRevenue: number;
  weekdayAverageSameTimeRevenue: number;
  weekdaySampleSize: number;
  openCashRegisterSessions: number;
  hours: DashboardHourPoint[];
  topProducts: DashboardTopProduct[];
};

export type MonthDayPoint = {
  day: number;
  revenue: number;
  profit: number;
  accumulatedRevenue: number;
  accumulatedProfit: number;
  salesCount: number;
  /** Falso nos dias do mês corrente que ainda não aconteceram. */
  hasHappened: boolean;
};

export type MonthSummary = {
  year: number;
  month: number;
  label: string;
  startDate: string;
  endDate: string;
  daysElapsed: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  revenue: number;
  profit: number;
  discount: number;
  salesCount: number;
  itemsCount: number;
  averageTicket: number;
  marginPercentage: number;
  dailyAverageRevenue: number;
  days: MonthDayPoint[];
};

export type DashboardMonthly = {
  currentMonth: MonthSummary;
  previousMonth: MonthSummary;
  previousMonthSameDayRevenue: number;
  previousMonthSameDayProfit: number;
  previousMonthSameDaySalesCount: number;
  projectedRevenue: number;
  projectedProfit: number;
  history: MonthSummary[];
  /** Régua do dia "normal", medida nos três meses fechados antes do corrente. */
  reference: DailyReference;
};

/** Média de um dia da semana dentro da janela de referência. */
export type WeekdayReference = {
  /** 0 é domingo, 6 é sábado — o mesmo de `Date.getDay()`. */
  dayOfWeek: number;
  daysWithSales: number;
  averageRevenue: number;
};

/**
 * Faturamento típico de um dia de loja aberta. Só conta dias com venda: domingos
 * e feriados fechados puxariam a média para baixo e todo dia comum pareceria forte.
 */
export type DailyReference = {
  startDate: string;
  endDate: string;
  daysWithSales: number;
  averageRevenue: number;
  /** Sempre os sete dias, na ordem de `dayOfWeek`. */
  weekdays: WeekdayReference[];
};

export type PatternBucket = {
  key: number;
  label: string;
  revenue: number;
  profit: number;
  salesCount: number;
  itemsCount: number;
  /** Quantas vezes o balde ocorreu no período — o denominador das médias. */
  occurrences: number;
  averageRevenue: number;
  averageProfit: number;
  averageSalesCount: number;
  percentageOfTotal: number;
};

export type DashboardPatterns = {
  startDate: string;
  endDate: string;
  lastRefreshedAt: string | null;
  /** Existem vendas mais novas que o último processamento da tabela agregada. */
  isStale: boolean;
  totalRevenue: number;
  totalProfit: number;
  totalSalesCount: number;
  daysWithSales: number;
  byWeekday: PatternBucket[];
  byHour: PatternBucket[];
  byMonthDay: PatternBucket[];
};

export type DashboardPatternsRefresh = {
  refreshedAt: string;
  fromDate: string | null;
  rowsAffected: number;
  wasFullRebuild: boolean;
};

/** Faixas de urgência da lista de reposição, da mais grave para a mais branda. */
export type RestockUrgency = "out" | "critical" | "high" | "watch";

export type RestockSuggestion = {
  productId: number;
  productName: string;
  barcode: string;
  categoryName: string;
  supplierName: string | null;
  stock: number;
  minStock: number;
  price: number;
  costPrice: number;
  marginPercentage: number;
  quantitySold: number;
  revenue: number;
  profit: number;
  averageDailySales: number;
  daysOfCover: number | null;
  profitPerDay: number;
  /** Lucro estimado em risco dentro do horizonte de reposição. */
  score: number;
  urgency: RestockUrgency;
  suggestedPurchaseQuantity: number;
};

export type ProductAffinity = {
  productId: number;
  productName: string;
  companionProductId: number;
  companionProductName: string;
  togetherCount: number;
  productSalesCount: number;
  companionSalesCount: number;
  /** Percentual das vendas do produto que levaram também o companheiro. */
  confidence: number;
  lift: number;
  support: number;
  revenue: number;
};

export type BaitProduct = {
  productId: number;
  productName: string;
  barcode: string;
  categoryName: string;
  salesWithProduct: number;
  salesAlone: number;
  attachRate: number;
  averageBasketValue: number;
  averageBasketValueWithout: number;
  basketUplift: number;
  revenue: number;
  marginPercentage: number;
  stock: number;
  topCompanionName: string | null;
};

export type DashboardIntelligence = {
  lookbackDays: number;
  startDate: string;
  endDate: string;
  analyzedSalesCount: number;
  restock: RestockSuggestion[];
  affinities: ProductAffinity[];
  baits: BaitProduct[];
};

/**
 * Leitura do estoque de um campeão (regra no backend, `ChampionStockAlert`):
 * zerado, acaba em menos de 7 dias, menos de 15 dias ou no mínimo, tranquilo, ou
 * controle de estoque desligado.
 */
export type ChampionStockAlert = "out" | "critical" | "low" | "ok" | "untracked";

export type DashboardChampion = {
  rank: number;
  /** Posição na janela anterior; omitida quando o produto não vendeu lá. */
  previousRank?: number | null;
  id: number;
  productGroupId: number;
  name: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
  marginPercentage: number;
  /** Participação no lucro de todos os produtos da janela, em pontos percentuais. */
  profitShare: number;
  stock: number;
  minStock: number;
  stockControlEnabled: boolean;
  /** Omitido quando o controle de estoque está desligado. */
  daysOfCover?: number | null;
  hasOpenPurchase: boolean;
  stockAlert: ChampionStockAlert;
};

export type DashboardChampions = {
  startDate: string;
  endDate: string;
  days: number;
  totalRevenue: number;
  totalProfit: number;
  totalProducts: number;
  hasMore: boolean;
  products: DashboardChampion[];
};
