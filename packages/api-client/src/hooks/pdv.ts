/**
 * PDV — busca de balcão, histórico do turno e venda completa.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { ApiError, apiGet, apiGetOrThrow, apiPost, apiPut, extractCreatedId } from "../client";
import type {
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
// Desempenho da loja — a espiada rápida pelo balcão
// ---------------------------------------------------------------------------

/** Chave de cache do resumo de desempenho. */
export const getGetStorePerformanceQueryKey = (): QueryKey => ["PdvPerformance"];

/**
 * Resumo de desempenho da loja para a modal do PDV.
 *
 * Vive sob `/Pdv` e não sob `/Dashboard` por causa da autorização: o painel
 * inteiro é restrito a Admin, e o operador de caixa é Seller — ele tomaria 403
 * em qualquer endpoint de lá. Este é liberado para os dois papéis e não devolve
 * custo, lucro nem margem.
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
