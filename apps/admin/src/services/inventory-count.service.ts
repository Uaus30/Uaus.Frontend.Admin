import {
  applyInventoryCount,
  downloadInventoryCountSheet,
  previewInventoryCount,
  type InventoryCountResultDto,
} from "@workspace/api-client-react";

/**
 * Contagem de estoque por planilha — camada de dados.
 *
 * As regras de negócio moram no backend (`docs/contagem-de-estoque.md`). O que
 * fica aqui é o que só o navegador sabe fazer: disparar o download do arquivo e
 * decidir se um arquivo escolhido tem cara de planilha antes de subir.
 */

/** Extensões que o backend consegue ler. */
const ACCEPTED_EXTENSIONS = [".xlsx"];

/**
 * O arquivo escolhido pode ser enviado.
 *
 * A conferência é pela extensão, e não pelo MIME type: o Windows reporta o tipo
 * de .xlsx de formas diferentes dependendo de haver Excel instalado, e recusar
 * por MIME barraria arquivos válidos.
 *
 * @returns Mensagem do problema, ou `null` quando o arquivo serve.
 */
export function validateInventoryFile(file: File | null): string | null {
  if (!file) return "Escolha a planilha de contagem preenchida.";

  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "Envie o arquivo .xlsx exportado pelo sistema.";
  }

  if (file.size === 0) return "O arquivo está vazio.";

  return null;
}

/**
 * Baixa a planilha de contagem e dispara o download no navegador.
 *
 * @returns O nome do arquivo salvo.
 */
export async function exportInventorySheet(): Promise<string> {
  const { blob, fileName } = await downloadInventoryCountSheet();

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    // Sem revogar, o blob fica preso na memória da aba até o recarregamento.
    URL.revokeObjectURL(url);
  }

  return fileName;
}

/** Lê a planilha e devolve o impacto, sem gravar nada. */
export function previewInventorySheet(file: File): Promise<InventoryCountResultDto | null> {
  return previewInventoryCount(file);
}

/**
 * Aplica a contagem.
 *
 * @throws {import("@workspace/api-client-react").ApiError}
 * Quando a planilha já foi aplicada, tem produto duplicado ou não aponta nenhuma
 * diferença.
 */
export function applyInventorySheet(file: File): Promise<InventoryCountResultDto | null> {
  return applyInventoryCount(file);
}

/**
 * A contagem tem algo a aplicar.
 *
 * Separado do `hasNoChanges` do backend porque a tela também precisa considerar
 * o bloqueio: uma planilha com produto duplicado pode ter diferenças e ainda
 * assim não poder ser aplicada.
 */
export function canApplyInventoryCount(result: InventoryCountResultDto | null): boolean {
  if (!result) return false;
  return !result.isBlocked && !result.hasNoChanges;
}
