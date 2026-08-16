/**
 * Baixas de estoque e configurações da empresa.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, EnumValue, QueryKey, UiPagedResult } from "../models";

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
  /** Enum StockWriteOffReason — pode vir como número ou nome; normalize com `enumCode()`. */
  reason: EnumValue;
  /** Enum StockWriteOffStatus — pode vir como número ou nome; normalize com `enumCode()`. */
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
      const result = await apiGetOrThrow<BackendPagedResult<StockWriteOffDto>>("/StockWriteOffs", {
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
  return apiGetOrThrow<StockWriteOffDto>(`/StockWriteOffs/${id}`);
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
  return apiGetOrThrow<StockWriteOffSessionSummaryDto>(
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
  /**
   * Cidade e UF impressas na linha abaixo do endereço (ex.: "TAPIRA-PR").
   *
   * Sai impresso como foi digitado — o cupom não monta separador nenhum, pela
   * mesma razão do telefone e do documento. Vazio não imprime linha, e este é o
   * único campo de identidade **sem** fallback embutido: ele nunca existiu
   * hardcoded no `store-info.ts`, então não há valor anterior a preservar.
   */
  cityState?: string;
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
    queryFn: () => apiGetOrThrow<CompanySettingsDto>("/CompanySettings"),
    ...options?.query,
  });
}

/** Grava as configurações da empresa. */
export async function updateCompanySettings(data: CompanySettingsDto) {
  const response = await apiPut<CompanySettingsDto>("/CompanySettings", data);
  return response.data;
}
