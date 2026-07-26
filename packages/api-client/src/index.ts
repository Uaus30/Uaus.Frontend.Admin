import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

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
  subtotal: number;
  /** Custo unitário praticado no momento da venda. */
  unitCost: number;
  totalCost: number;
  profit: number;
}

export interface AuthSession {
  user: UserDto;
  token: TokenDto;
}

export interface ApiResponse<T> {
  data: T | null;
  response: Response;
}

const AUTH_STORAGE_KEY = "uaus-office-auth";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" ? "/api" : "https://api.uaus.com.br");

export class ApiError extends Error {
  status: number;
  payload: unknown;
  method?: string;
  url?: string;

  constructor(message: string, status: number, payload: unknown, method?: string, url?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.method = method;
    this.url = url;
  }
}

function buildUrl(path: string, params?: Record<string, unknown>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : typeof window !== "undefined"
      ? new URL(API_BASE_URL, window.location.origin).toString()
      : API_BASE_URL;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function readResponseBody(response: Response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload;

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidateKeys = [
      "message", "Message",
      "detail", "Detail",
      "title", "Title",
      "error", "Error"
    ];
    for (const key of candidateKeys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return fallback;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  setAuthSession(null);
}

export function isTokenExpired(session: AuthSession | null) {
  if (!session?.token.expiration) return true;
  return new Date(session.token.expiration).getTime() <= Date.now();
}

export async function apiRequest<T>(
  method: string,
  path: string,
  options?: {
    params?: Record<string, unknown>;
    body?: unknown;
    headers?: HeadersInit;
    auth?: boolean;
  },
): Promise<ApiResponse<T>> {
  const session = getAuthSession();
  const headers = new Headers(options?.headers);

  if (options?.body != null && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options?.auth !== false && session?.token.value) {
    headers.set("Authorization", `Bearer ${session.token.value}`);
  }

  const response = await fetch(buildUrl(path, options?.params), {
    method,
    headers,
    body:
      options?.body == null
        ? undefined
        : headers.get("Content-Type") === "application/json"
          ? JSON.stringify(options.body)
          : (options.body as BodyInit),
  });

  const payload = await readResponseBody(response);

  if (!response.ok) {
    const fallback = `Erro ${response.status} ao acessar ${path}`;
    throw new ApiError(extractErrorMessage(payload, fallback), response.status, payload, method, path);
  }

  return {
    data: payload as T | null,
    response,
  };
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("GET", path, {
    params,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result.data as T;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("POST", path, {
    body,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result;
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("PUT", path, {
    body,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result;
}

export async function apiDelete<T>(
  path: string,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("DELETE", path, {
    auth: options?.auth,
    headers: options?.headers,
  });
  return result;
}

export function extractCreatedId(response: Response) {
  const location = response.headers.get("Location");
  if (!location) return null;

  const match = location.match(/\/(\d+)(?:\?.*)?$/);
  return match ? Number(match[1]) : null;
}

export function mapPagedResult<T>(result: BackendPagedResult<T>): UiPagedResult<T> {
  const page = result.pagination.page ?? 1;
  const limit = result.pagination.size ?? result.items.length;
  const total = result.pagination.filteredItems ?? result.items.length;

  return {
    data: result.items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
}

export async function fetchAllPages<T>(
  path: string,
  params?: Record<string, unknown>,
  size = 200,
) {
  const allItems: T[] = [];
  let page = 1;

  while (true) {
    const paged = await apiGet<BackendPagedResult<T>>(path, {
      ...params,
      page,
      size,
    });

    allItems.push(...paged.items);

    const total = paged.pagination.filteredItems ?? allItems.length;
    if (allItems.length >= total || paged.items.length === 0) break;
    page += 1;
  }

  return allItems;
}

function useCrudMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    mutation?: UseMutationOptions<TData, ApiError, TVariables>;
  },
) {
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    ...options?.mutation,
  });
}

export const getGetMeQueryKey = (): QueryKey => ["auth", "me"];
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
    const authResponse = await apiRequest<AuthenticatedUserDto>("POST", "/Users/authenticate", {
      params: {
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
