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

/** Períodos pré-configurados do seletor. */
export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "1y";

/** Modo de seleção de período: pré-configurado ou intervalo livre no calendário. */
export type PeriodMode = "preset" | "custom";

/** Intervalo resolvido que vai para a API, no formato `yyyy-MM-dd`. */
export type ResolvedPeriod = {
  startDate: string;
  endDate: string;
  label: string;
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

/** Fatia de uma quebra do faturamento (categoria, forma de pagamento). */
export type DashboardBreakdown = {
  id: number | null;
  name: string;
  revenue: number;
  profit: number;
  salesCount: number;
  itemsCount: number;
  percentageOfTotal: number;
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
