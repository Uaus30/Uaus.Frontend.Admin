import { PURCHASE_STATUS, type SavePurchasePayload, type SupplierDto } from "@workspace/api-client-react";
import { toDateKey } from "@workspace/core";
import type { PurchaseForm } from "../types";

/** Tamanho máximo do nº da nota — o mesmo da coluna da entrada de estoque. */
export const PURCHASE_INVOICE_NUMBER_MAX_LENGTH = 80;

/**
 * O que a próxima compra herda da última registrada (24/09/2026).
 *
 * Pedido do dono: quem lança várias compras seguidas — a nota de um fornecedor
 * com dez itens são dez compras — digitava fornecedor, data, nota e situação dez
 * vezes. Agora a compra NOVA nasce com os da última registrada, e tudo continua
 * editável.
 */
export type PurchaseDefaults = {
  supplierId: string;
  /** `yyyy-MM-dd`. */
  purchaseDate: string;
  /** Código de PurchaseStatus como string: "1" Pendente, "2" A caminho. */
  status: string;
  /** Nº da nota. Vazio é "sem nota" — e também é lembrado. */
  invoiceNumber: string;
};

const STORAGE_PREFIX = "uaus-admin:compras:ultimo-preenchimento";

/**
 * A chave é por USUÁRIO: o computador do balcão é compartilhado, e a compra que
 * um funcionário acabou de lançar não deve escolher o fornecedor da próxima de
 * outro. Sem sessão (não acontece atrás do login) cai numa chave comum.
 */
function storageKey(userId: number | null | undefined): string {
  return userId == null ? STORAGE_PREFIX : `${STORAGE_PREFIX}:${userId}`;
}

/**
 * A memória gravada, já conferida — ou `null` quando não há nenhuma.
 *
 * Mora no `localStorage`, e não no servidor, de propósito: é preferência de
 * digitação deste navegador, não dado da loja. Limpar os dados do navegador
 * devolve o formulário ao padrão (fornecedor em branco, hoje, sem nota,
 * Pendente), que é o comportamento que o dono descreveu.
 *
 * Tudo que vem de lá é conferido campo a campo: o texto pode ter sido gravado por
 * uma versão anterior da tela, ou editado à mão. Valor que não serve volta ao
 * padrão daquele campo, em vez de derrubar a modal.
 */
export function readPurchaseDefaults(userId: number | null | undefined): PurchaseDefaults | null {
  let gravado: unknown;
  try {
    const texto = window.localStorage.getItem(storageKey(userId));
    if (!texto) return null;
    gravado = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof gravado !== "object" || gravado === null) return null;

  const valores = gravado as Record<string, unknown>;
  const hoje = toDateKey(new Date());
  const { supplierId, purchaseDate, status, invoiceNumber } = valores;

  return {
    supplierId: typeof supplierId === "string" && /^\d+$/.test(supplierId) ? supplierId : "",
    // Data no futuro só aparece se o relógio da máquina mudou; a compra nunca é
    // adiantada, então vale hoje.
    purchaseDate:
      typeof purchaseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) && purchaseDate <= hoje
        ? purchaseDate
        : hoje,
    // "Lançado" nunca é escolhido à mão: só Pendente e A caminho servem.
    status: status === String(PURCHASE_STATUS.InTransit) ? status : String(PURCHASE_STATUS.Pending),
    invoiceNumber:
      typeof invoiceNumber === "string" ? invoiceNumber.slice(0, PURCHASE_INVOICE_NUMBER_MAX_LENGTH) : "",
  };
}

/**
 * Guarda o que a compra recém-registrada usou.
 *
 * Gravar é conveniência: navegador sem espaço ou com o armazenamento bloqueado
 * não pode transformar o "Compra registrada" num erro.
 */
export function rememberPurchaseDefaults(
  userId: number | null | undefined,
  defaults: PurchaseDefaults,
): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(defaults));
  } catch {
    // Sem memória, a próxima compra nasce com o padrão. Nada se perde.
  }
}

/**
 * O que lembrar a partir do corpo que acabou de ser gravado.
 *
 * Sai do PAYLOAD, e não do formulário, porque é ele que o servidor aceitou: o
 * formulário pode ter mudado entre o clique e a resposta.
 */
export function purchaseDefaultsFromPayload(payload: SavePurchasePayload): PurchaseDefaults {
  return {
    supplierId: String(payload.supplierId),
    purchaseDate: payload.purchaseDate ? payload.purchaseDate.slice(0, 10) : toDateKey(new Date()),
    status: String(payload.status),
    invoiceNumber: payload.invoiceNumber ?? "",
  };
}

/**
 * O formulário em branco com a memória aplicada.
 *
 * O fornecedor só entra se ainda existir no catálogo carregado: o lembrado pode
 * ter sido excluído, e um id que o select não conhece apareceria em branco na
 * tela e só seria recusado pelo servidor, no salvar. Com o catálogo ainda
 * vazio (carregando), ele entra e o nome aparece quando a lista chegar.
 */
export function applyPurchaseDefaults(
  form: PurchaseForm,
  defaults: PurchaseDefaults,
  suppliers: SupplierDto[],
): PurchaseForm {
  const fornecedorExiste =
    suppliers.length === 0 || suppliers.some((supplier) => String(supplier.id) === defaults.supplierId);

  return {
    ...form,
    supplierId: fornecedorExiste ? defaults.supplierId : form.supplierId,
    purchaseDate: defaults.purchaseDate,
    status: defaults.status,
    invoiceNumber: defaults.invoiceNumber,
  };
}
