import type { PurchasesParams, SupplierDto } from "@workspace/api-client-react";

/** Valor do filtro de fornecedor que não filtra nada. */
export const SUPPLIER_FILTER_ALL = "all";

const STORAGE_PREFIX = "uaus-admin:compras:filtro-fornecedor";

/**
 * Por USUÁRIO, como a memória da última compra (`purchase-memory.ts`): o
 * computador do balcão é compartilhado, e o filtro de quem confere as compras da
 * Shopee não deve esconder as do outro funcionário.
 */
function storageKey(userId: number | null | undefined): string {
  return userId == null ? STORAGE_PREFIX : `${STORAGE_PREFIX}:${userId}`;
}

/**
 * O filtro de fornecedor lembrado (22/10/2026), ou "todos" sem memória.
 *
 * Pedido do dono: aplicado o filtro, ele fica — inclusive depois de registrar uma
 * compra ou lançar um recebimento, que leva para a tela do produto e desmonta
 * esta. Mora no `localStorage` pelo mesmo motivo da memória da última compra: é
 * preferência de quem usa este navegador, não dado da loja. Valor que não é um id
 * (texto editado à mão, versão antiga) volta a "todos" em vez de derrubar a tela.
 */
export function readSupplierFilter(userId: number | null | undefined): string {
  try {
    const gravado = window.localStorage.getItem(storageKey(userId));
    return gravado && /^\d+$/.test(gravado) ? gravado : SUPPLIER_FILTER_ALL;
  } catch {
    return SUPPLIER_FILTER_ALL;
  }
}

/**
 * Guarda o filtro escolhido. "Todos" apaga a memória — é o padrão, e não precisa
 * ser lembrado. Navegador sem armazenamento só perde a conveniência.
 */
export function rememberSupplierFilter(userId: number | null | undefined, value: string): void {
  try {
    if (value === SUPPLIER_FILTER_ALL) window.localStorage.removeItem(storageKey(userId));
    else window.localStorage.setItem(storageKey(userId), value);
  } catch {
    // Sem memória, a tela volta a abrir com todos os fornecedores. Nada se perde.
  }
}

/**
 * O filtro que vale de fato: o lembrado só se o fornecedor ainda existe no
 * catálogo carregado. Excluído, ele filtraria a lista para nada, com um select
 * em branco que não diz por quê. Com o catálogo ainda carregando, vale o
 * lembrado — o nome aparece quando a lista chegar.
 */
export function effectiveSupplierFilter(value: string, suppliers: SupplierDto[]): string {
  if (value === SUPPLIER_FILTER_ALL || suppliers.length === 0) return value;
  return suppliers.some((supplier) => String(supplier.id) === value) ? value : SUPPLIER_FILTER_ALL;
}

/** Traduz o valor do `<Select>` de fornecedor no parâmetro da consulta. */
export function purchasesSupplierParams(filter: string): Pick<PurchasesParams, "supplierId"> {
  return filter === SUPPLIER_FILTER_ALL ? {} : { supplierId: Number(filter) };
}
