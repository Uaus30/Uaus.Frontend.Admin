import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import type { ScanFeedback } from "@/components/barcode-scanner-dialog";

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
 * O aviso embaixo do vídeo. Diz o NOME do produto que entrou — é a conferência
 * de que a câmera leu a etiqueta certa da prateleira — e as cópias, porque ler
 * de novo o mesmo produto soma uma etiqueta.
 */
export function scanFeedbackOf(outcome: BarcodeScanOutcome): ScanFeedback {
  switch (outcome.kind) {
    case "added":
      return {
        tone: "success",
        message:
          outcome.copies > 1
            ? `${outcome.name} — agora com ${outcome.copies} cópias na lista.`
            : `${outcome.name} adicionado à lista.`,
      };
    case "not-found":
      return {
        tone: "warning",
        message: `Nenhum produto com o código ${outcome.code}. Busque pelo nome.`,
      };
    case "ambiguous":
      return {
        tone: "warning",
        message: `Mais de um produto com o código ${outcome.code}. Feche a câmera e escolha na busca.`,
      };
    case "error":
      return { tone: "error", message: `Não foi possível buscar o código ${outcome.code}. Tente de novo.` };
  }
}
