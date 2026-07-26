import {
  getStockWriteOff,
  registerStockWriteOff,
  reverseStockWriteOff,
  SELECTABLE_STOCK_WRITE_OFF_REASONS,
  STOCK_WRITE_OFF_REASON_LABEL,
  STOCK_WRITE_OFF_STATUS,
  type RegisterStockWriteOffInput,
  type StockWriteOffDto,
  type StockWriteOffFilters,
} from "@workspace/api-client-react";
import type {
  StockWriteOffDraftItem,
  StockWriteOffFilterState,
  StockWriteOffSelectOption,
} from "@/features/stock-write-offs/types";

/**
 * Baixa de estoque: saída de mercadoria sem venda (consumo, perda, doação e a
 * falta apurada na contagem). Contrato do backend em
 * `Uaus.Backend.Api/docs/baixas-de-estoque.md`.
 */

/** Valor dos selects de filtro que significa "não filtrar por este campo". */
export const ALL_FILTER_VALUE = "all";

/** Filtros zerados: estado inicial da tela e alvo do botão de limpar. */
export const EMPTY_STOCK_WRITE_OFF_FILTERS: StockWriteOffFilterState = {
  reason: ALL_FILTER_VALUE,
  status: ALL_FILTER_VALUE,
  startDate: "",
  endDate: "",
  userId: ALL_FILTER_VALUE,
};

/** Rótulos das situações, para badges e filtros. */
export const STOCK_WRITE_OFF_STATUS_LABEL: Record<number, string> = {
  [STOCK_WRITE_OFF_STATUS.Confirmed]: "Efetivada",
  [STOCK_WRITE_OFF_STATUS.Reversed]: "Estornada",
};

/**
 * Motivos oferecidos no filtro da listagem.
 *
 * Inventário entra aqui — ele não é escolhível ao registrar, mas existe no
 * histórico (a importação da contagem o gera) e precisa ser filtrável.
 */
export const STOCK_WRITE_OFF_REASON_FILTER_OPTIONS: StockWriteOffSelectOption[] = Object.entries(
  STOCK_WRITE_OFF_REASON_LABEL,
).map(([code, label]) => ({ value: code, label }));

/**
 * Motivos oferecidos ao registrar uma baixa.
 *
 * Inventário fica de fora: ele é gerado pela importação da contagem, o único
 * caminho autorizado a baixar acima do saldo em lote.
 */
export const SELECTABLE_STOCK_WRITE_OFF_REASON_OPTIONS: StockWriteOffSelectOption[] =
  SELECTABLE_STOCK_WRITE_OFF_REASONS.map((code) => ({
    value: String(code),
    label: STOCK_WRITE_OFF_REASON_LABEL[code] ?? String(code),
  }));

/** Situações oferecidas no filtro da listagem. */
export const STOCK_WRITE_OFF_STATUS_OPTIONS: StockWriteOffSelectOption[] = [
  { value: String(STOCK_WRITE_OFF_STATUS.Confirmed), label: STOCK_WRITE_OFF_STATUS_LABEL[STOCK_WRITE_OFF_STATUS.Confirmed] },
  { value: String(STOCK_WRITE_OFF_STATUS.Reversed), label: STOCK_WRITE_OFF_STATUS_LABEL[STOCK_WRITE_OFF_STATUS.Reversed] },
];

/**
 * Traduz os filtros da tela para os parâmetros da API.
 *
 * `"all"` e datas em branco viram `undefined` para não irem na query string —
 * mandar `reason=all` faria o backend receber um enum inválido.
 *
 * @param filters Estado dos controles de filtro.
 * @param pagination Página corrente e tamanho de página.
 * @returns Parâmetros aceitos por `useGetStockWriteOffs`.
 */
export function buildStockWriteOffQuery(
  filters: StockWriteOffFilterState,
  pagination: { page: number; limit: number },
): StockWriteOffFilters {
  return {
    reason: parseFilterId(filters.reason),
    status: parseFilterId(filters.status),
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    userId: parseFilterId(filters.userId),
    page: pagination.page,
    limit: pagination.limit,
  };
}

/** Converte o valor de um select de filtro em ID numérico, ou `undefined`. */
function parseFilterId(value: string): number | undefined {
  if (!value || value === ALL_FILTER_VALUE) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Verdadeiro para os motivos que o operador pode escolher ao registrar. */
export function isSelectableWriteOffReason(reason: number): boolean {
  return (SELECTABLE_STOCK_WRITE_OFF_REASONS as readonly number[]).includes(reason);
}

/**
 * Monta o corpo do POST a partir do rascunho da tela.
 *
 * Linhas repetidas do mesmo produto são somadas numa só. A tela já soma ao
 * adicionar; aqui é a garantia de que o POST nunca leva o mesmo produto duas
 * vezes, porque cada item vira um plano FIFO independente sobre o mesmo saldo.
 * Linhas com quantidade não positiva são descartadas em vez de irem ao backend.
 *
 * @param draft Motivo, itens e observação do rascunho.
 * @returns Corpo pronto para `registerStockWriteOff`.
 */
export function buildRegisterStockWriteOffPayload(draft: {
  reason: number;
  items: StockWriteOffDraftItem[];
  notes?: string | null;
}): RegisterStockWriteOffInput {
  const quantityByProduct = new Map<number, number>();

  for (const item of draft.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  return {
    reason: draft.reason,
    items: [...quantityByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity })),
    notes: draft.notes?.trim() || null,
  };
}

/**
 * Registra a baixa: consome lote por FIFO e reduz o saldo dos produtos.
 *
 * A recusa do motivo Inventário mora aqui, e não só no select. O backend também
 * recusa — a guarda local evita a viagem e devolve uma frase que faz sentido
 * para quem está na tela.
 *
 * @returns A baixa gravada — `null` nas raras respostas sem corpo.
 * @throws {Error} Rascunho sem item válido ou com motivo não escolhível.
 * @throws {ApiError} Estoque insuficiente para algum item.
 */
export async function submitStockWriteOff(draft: {
  reason: number;
  items: StockWriteOffDraftItem[];
  notes?: string | null;
}): Promise<StockWriteOffDto | null> {
  const payload = buildRegisterStockWriteOffPayload(draft);

  if (!isSelectableWriteOffReason(payload.reason)) {
    throw new Error("Selecione o motivo da baixa.");
  }

  if (payload.items.length === 0) {
    throw new Error("Adicione ao menos um produto com quantidade maior que zero.");
  }

  return registerStockWriteOff(payload);
}

/**
 * Estorna a baixa: devolve aos lotes o que cada um cedeu e mantém o registro,
 * agora marcado como estornado.
 *
 * Não existe exclusão de baixa. Apagar deixaria o estoque reduzido sem
 * contrapartida, então o motivo é obrigatório: é o que explica o estorno no
 * histórico.
 *
 * @returns A baixa já estornada — `null` nas raras respostas sem corpo.
 * @throws {Error} Motivo em branco.
 */
export async function submitStockWriteOffReversal(
  id: number,
  reason: string,
): Promise<StockWriteOffDto | null> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("Informe o motivo do estorno.");
  }

  return reverseStockWriteOff(id, trimmed);
}

/** Carrega uma baixa com os itens (a listagem vem sem eles). */
export async function fetchStockWriteOffDetails(id: number): Promise<StockWriteOffDto> {
  return getStockWriteOff(id);
}
