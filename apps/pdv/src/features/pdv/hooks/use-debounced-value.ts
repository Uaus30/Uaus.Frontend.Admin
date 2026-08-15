import { useDebounce } from "@workspace/ui";

/**
 * Parâmetros de toda busca digitada do PDV, num lugar só.
 *
 * Antes eram três debounces copiados com números diferentes: o balcão e a baixa
 * de estoque esperavam 600ms e exigiam 3 caracteres, a busca de consumidor
 * esperava 400ms e exigia 2. O operador é o mesmo, o teclado é o mesmo e a
 * expectativa dele também — a divergência só produzia telas que "respondem
 * diferente" sem motivo que alguém consiga explicar no balcão.
 *
 * O par escolhido foi o mais responsivo dos dois tempos com o piso de caracteres
 * mais alto:
 *
 * - **400ms**: 600ms depois da última tecla é meio segundo de tela parada com o
 *   cliente esperando. 400ms ainda absorve com folga a rajada de um leitor de
 *   código de barras (que emite o código inteiro em menos de 100ms), então o
 *   leitor continua disparando uma única busca, e não uma por dígito.
 * - **3 caracteres**: com 2 a busca dispara no meio de qualquer palavra e volta
 *   com o teto de 20 resultados que quase nunca contém o que o operador quer —
 *   gasta requisição e ainda empurra o item certo para fora da tela.
 */
export const SEARCH_DEBOUNCE_MS = 400;

/** Caracteres mínimos antes de disparar uma busca. Ver {@link SEARCH_DEBOUNCE_MS}. */
export const MIN_SEARCH_LENGTH = 3;

/**
 * Devolve o valor só depois que ele parou de mudar por `delayMs`.
 *
 * A implementação é a do `@workspace/ui` — uma só no repositório. O que este
 * arquivo acrescenta são os PARÂMETROS do PDV, documentados acima: o balcão tem
 * um leitor de código de barras e um cliente esperando, e essa combinação não é
 * a mesma de uma tela de cadastro do admin.
 *
 * @param value Valor que muda a cada tecla.
 * @param delayMs Espera em milissegundos; o padrão é o do PDV inteiro.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  return useDebounce(value, delayMs);
}
