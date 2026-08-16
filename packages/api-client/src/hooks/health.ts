/**
 * Sonda de disponibilidade da API.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { buildUrl } from "../client";

export async function checkHealth(): Promise<boolean> {
  try {
    const url = buildUrl("/health");
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    if (response.ok) {
      const text = await response.text();
      return text.trim() === "Ok";
    }
    return false;
  } catch {
    return false;
  }
}
