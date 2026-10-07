import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import type { ScanFeedback } from "@workspace/ui";

/** O que a leitura de um código pela câmera deu. */
export type BarcodeScanOutcome =
  | { kind: "added"; name: string; /** Cópias desse produto na lista depois da leitura. */ copies: number }
  | { kind: "not-found"; code: string }
  | { kind: "ambiguous"; code: string }
  | { kind: "error"; code: string };

/**
 * Produtos cujo código de barras é EXATAMENTE o lido.
 *
 * A busca do balcão trata termo só de dígitos como código, mas pode devolver
 * mais do que o código exato. Entrar sozinho na lista só vale para o produto
 * certo: a etiqueta errada só aparece depois de impressa e colada na gôndola.
 */
export function exactBarcodeMatches(results: ProductPdvSearchDto[], code: string): ProductPdvSearchDto[] {
  const wanted = code.trim();
  if (!wanted) return [];
  return results.filter((product) => product.barcode?.trim() === wanted);
}

/**
 * O que a câmera faz com o resultado. Produto encontrado FECHA o diálogo (pedido
 * do dono em 30/09/2026: a cada produto, toca-se no botão de novo) — o nome e as
 * cópias vão para o aviso da tela ({@link scanToastOf}). Código de mais de um
 * produto também fecha: a escolha é na lista da busca, atrás do diálogo. "Não
 * encontrado" e erro deixam a câmera aberta para tentar de novo.
 */
export function scanFeedbackOf(outcome: BarcodeScanOutcome): ScanFeedback {
  switch (outcome.kind) {
    case "added":
      return { tone: "success", message: scanToastOf(outcome), close: true };
    case "not-found":
      return {
        tone: "warning",
        message: `Nenhum produto com o código ${outcome.code}. Busque pelo nome.`,
      };
    case "ambiguous":
      return {
        tone: "warning",
        message: `Mais de um produto com o código ${outcome.code}. Escolha na busca.`,
        close: true,
      };
    case "error":
      return { tone: "error", message: `Não foi possível buscar o código ${outcome.code}. Tente de novo.` };
  }
}

/**
 * O aviso depois que a câmera fecha: o NOME do produto que entrou — a conferência
 * de que a câmera leu a etiqueta certa da prateleira — e as cópias, porque ler de
 * novo o mesmo produto soma uma etiqueta.
 */
export function scanToastOf(outcome: Extract<BarcodeScanOutcome, { kind: "added" }>): string {
  return outcome.copies > 1
    ? `${outcome.name} — agora com ${outcome.copies} cópias na lista.`
    : `${outcome.name} adicionado à lista.`;
}
