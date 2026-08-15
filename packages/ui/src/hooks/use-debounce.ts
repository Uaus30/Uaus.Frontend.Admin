import { useEffect, useState } from "react";

/** Atraso padrão de busca no repositório. Use-o em vez de escolher um número novo. */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Atrasa a propagação de um valor até ele parar de mudar.
 *
 * Usado nas buscas que batem na API: sem isso, cada tecla dispara uma
 * requisição, e a resposta da penúltima pode chegar depois da última e
 * sobrescrever o resultado certo.
 *
 * Mora no kit compartilhado porque os dois apps precisam do mesmo
 * comportamento. Antes, o admin tinha este hook a 300ms e o PDV usava
 * `setTimeout` inline com valores diferentes em cada tela.
 *
 * @param value Valor que muda a cada tecla.
 * @param delay Quanto esperar, em ms. O padrão é `DEFAULT_DEBOUNCE_MS`.
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
