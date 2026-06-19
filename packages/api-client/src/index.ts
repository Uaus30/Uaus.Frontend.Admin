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
  status: number;
  canDelete: boolean;
}

export interface TagDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  name: string;
  color: string;
  isPublic: boolean;
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
  total: number;
  discount: number;
  paymentMethod: number;
  paymentStatus: number;
  notes: string | null;
}

export interface SaleItemDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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

  if (options?.body != null && !headers.has("Content-Type")) {
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
  params?: { page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>({
    queryKey: [...getGetSalesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<SaleDto>>("/Sales", {
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

