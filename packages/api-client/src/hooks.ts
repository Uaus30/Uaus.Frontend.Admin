import { useQuery, type UseQueryOptions, type UseMutationOptions, } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, ApiError, buildUrl, useCrudMutation, apiRequest, mapPagedResult, extractCreatedId, getAuthSession, setAuthSession, clearAuthSession, isTokenExpired } from './client';
import { ApiResponse, AuthenticatedUserDto, BackendPagedResult, CashRegisterSessionDto, CategoryDto, CreateFinancialClosingPayload, CreatePartnerPayload, CreatePaymentMethodRequest, CustomerDto, EnumValue, FinancialClosingDto, FinancialClosingPreviewDto, FinancialReportSummaryDto, FixedCostDto, GradeDto, PartnerDto, PartnerProfitSharesDto, PaymentMethodDto, PreviewFinancialClosingPayload, QueryKey, SaleDto, SaleItemDto, SaveFixedCostPayload, UiPagedResult, UpdatePartnerPayload, UpdatePartnerProfitSharesPayload, UpdatePaymentMethodRequest, UserDto, UserListDto } from './models';export const getGetMeQueryKey = (): QueryKey => ["auth", "me"];
export const getGetUsersQueryKey = (): QueryKey => ["users"];
export const getGetCustomersQueryKey = (): QueryKey => ["customers"];
export const getGetSalesQueryKey = (): QueryKey => ["sales"];
export const getGetCategoriesQueryKey = (): QueryKey => ["categories"];

export function useGetMe(options?: {
  query?: Omit<UseQueryOptions<UserDto | null, ApiError, UserDto | null, QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<UserDto | null, ApiError, UserDto | null, QueryKey>({
    queryKey: getGetMeQueryKey(),
    queryFn: async () => {
      const session = getAuthSession();
      if (!session || isTokenExpired(session)) {
        clearAuthSession();
        return null;
      }
      return session.user;
    },
    ...options?.query,
  });
}

export function useLogin(options?: {
  mutation?: UseMutationOptions<
    AuthenticatedUserDto,
    ApiError,
    { data: { login?: string; email?: string; username?: string; password: string } }
  >;
}) {
  return useCrudMutation(async ({ data }) => {
    const login = data.login ?? data.username ?? data.email ?? "";
    // Credenciais vão no CORPO JSON, nunca em params: querystring com senha fica
    // gravada em logs de acesso (proxy/gateway) e no histórico do navegador.
    const authResponse = await apiRequest<AuthenticatedUserDto>("POST", "/Users/authenticate", {
      body: {
        login,
        password: data.password,
      },
      auth: false,
    });

    const session = authResponse.data as AuthenticatedUserDto;
    setAuthSession(session);
    return session;
  }, options);
}

export function useLogout(options?: {
  mutation?: UseMutationOptions<void, ApiError, void>;
}) {
  return useCrudMutation(async () => {
    clearAuthSession();
  }, options);
}

export function useGetUsers(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<UserListDto>, ApiError, UiPagedResult<UserListDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<UserListDto>, ApiError, UiPagedResult<UserListDto>, QueryKey>({
    queryKey: [...getGetUsersQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<UserListDto>>("/Users", {
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useCreateUser(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<null>("/Users", data);
    return response.data;
  }, options);
}

export function useUpdateUser(options?: {
  mutation?: UseMutationOptions<UserDto | null, ApiError, { id: number; data: unknown }>;
}) {
  return useCrudMutation(async ({ id, data }) => {
    const response = await apiPut<UserDto>("/Users", { id, ...(data as object) });
    return response.data;
  }, options);
}

export function useDeleteUser(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Users/${id}`);
    return response.data;
  }, options);
}

export function useGetCustomers(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<CustomerDto>, ApiError, UiPagedResult<CustomerDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<CustomerDto>, ApiError, UiPagedResult<CustomerDto>, QueryKey>({
    queryKey: [...getGetCustomersQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<CustomerDto>>("/Customers", {
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useCreateCustomer(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<null>("/Customers", data);
    return response.data;
  }, options);
}

export function useUpdateCustomer(options?: {
  mutation?: UseMutationOptions<CustomerDto | null, ApiError, { id: number; data: unknown }>;
}) {
  return useCrudMutation(async ({ id, data }) => {
    const response = await apiPut<CustomerDto>("/Customers", { id, ...(data as object) });
    return response.data;
  }, options);
}

export function useDeleteCustomer(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Customers/${id}`);
    return response.data;
  }, options);
}

export function useGetSales(
  params?: {
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethodId?: number;
    paymentStatus?: number;
    page?: number;
    limit?: number;
  },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>({
    queryKey: [...getGetSalesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<SaleDto>>("/Sales", {
        search: params?.search,
        startDate: params?.startDate,
        endDate: params?.endDate,
        paymentMethodId: params?.paymentMethodId,
        paymentStatus: params?.paymentStatus,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useCreateSale(options?: {
  mutation?: UseMutationOptions<ApiResponse<null>, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => apiPost<null>("/Sales", data), options);
}

export function useDeleteSale(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Sales/${id}`);
    return response.data;
  }, options);
}

export function useGetSaleDetails(
  id?: number,
  options?: {
    query?: Omit<UseQueryOptions<SaleDto, ApiError, SaleDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<SaleDto, ApiError, SaleDto, QueryKey>({
    queryKey: ["sale-details", id ?? 0],
    queryFn: async () => {
      return await apiGet<SaleDto>(`/Sales/${id}`);
    },
    enabled: !!id,
    ...options?.query,
  });
}

export function useGetSaleItems(
  params?: { saleId?: number; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<SaleItemDto>, ApiError, UiPagedResult<SaleItemDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<SaleItemDto>, ApiError, UiPagedResult<SaleItemDto>, QueryKey>({
    queryKey: ["sale-items-by-sale-id", params?.saleId ?? 0, params?.page ?? 1, params?.limit ?? 100],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<SaleItemDto>>("/SaleItems", {
        saleId: params?.saleId,
        page: params?.page ?? 1,
        size: params?.limit ?? 100,
      });
      return mapPagedResult(result);
    },
    enabled: !!params?.saleId,
    ...options?.query,
  });
}

export function useGetCategories(
  params?: { search?: string; departmentId?: number; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<CategoryDto>, ApiError, UiPagedResult<CategoryDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<CategoryDto>, ApiError, UiPagedResult<CategoryDto>, QueryKey>({
    queryKey: [...getGetCategoriesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<CategoryDto>>("/Categories", {
        search: params?.search,
        departmentId: params?.departmentId,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useCreateCategory(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<null>("/Categories", data);
    return response.data;
  }, options);
}

export function useUpdateCategory(options?: {
  mutation?: UseMutationOptions<CategoryDto | null, ApiError, { id: number; data: unknown }>;
}) {
  return useCrudMutation(async ({ id, data }) => {
    const response = await apiPut<CategoryDto>("/Categories", { id, ...(data as object) });
    return response.data;
  }, options);
}

export function useDeleteCategory(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Categories/${id}`);
    return response.data;
  }, options);
}

export const getGetGradesQueryKey = (): QueryKey => ["grades"];

export function useGetGrades(options?: {
  query?: Omit<UseQueryOptions<GradeDto[], ApiError, GradeDto[], QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<GradeDto[], ApiError, GradeDto[], QueryKey>({
    queryKey: getGetGradesQueryKey(),
    queryFn: async () => {
      return apiGet<GradeDto[]>("/Grades");
    },
    ...options?.query,
  });
}

export function useCreateGrade(options?: {
  mutation?: UseMutationOptions<GradeDto, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<GradeDto>("/Grades", data);
    if (!response.data) throw new Error("Não foi possível obter a grade criada.");
    return response.data;
  }, options);
}

export function useUpdateGrade(options?: {
  mutation?: UseMutationOptions<GradeDto, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPut<GradeDto>("/Grades", data);
    if (!response.data) throw new Error("Não foi possível obter a grade atualizada.");
    return response.data;
  }, options);
}

export function useDeleteGrade(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Grades/${id}`);
    return response.data;
  }, options);
}

// ==========================================
// INVENTORY & PURCHASE ENTRIES TYPES & HOOKS
// ==========================================

export interface PurchaseEntryDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  supplierId: number;
  entryDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  total: number;
}

export interface ReceivedPurchaseEntryItemDto {
  id: number;
  stockLotId: number;
  productId: number;
  productName: string;
  barcode: string;
  imageUrl: string | null;
  productPrice: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  availableQuantity: number;
  hasConsumedStock: boolean;
}

export interface ReceivedPurchaseEntryDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  supplierId: number;
  supplierName: string;
  entryDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  total: number;
  canEdit: boolean;
  canDelete: boolean;
  items: ReceivedPurchaseEntryItemDto[];
}

export interface ReceivePurchaseEntryItemRequest {
  productId: number;
  quantity: number;
  unitCost: number;
  price: number;
}

export interface ReceivePurchaseEntryRequest {
  supplierId: number;
  entryDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  items: ReceivePurchaseEntryItemRequest[];
}

export interface InventoryMetricsDto {
  totalProductsWithControl: number;
  totalUnits: number;
  totalValueMerchandise: number;
  totalValueCost: number;
  totalEstimatedProfit: number;
  marginPercentage: number;
  alertsNoStock: number;
  alertsLowStock: number;
}

export interface CategoryInventorySummaryDto {
  categoryName: string;
  productsCount: number;
  unitsCount: number;
  merchandiseValue: number;
  estimatedProfit: number;
  percentageOfTotalValue: number;
}

export interface InventoryItemDto {
  id: number;
  productName: string;
  barcode: string;
  supplierName: string;
  categoryName: string;
  stock: number;
  unitCost: number;
  unitSale: number;
  totalCost: number;
  mercadoria: number;
  estimatedProfit: number;
  marginPercentage: number;
}

export interface BackendInventoryReportDto {
  metrics: InventoryMetricsDto;
  categorySummaries: CategoryInventorySummaryDto[];
  items: BackendPagedResult<InventoryItemDto>;
}

export interface InventoryReportDto {
  metrics: InventoryMetricsDto;
  categorySummaries: CategoryInventorySummaryDto[];
  items: UiPagedResult<InventoryItemDto>;
}

export function useGetPurchaseEntries(
  params?: { supplierId?: number; productId?: number; barcode?: string; startDate?: string; endDate?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<PurchaseEntryDto>, ApiError, UiPagedResult<PurchaseEntryDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<PurchaseEntryDto>, ApiError, UiPagedResult<PurchaseEntryDto>, QueryKey>({
    queryKey: ["purchase-entries", params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<PurchaseEntryDto>>("/PurchaseEntries", {
        supplierId: params?.supplierId,
        productId: params?.productId,
        barcode: params?.barcode,
        startDate: params?.startDate,
        endDate: params?.endDate,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useGetPurchaseEntryDetails(
  id: number,
  options?: {
    query?: Omit<UseQueryOptions<ReceivedPurchaseEntryDto, ApiError, ReceivedPurchaseEntryDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<ReceivedPurchaseEntryDto, ApiError, ReceivedPurchaseEntryDto, QueryKey>({
    queryKey: ["purchase-entry-details", id],
    enabled: !!id,
    queryFn: async () => {
      return apiGet<ReceivedPurchaseEntryDto>(`/PurchaseEntries/${id}/details`);
    },
    ...options?.query,
  });
}

export function useReceivePurchaseEntry(options?: {
  mutation?: UseMutationOptions<ReceivedPurchaseEntryDto, ApiError, { data: ReceivePurchaseEntryRequest }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<ReceivedPurchaseEntryDto>("/PurchaseEntries/receive", data);
    if (!response.data) throw new Error("Não foi possível obter os dados da entrada.");
    return response.data;
  }, options);
}

export function useDeletePurchaseEntry(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/PurchaseEntries/${id}`);
    return response.data;
  }, options);
}

export function useGetInventoryReport(
  params?: { search?: string; supplierId?: number; categoryId?: number; stockStatus?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<InventoryReportDto, ApiError, InventoryReportDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<InventoryReportDto, ApiError, InventoryReportDto, QueryKey>({
    queryKey: ["inventory-report", params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendInventoryReportDto>("/Inventory", {
        search: params?.search,
        supplierId: params?.supplierId,
        categoryId: params?.categoryId,
        stockStatus: params?.stockStatus,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return {
        metrics: result.metrics,
        categorySummaries: result.categorySummaries,
        items: mapPagedResult(result.items),
      };
    },
    ...options?.query,
  });
}

// ==========================================
// SYSTEM LOGS TYPES & HOOKS
// ==========================================

export interface SystemLogDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  code: string;
  requestId: string | null;
  type: string;
  origin: string;
  message: string;
  details: string | null;
}

export const getGetLogsQueryKey = (): QueryKey => ["logs"];

export function useGetLogs(
  params?: { search?: string; type?: string; startDate?: string; endDate?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<SystemLogDto>, ApiError, UiPagedResult<SystemLogDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<SystemLogDto>, ApiError, UiPagedResult<SystemLogDto>, QueryKey>({
    queryKey: [...getGetLogsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<SystemLogDto>>("/Logs", {
        search: params?.search,
        type: params?.type,
        startDate: params?.startDate,
        endDate: params?.endDate,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useGetLog(
  id: number,
  options?: {
    query?: Omit<UseQueryOptions<SystemLogDto, ApiError, SystemLogDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<SystemLogDto, ApiError, SystemLogDto, QueryKey>({
    queryKey: ["log-details", id],
    enabled: !isNaN(id) && id > 0,
    queryFn: async () => {
      return apiGet<SystemLogDto>(`/Logs/${id}`);
    },
    ...options?.query,
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const url = buildUrl("/health");
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    if (response.ok) {
      const text = await response.text();
      return text.trim() === "Ok";
    }
    return false;
  } catch {
    return false;
  }
}

// Payment Methods Hooks

export function getGetPaymentMethodsQueryKey(params?: { search?: string; isActive?: boolean; page?: number; size?: number }) {
  return ["PaymentMethods", params] as const;
}

export function useGetPaymentMethods(
  params?: { search?: string; isActive?: boolean; page?: number; size?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<PaymentMethodDto>, ApiError, UiPagedResult<PaymentMethodDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<PaymentMethodDto>, ApiError, UiPagedResult<PaymentMethodDto>, QueryKey>({
    queryKey: getGetPaymentMethodsQueryKey(params),
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<PaymentMethodDto>>("/PaymentMethods", {
        search: params?.search,
        isActive: params?.isActive,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useGetPaymentMethodById(
  id: number,
  options?: {
    query?: Omit<UseQueryOptions<PaymentMethodDto, ApiError, PaymentMethodDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<PaymentMethodDto, ApiError, PaymentMethodDto, QueryKey>({
    queryKey: ["payment-method-details", id],
    enabled: !isNaN(id) && id > 0,
    queryFn: async () => {
      return apiGet<PaymentMethodDto>(`/PaymentMethods/${id}`);
    },
    ...options?.query,
  });
}

export function useCreatePaymentMethod(options?: {
  mutation?: UseMutationOptions<PaymentMethodDto | null, ApiError, { data: CreatePaymentMethodRequest }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<PaymentMethodDto>("/PaymentMethods", data);
    return response.data;
  }, options);
}

export function useUpdatePaymentMethod(options?: {
  mutation?: UseMutationOptions<PaymentMethodDto | null, ApiError, { data: UpdatePaymentMethodRequest }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPut<PaymentMethodDto>("/PaymentMethods", data);
    return response.data;
  }, options);
}

export function useDeletePaymentMethod(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/PaymentMethods/${id}`);
    return response.data;
  }, options);
}




// Cash Register Sessions Hooks

/** Chave de cache da listagem de sessões de caixa. */
export function getGetCashRegisterSessionsQueryKey(params?: {
  userId?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}) {
  return ["CashRegisterSessions", params] as const;
}

/** Chave de cache da sessão de caixa aberta do operador. */
export const CURRENT_CASH_REGISTER_SESSION_QUERY_KEY = ["cash-register-session-current"] as const;

/**
 * Lista as sessões de caixa, das mais recentes para as mais antigas.
 *
 * @param params Filtros por operador, status, período e paginação.
 */
export function useGetCashRegisterSessions(
  params?: { userId?: number; status?: number; startDate?: string; endDate?: string; page?: number; size?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<CashRegisterSessionDto>, ApiError, UiPagedResult<CashRegisterSessionDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CashRegisterSessionDto>, ApiError, UiPagedResult<CashRegisterSessionDto>, QueryKey>({
    queryKey: getGetCashRegisterSessionsQueryKey(params),
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<CashRegisterSessionDto>>("/CashRegisterSessions", {
        userId: params?.userId,
        status: params?.status,
        startDate: params?.startDate,
        endDate: params?.endDate,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Sessão de caixa aberta do operador autenticado.
 * Retorna null quando o caixa está fechado (a API responde 204).
 */
export function useGetCurrentCashRegisterSession(options?: {
  query?: Omit<
    UseQueryOptions<CashRegisterSessionDto | null, ApiError, CashRegisterSessionDto | null, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<CashRegisterSessionDto | null, ApiError, CashRegisterSessionDto | null, QueryKey>({
    queryKey: CURRENT_CASH_REGISTER_SESSION_QUERY_KEY,
    queryFn: async () => {
      const result = await apiRequest<CashRegisterSessionDto>("GET", "/CashRegisterSessions/current");
      return result.data ?? null;
    },
    ...options?.query,
  });
}

/**
 * Detalha uma sessão de caixa com o resumo consolidado das vendas.
 *
 * @param id ID da sessão; a query fica desabilitada enquanto for indefinido.
 */
export function useGetCashRegisterSessionById(
  id?: number,
  options?: {
    query?: Omit<UseQueryOptions<CashRegisterSessionDto, ApiError, CashRegisterSessionDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<CashRegisterSessionDto, ApiError, CashRegisterSessionDto, QueryKey>({
    queryKey: ["cash-register-session-details", id ?? 0],
    enabled: !!id,
    queryFn: async () => apiGet<CashRegisterSessionDto>(`/CashRegisterSessions/${id}`),
    ...options?.query,
  });
}

/**
 * Abre o caixa do operador autenticado.
 *
 * @param data Fundo de troco colocado na gaveta e observações da abertura.
 * @returns A sessão recém-aberta.
 */
export async function openCashRegisterSession(data: { openingBalance: number; openingNotes?: string | null }) {
  const response = await apiPost<CashRegisterSessionDto>("/CashRegisterSessions/open", data);
  return response.data;
}

/**
 * Fecha o caixa conferindo o dinheiro em gaveta contra o valor esperado
 * (fundo de troco somado ao recebido em espécie).
 *
 * @param id ID da sessão aberta.
 * @param data Valor contado na gaveta e observações do fechamento.
 * @returns A sessão fechada, já com contado, esperado e diferença.
 */
export async function closeCashRegisterSession(
  id: number,
  data: { countedAmount: number; closingNotes?: string | null },
) {
  const response = await apiPost<CashRegisterSessionDto>(`/CashRegisterSessions/${id}/close`, data);
  return response.data;
}

/**
 * Cancela a venda devolvendo ao estoque os lotes consumidos pelos itens.
 * A venda continua existindo, marcada como cancelada, para preservar o histórico.
 *
 * @param id ID da venda.
 * @param reason Motivo do cancelamento, anexado à observação da venda.
 * @returns A venda já cancelada.
 */
export async function cancelSale(id: number, reason?: string | null) {
  const response = await apiPost<SaleDto>(`/Sales/${id}/cancel`, { reason: reason ?? null });
  return response.data;
}

// ---------------------------------------------------------------------------
// PDV — busca de balcão, histórico do turno, reedição de venda e venda
// completa do painel administrativo
//
// Contrato do backend em Uaus.Backend.Api/docs/pdv-offline.md.
// ---------------------------------------------------------------------------

/**
 * Produto na busca do balcão (`GET /Pdv/products/search`): só o que o operador
 * precisa para encontrar o produto e vendê-lo. Campos sensíveis do cadastro
 * (custo, margem, fornecedor) ficam fora de propósito — o endpoint é liberado
 * para `Seller`.
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
export async function searchPdvProducts(
  term: string,
  limit = 20,
): Promise<ProductPdvSearchDto[]> {
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

/** Um item vendido, no formato que `POST /Pdv/sales` e `PUT /Pdv/sales/{id}` esperam. */
export interface RegisterPdvSaleItemPayload {
  productId: number;
  quantity: number;
  /** Preço unitário praticado, já líquido do desconto do item. */
  unitPrice: number;
  /**
   * Desconto unitário concedido no item, em reais, apenas para auditoria: o
   * preço de tabela no momento da venda era `unitPrice + discount`. Não
   * participa da validação de totais, mas conta para o limite de desconto do
   * `Seller` (ver `RegisterPdvSalePayload.managerLogin`).
   */
  discount?: number;
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
  /** Sessão de caixa da venda, ou nulo quando a loja não controla caixa. */
  cashRegisterSessionId: number | null;
  customerId?: number | null;
  /** Nome do consumidor digitado no balcão. Ignorado quando há `customerId`. */
  customerName?: string | null;
  /** CPF/CNPJ digitado no balcão. Ignorado quando há `customerId`. */
  customerDocument?: string | null;
  /** Total da venda: soma dos itens menos o desconto. O servidor refaz a conta e recusa divergência. */
  total: number;
  /** Desconto aplicado sobre o total da venda. */
  discount: number;
  notes?: string | null;
  /**
   * Login do administrador que autoriza um desconto acima do limite do
   * vendedor.
   *
   * A regra: quando o operador é `Seller` e a empresa configurou
   * `maxSellerDiscountPercentage` > 0, qualquer desconto que exceda o limite —
   * o GLOBAL (`discount` como % do subtotal) ou o de ITEM (`discount` do item
   * como % do preço de tabela `unitPrice + discount`) — exige as credenciais
   * de um Admin. Sem autorização válida o servidor recusa a venda com erro
   * legível (e, no sync offline, a venda volta como `Rejected`). Admin
   * operando o caixa não tem limite.
   */
  managerLogin?: string | null;
  /**
   * Senha do administrador autorizador. Validada com o mesmo mecanismo do
   * login; nunca é gravada nem registrada em log pelo servidor.
   */
  managerPassword?: string | null;
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
export async function updatePdvSale(
  id: number,
  payload: RegisterPdvSalePayload,
): Promise<SaleDto | null> {
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
export async function createCompleteSale(
  payload: CreateCompleteSalePayload,
): Promise<number | null> {
  const response = await apiPost<SaleDto>("/Sales/complete", payload);
  return extractCreatedId(response.response);
}

// ---------------------------------------------------------------------------
// Baixas de estoque e configurações da empresa
//
// Contrato do backend em Uaus.Backend.Api/docs/baixas-de-estoque.md.
// ---------------------------------------------------------------------------

/** Motivos de baixa de estoque (enum StockWriteOffReason do backend). */
export const STOCK_WRITE_OFF_REASON = {
  None: 0,
  Consumption: 1,
  Loss: 2,
  Donation: 3,
  /** Gerado só pela importação da contagem; não aparece nos selects. */
  Inventory: 4,
} as const;

/** Situação de uma baixa (enum StockWriteOffStatus do backend). */
export const STOCK_WRITE_OFF_STATUS = {
  None: 0,
  Confirmed: 1,
  Reversed: 2,
} as const;

/** Rótulos dos motivos, para telas e cupons. */
export const STOCK_WRITE_OFF_REASON_LABEL: Record<number, string> = {
  [STOCK_WRITE_OFF_REASON.Consumption]: "Consumo",
  [STOCK_WRITE_OFF_REASON.Loss]: "Perda",
  [STOCK_WRITE_OFF_REASON.Donation]: "Doação",
  [STOCK_WRITE_OFF_REASON.Inventory]: "Inventário",
};

/**
 * Motivos que o operador pode escolher.
 *
 * Inventário fica de fora de propósito: ele é gerado pela importação da contagem,
 * que é o único caminho autorizado a baixar acima do saldo em lote.
 */
export const SELECTABLE_STOCK_WRITE_OFF_REASONS = [
  STOCK_WRITE_OFF_REASON.Consumption,
  STOCK_WRITE_OFF_REASON.Loss,
  STOCK_WRITE_OFF_REASON.Donation,
] as const;

export interface StockWriteOffItemDto {
  id: number;
  productId: number;
  productName: string | null;
  barcode: string | null;
  quantity: number;
  totalCost: number;
  unitCost: number;
}

export interface StockWriteOffDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  /** Enum StockWriteOffReason — pode vir como número ou nome; use ``. */
  reason: EnumValue;
  /** Enum StockWriteOffStatus — pode vir como número ou nome; use ``. */
  status: EnumValue;
  /** Momento real da baixa no balcão. */
  occurredAt: string;
  userId: number | null;
  userName: string | null;
  cashRegisterSessionId: number | null;
  totalQuantity: number;
  /** Custo FIFO congelado no momento da baixa. */
  totalCost: number;
  notes: string | null;
  reversedAt: string | null;
  reversedByUserName: string | null;
  reversalNotes: string | null;
  /** Preenchido apenas na consulta por ID. */
  items: StockWriteOffItemDto[];
}

/** Um produto e quanto sai dele. */
export interface StockWriteOffItemInput {
  productId: number;
  quantity: number;
}

export interface RegisterStockWriteOffInput {
  reason: number;
  items: StockWriteOffItemInput[];
  notes?: string | null;
  /**
   * Chave de idempotência gerada pelo PDV. Reenviar a mesma referência devolve a
   * baixa já gravada em vez de baixar o estoque duas vezes.
   */
  clientReference?: string | null;
  /**
   * Momento real da baixa, no horário da loja e sem fuso ("2026-07-25T17:34:12").
   * Só o PDV preenche, e apenas ao subir o que ficou na fila offline.
   */
  occurredAt?: string | null;
}

/** Consolidado das baixas de um turno, para o fechamento de caixa. */
export interface StockWriteOffSessionSummaryDto {
  count: number;
  totalQuantity: number;
  totalCost: number;
  byReason: Array<{
    reason: EnumValue;
    reasonName: string;
    quantity: number;
    totalCost: number;
  }>;
}

export const getGetStockWriteOffsQueryKey = (): QueryKey => ["stock-write-offs"];

export interface StockWriteOffFilters {
  reason?: number | null;
  status?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  userId?: number | null;
  cashRegisterSessionId?: number | null;
  page?: number;
  limit?: number;
}

/** Lista as baixas, das mais recentes para as mais antigas. */
export function useGetStockWriteOffs(
  params?: StockWriteOffFilters,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<StockWriteOffDto>, ApiError, UiPagedResult<StockWriteOffDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<StockWriteOffDto>, ApiError, UiPagedResult<StockWriteOffDto>, QueryKey>({
    queryKey: [...getGetStockWriteOffsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<StockWriteOffDto>>("/StockWriteOffs", {
        reason: params?.reason,
        status: params?.status,
        startDate: params?.startDate,
        endDate: params?.endDate,
        userId: params?.userId,
        cashRegisterSessionId: params?.cashRegisterSessionId,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Detalha uma baixa com os itens. */
export async function getStockWriteOff(id: number) {
  return apiGet<StockWriteOffDto>(`/StockWriteOffs/${id}`);
}

/**
 * Registra a baixa, consumindo lote por FIFO e reduzindo o saldo.
 *
 * @throws {ApiError} Quando algum item não tem saldo suficiente.
 */
export async function registerStockWriteOff(data: RegisterStockWriteOffInput) {
  const response = await apiPost<StockWriteOffDto>("/StockWriteOffs", data);
  return response.data;
}

/** Desfaz a baixa devolvendo aos lotes o que cada um cedeu. */
export async function reverseStockWriteOff(id: number, reason?: string | null) {
  const response = await apiPost<StockWriteOffDto>(`/StockWriteOffs/${id}/reverse`, {
    reason: reason ?? null,
  });
  return response.data;
}

/** Consolidado das baixas de um turno. */
export async function getStockWriteOffSessionSummary(cashRegisterSessionId: number) {
  return apiGet<StockWriteOffSessionSummaryDto>(
    `/StockWriteOffs/session/${cashRegisterSessionId}/summary`,
  );
}

/** Opções de operação da empresa. */
export interface CompanySettingsDto {
  /**
   * A loja controla caixa (abertura e fechamento por turno).
   *
   * Desligado, o PDV vende sem exigir abertura de caixa e as vendas e baixas
   * ficam sem sessão vinculada.
   */
  usesCashRegister: boolean;
  /**
   * Nome fantasia impresso em destaque no cabeçalho do cupom.
   *
   * Os cinco campos de identidade são opcionais por segurança de versão: um
   * backend anterior a eles responde sem os campos e o cupom cai nos valores
   * padrão embutidos (`resolveStoreInfo`, no pacote de cupom). No backend
   * atual eles sempre vêm — as colunas são `NOT NULL DEFAULT ''`.
   */
  storeName?: string;
  /** Endereço da loja em linha única, como sai impresso no cupom. */
  addressLine?: string;
  /** Telefone de contato, impresso exatamente como informado (rótulo incluso, se desejado). */
  phone?: string;
  /** CNPJ cru, sem rótulo — é o cupom que imprime o prefixo "CNPJ: ". */
  document?: string;
  /** Mensagem de agradecimento impressa no rodapé de todo cupom. */
  receiptFooterMessage?: string;
  /**
   * Limite de desconto do operador `Seller`, em percentual (0–100).
   *
   * `0` = sem limite. Vale tanto para o desconto GLOBAL (% sobre o subtotal)
   * quanto para o desconto por ITEM (% sobre o preço de tabela, que é
   * `unitPrice + discount`). Acima do limite, a venda só entra com a
   * autorização de um Admin (`managerLogin`/`managerPassword` no payload).
   * Admin operando o caixa não tem limite.
   *
   * Opcional por segurança de versão: um backend anterior ao campo responde
   * sem ele, e a ausência deve ser tratada como sem limite.
   */
  maxSellerDiscountPercentage?: number;
}

export const COMPANY_SETTINGS_QUERY_KEY = ["company-settings"] as const;

/**
 * Configurações da empresa.
 *
 * O backend nunca falha nesta leitura: sem a linha no banco ele devolve o padrão.
 * Ainda assim o PDV precisa de um padrão local, porque offline a chamada não sai.
 */
export function useGetCompanySettings(options?: {
  query?: Omit<
    UseQueryOptions<CompanySettingsDto, ApiError, CompanySettingsDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<CompanySettingsDto, ApiError, CompanySettingsDto, QueryKey>({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: () => apiGet<CompanySettingsDto>("/CompanySettings"),
    ...options?.query,
  });
}

/** Grava as configurações da empresa. */
export async function updateCompanySettings(data: CompanySettingsDto) {
  const response = await apiPut<CompanySettingsDto>("/CompanySettings", data);
  return response.data;
}

// ---------------------------------------------------------------------------
// Contagem de estoque por planilha
//
// Contrato do backend em Uaus.Backend.Api/docs/contagem-de-estoque.md.
// ---------------------------------------------------------------------------

/** Uma diferença apurada entre o sistema e a prateleira. */
export interface InventoryCountLineDto {
  rowNumber: number;
  productId: number;
  productName: string;
  barcode: string;
  /** Saldo que estava na planilha quando ela foi exportada. */
  stockAtExport: number;
  /**
   * Saldo agora.
   *
   * Exibido ao lado de `stockAtExport` para o dono enxergar que a diferença
   * entre os dois é venda ocorrida depois da exportação, e não erro de contagem.
   */
  currentStock: number;
  counted: number;
  /** Contado menos o saldo da exportação. Negativo é falta, positivo é sobra. */
  difference: number;
  /** Saldo que o produto terá depois de aplicar. */
  targetStock: number;
}

/** Uma linha que o sistema não conseguiu aproveitar. */
export interface InventoryCountIssueDto {
  rowNumber: number;
  /** `PRODUTO_NAO_IDENTIFICADO`, `CONTAGEM_INVALIDA`, `PRODUTO_DUPLICADO` ou `SEM_LOTE_DE_REFERENCIA`. */
  code: string;
  message: string;
}

/**
 * O que aconteceria (prévia) ou o que aconteceu (aplicação) com uma planilha.
 *
 * Prévia e resultado usam o mesmo formato de propósito: o dono confere a prévia
 * e espera ver exatamente aquilo depois de aplicar.
 */
export interface InventoryCountResultDto {
  /** Preenchido só na aplicação. */
  inventoryImportId: number | null;
  fileName: string;
  countedRows: number;
  /** Linhas com a célula em branco — não contadas. Em branco nunca é zero. */
  notCountedRows: number;
  shortages: InventoryCountLineDto[];
  surpluses: InventoryCountLineDto[];
  issues: InventoryCountIssueDto[];
  shortageQuantity: number;
  surplusQuantity: number;
  hasNoChanges: boolean;
  /** Impede a aplicação (hoje só produto duplicado no arquivo). */
  isBlocked: boolean;
  blockReason: string | null;
}

/**
 * Baixa a planilha de contagem.
 *
 * Não usa `apiGet`: aquele caminho lê a resposta como texto e corromperia o
 * .xlsx, que é binário.
 *
 * @returns O arquivo e o nome sugerido pelo servidor.
 */
export async function downloadInventoryCountSheet(): Promise<{ blob: Blob; fileName: string }> {
  const session = getAuthSession();
  const headers = new Headers();

  if (session?.token.value) {
    headers.set("Authorization", `Bearer ${session.token.value}`);
  }

  const response = await fetch(buildUrl("/InventoryCounts/export"), { method: "GET", headers });

  if (!response.ok) {
    throw new ApiError(
      `Erro ${response.status} ao gerar a planilha de contagem`,
      response.status,
      null,
      "GET",
      "/InventoryCounts/export",
    );
  }

  // O nome vem no Content-Disposition; o fallback cobre proxy que remove o header.
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);

  return {
    blob: await response.blob(),
    fileName: match ? decodeURIComponent(match[1]) : "contagem-de-estoque.xlsx",
  };
}

/** Envia a planilha preenchida sem gravar nada, só para ver o impacto. */
export async function previewInventoryCount(file: File) {
  const form = new FormData();
  form.append("file", file);

  const response = await apiPost<InventoryCountResultDto>("/InventoryCounts/preview", form);
  return response.data;
}

/**
 * Aplica a contagem: baixa as faltas e dá entrada nas sobras.
 *
 * A mesma planilha não pode ser aplicada duas vezes — a trava é o índice único
 * do hash do arquivo no banco.
 */
export async function applyInventoryCount(file: File) {
  const form = new FormData();
  form.append("file", file);

  const response = await apiPost<InventoryCountResultDto>("/InventoryCounts/apply", form);
  return response.data;
}

// ---------------------------------------------------------------------------
// Financeiro — custos fixos, sócios, relatório e fechamentos
//
// Contrato do backend em Uaus.Backend.Api/docs/financeiro.md.
// ---------------------------------------------------------------------------

/** Chave de cache da listagem de custos fixos. */
export function getGetFixedCostsQueryKey(params?: {
  search?: string;
  activeInMonth?: string;
  page?: number;
  limit?: number;
}) {
  return ["FixedCosts", params] as const;
}

/**
 * Lista os custos fixos.
 *
 * @param params `activeInMonth` ("yyyy-MM-01") filtra os vigentes naquele mês.
 */
export function useGetFixedCosts(
  params?: { search?: string; activeInMonth?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<FixedCostDto>, ApiError, UiPagedResult<FixedCostDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<FixedCostDto>, ApiError, UiPagedResult<FixedCostDto>, QueryKey>({
    queryKey: getGetFixedCostsQueryKey(params),
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<FixedCostDto>>("/FixedCosts", {
        search: params?.search,
        activeInMonth: params?.activeInMonth,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Cria um custo fixo.
 *
 * @returns O ID criado (do header Location) ou null se o header não vier.
 */
export async function createFixedCost(data: SaveFixedCostPayload): Promise<number | null> {
  const response = await apiPost<FixedCostDto>("/FixedCosts", data);
  return extractCreatedId(response.response);
}

/** Atualiza um custo fixo. "Encerrar" um custo = preencher `endsOn` (hard delete só para lançado errado). */
export async function updateFixedCost(
  id: number,
  data: SaveFixedCostPayload,
): Promise<FixedCostDto | null> {
  const response = await apiPut<FixedCostDto>(`/FixedCosts/${id}`, data);
  return response.data;
}

/**
 * Exclui um custo fixo de vez. Fechamentos existentes não mudam: eles congelam
 * os totais na confirmação e não dependem desta linha.
 */
export async function deleteFixedCost(id: number): Promise<void> {
  await apiDelete<null>(`/FixedCosts/${id}`);
}

/** Chave de cache da listagem de sócios. */
export function getGetPartnersQueryKey(params?: {
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}) {
  return ["Partners", params] as const;
}

/** Lista os sócios (a API devolve todos; a UI decide filtrar inativos). */
export function useGetPartners(
  params?: { includeInactive?: boolean; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<PartnerDto>, ApiError, UiPagedResult<PartnerDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<PartnerDto>, ApiError, UiPagedResult<PartnerDto>, QueryKey>({
    queryKey: getGetPartnersQueryKey(params),
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<PartnerDto>>("/Partners", {
        includeInactive: params?.includeInactive,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Chave de cache da distribuição de lucros entre os sócios. */
export const PARTNER_PROFIT_SHARES_QUERY_KEY = ["partner-profit-shares"] as const;

/** Distribuição de lucros vigente (percentual de cada sócio e a soma). */
export function useGetPartnerProfitShares(options?: {
  query?: Omit<
    UseQueryOptions<PartnerProfitSharesDto, ApiError, PartnerProfitSharesDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<PartnerProfitSharesDto, ApiError, PartnerProfitSharesDto, QueryKey>({
    queryKey: PARTNER_PROFIT_SHARES_QUERY_KEY,
    queryFn: () => apiGet<PartnerProfitSharesDto>("/Partners/profit-shares"),
    ...options?.query,
  });
}

/**
 * Cria um sócio — nasce ativo, com percentual 0 (ajuste na distribuição de lucros).
 *
 * @returns O ID criado (do header Location) ou null se o header não vier.
 */
export async function createPartner(data: CreatePartnerPayload): Promise<number | null> {
  const response = await apiPost<PartnerDto>("/Partners", data);
  return extractCreatedId(response.response);
}

/** Atualiza um sócio. Desativar zera o percentual — rebalanceie antes do próximo fechamento. */
export async function updatePartner(
  id: number,
  data: UpdatePartnerPayload,
): Promise<PartnerDto | null> {
  const response = await apiPut<PartnerDto>(`/Partners/${id}`, data);
  return response.data;
}

/**
 * Exclui um sócio.
 *
 * @throws {ApiError} Quando o sócio aparece no rateio de algum fechamento —
 * nesse caso o caminho certo é desativá-lo.
 */
export async function deletePartner(id: number): Promise<void> {
  await apiDelete<null>(`/Partners/${id}`);
}

/**
 * Grava os novos percentuais da distribuição de lucros.
 * Deve conter EXATAMENTE todos os sócios ativos e somar 100,00.
 *
 * Fechamentos existentes não mudam: o rateio deles foi congelado na confirmação.
 */
export async function updatePartnerProfitShares(
  data: UpdatePartnerProfitSharesPayload,
): Promise<PartnerProfitSharesDto | null> {
  const response = await apiPut<PartnerProfitSharesDto>("/Partners/profit-shares", data);
  return response.data;
}

/** Chave de cache do relatório financeiro do período. */
export function getFinancialReportSummaryQueryKey(params?: {
  startDate?: string;
  endDate?: string;
}) {
  return ["financial-report-summary", params] as const;
}

/**
 * Relatório financeiro do período — prévia calculada ao vivo, nada é persistido.
 *
 * @param params Datas opcionais (o backend assume os últimos 30 dias).
 */
export function useGetFinancialReportSummary(
  params?: { startDate?: string; endDate?: string },
  options?: {
    query?: Omit<
      UseQueryOptions<FinancialReportSummaryDto, ApiError, FinancialReportSummaryDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<FinancialReportSummaryDto, ApiError, FinancialReportSummaryDto, QueryKey>({
    queryKey: getFinancialReportSummaryQueryKey(params),
    queryFn: () =>
      apiGet<FinancialReportSummaryDto>("/FinancialReports/summary", {
        startDate: params?.startDate,
        endDate: params?.endDate,
      }),
    ...options?.query,
  });
}

/** Chave de cache da listagem de fechamentos financeiros. */
export function getGetFinancialClosingsQueryKey(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  return ["FinancialClosings", params] as const;
}

/** Lista os fechamentos (filtro sobre o início do período; mais recentes primeiro). */
export function useGetFinancialClosings(
  params?: { startDate?: string; endDate?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<FinancialClosingDto>, ApiError, UiPagedResult<FinancialClosingDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<FinancialClosingDto>, ApiError, UiPagedResult<FinancialClosingDto>, QueryKey>({
    queryKey: getGetFinancialClosingsQueryKey(params),
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<FinancialClosingDto>>("/FinancialClosings", {
        startDate: params?.startDate,
        endDate: params?.endDate,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Detalha um fechamento com o rateio congelado por sócio.
 *
 * @param id ID do fechamento; a query fica desabilitada enquanto for indefinido.
 */
export function useGetFinancialClosingById(
  id?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<FinancialClosingDto, ApiError, FinancialClosingDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<FinancialClosingDto, ApiError, FinancialClosingDto, QueryKey>({
    queryKey: ["financial-closing-details", id ?? 0],
    enabled: !!id,
    queryFn: async () => apiGet<FinancialClosingDto>(`/FinancialClosings/${id}`),
    ...options?.query,
  });
}

/**
 * Calcula a prévia de um fechamento SEM persistir nada.
 * Soma de percentuais ≠ 100, período parcial de mês e sobreposição com
 * fechamento existente viram warnings.
 */
export async function previewFinancialClosing(
  data: PreviewFinancialClosingPayload,
): Promise<FinancialClosingPreviewDto | null> {
  const response = await apiPost<FinancialClosingPreviewDto>("/FinancialClosings/preview", data);
  return response.data;
}

/**
 * Confirma o fechamento: o servidor RECALCULA tudo e congela números e rateio.
 *
 * @throws {ApiError} Período inválido, sobreposição com fechamento existente ou
 * soma dos percentuais dos sócios ativos ≠ 100.
 * @returns O ID criado (do header Location) ou null se o header não vier.
 */
export async function createFinancialClosing(
  data: CreateFinancialClosingPayload,
): Promise<number | null> {
  const response = await apiPost<FinancialClosingDto>("/FinancialClosings", data);
  return extractCreatedId(response.response);
}

/**
 * Exclui um fechamento para permitir refazê-lo.
 * Ação destrutiva de documento — o backend registra em log quem excluiu.
 */
export async function deleteFinancialClosing(id: number): Promise<void> {
  await apiDelete<null>(`/FinancialClosings/${id}`);
}

// ---------------------------------------------------------------------------
// Etiquetas de gôndola — lotes de impressão em A4 com histórico
//
// Contrato do backend em Uaus.Backend.Api/docs/etiquetas-de-gondola.md.
// ---------------------------------------------------------------------------

/**
 * Tipo visual da etiqueta de gôndola (enum ProductLabelType do backend).
 * Define a cor de fundo na impressão: Normal = branca, Promotion = amarela,
 * Clearance (queima de estoque) = vermelha.
 */
export const PRODUCT_LABEL_TYPE = {
  None: 0,
  Normal: 1,
  Promotion: 2,
  Clearance: 3,
} as const;

/** Um lote de etiquetas do histórico de impressão. */
export interface ProductLabelBatchDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  /** Identificação livre do lote (ex.: "Promoção da semana"). */
  description: string | null;
  userId: number | null;
  /** Nome completo de quem gerou o lote. */
  userName: string | null;
  /** Produtos distintos no lote. */
  totalProducts: number;
  /** Etiquetas que o lote imprime (soma das quantidades). */
  totalLabels: number;
  /** Itens. Preenchidos apenas na consulta por ID e na resposta da geração. */
  items: ProductLabelBatchItemDto[];
}

/**
 * Uma etiqueta do lote. Nome, código de barras e preço são congelados na
 * geração: a reimpressão reproduz o papel original mesmo que o cadastro do
 * produto mude depois.
 */
export interface ProductLabelBatchItemDto {
  id: number;
  productId: number;
  productName: string;
  barcode: string | null;
  /** Preço impresso — na promoção, o valor da oferta. */
  price: number;
  /** Enum ProductLabelType — pode vir como número ou nome; use ``. */
  labelType: EnumValue;
  /** Descrição do tipo em português, pronta para exibição. */
  labelTypeName: string;
  /** Cópias desta etiqueta no lote. */
  quantity: number;
}

/** Item enviado na geração de um lote. */
export interface CreateProductLabelBatchItemPayload {
  productId: number;
  /** Código numérico de PRODUCT_LABEL_TYPE (1, 2 ou 3). */
  labelType: number;
  /** Preço que sai impresso — na promoção, o valor da oferta. */
  price: number;
  /** Cópias da etiqueta (mínimo 1). */
  quantity: number;
}

/** Dados enviados ao gerar um lote de etiquetas. */
export interface CreateProductLabelBatchPayload {
  description?: string | null;
  items: CreateProductLabelBatchItemPayload[];
}

/** Chave de cache da listagem de lotes de etiquetas. */
export function getGetProductLabelBatchesQueryKey(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return ["ProductLabelBatches", params] as const;
}

/**
 * Lista os lotes de etiquetas do histórico, dos mais recentes para os mais
 * antigos.
 *
 * @param params `search` filtra pela identificação do lote.
 */
export function useGetProductLabelBatches(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<
        UiPagedResult<ProductLabelBatchDto>,
        ApiError,
        UiPagedResult<ProductLabelBatchDto>,
        QueryKey
      >,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<
    UiPagedResult<ProductLabelBatchDto>,
    ApiError,
    UiPagedResult<ProductLabelBatchDto>,
    QueryKey
  >({
    queryKey: getGetProductLabelBatchesQueryKey(params),
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<ProductLabelBatchDto>>("/ProductLabelBatches", {
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Detalha um lote com os itens congelados, para exibição e reimpressão. */
export async function getProductLabelBatchById(id: number): Promise<ProductLabelBatchDto> {
  return apiGet<ProductLabelBatchDto>(`/ProductLabelBatches/${id}`);
}

/**
 * Gera um lote de etiquetas. O backend congela nome e código de barras a
 * partir do cadastro; o preço vai no payload porque a oferta pode sair com
 * valor diferente do preço de venda.
 *
 * @returns O lote criado, já com os itens congelados.
 */
export async function createProductLabelBatch(
  data: CreateProductLabelBatchPayload,
): Promise<ProductLabelBatchDto | null> {
  const response = await apiPost<ProductLabelBatchDto>("/ProductLabelBatches", data);
  return response.data;
}

/** Remove um lote do histórico. Não afeta estoque nem produtos. */
export async function deleteProductLabelBatch(id: number): Promise<void> {
  await apiDelete<null>(`/ProductLabelBatches/${id}`);
}





