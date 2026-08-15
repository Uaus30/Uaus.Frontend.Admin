/**
 * Contagem de estoque por planilha.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { apiGetBlob, apiPost, type ApiBlob } from "../client";

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
 * Não usa `apiGetOrThrow`: aquele caminho lê a resposta como texto e corromperia o
 * .xlsx, que é binário.
 *
 * @returns O arquivo e o nome sugerido pelo servidor.
 */
export async function downloadInventoryCountSheet(): Promise<ApiBlob> {
  // Passa pelo apiGetBlob para o 401 ser tratado no mesmo lugar que o resto do
  // app: montando o header aqui, um token vencido produzia um erro genérico e
  // deixava o usuário numa tela morta em vez de levá-lo ao login.
  return apiGetBlob("/InventoryCounts/export", "contagem-de-estoque.xlsx");
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
