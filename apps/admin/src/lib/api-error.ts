/**
 * Extrai do erro de requisição a frase que vai para o toast.
 *
 * `ApiError.message` já traz o texto do backend quando ele responde
 * `{ message }`, `{ detail }` ou `{ title }` — é o caso de "Estoque insuficiente
 * para baixa do produto #5". O que sobra para cá é o `ValidationProblemDetails`
 * do ASP.NET, que guarda as frases dentro de `errors` e deixaria o usuário só
 * com o genérico "One or more validation errors occurred".
 *
 * @param error Erro capturado (`ApiError`, `Error` ou qualquer coisa).
 * @param fallback Texto usado quando não há nada legível no erro.
 * @returns Mensagem pronta para exibição.
 */
export function describeApiError(error: unknown, fallback = "Tente novamente."): string {
  const validationMessages = extractValidationMessages(error);
  if (validationMessages.length > 0) return validationMessages.join(" ");

  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;

  return fallback;
}

/**
 * Achata o dicionário `errors` de um `ValidationProblemDetails`.
 *
 * A leitura é por duck typing em vez de `instanceof ApiError` para o helper não
 * depender do cliente HTTP — o que também o mantém testável sem mock de rede.
 */
function extractValidationMessages(error: unknown): string[] {
  if (!error || typeof error !== "object" || !("payload" in error)) return [];

  const payload = (error as { payload: unknown }).payload;
  if (!payload || typeof payload !== "object") return [];

  const errors = (payload as { errors?: unknown }).errors;
  if (!errors || typeof errors !== "object") return [];

  return Object.values(errors as Record<string, unknown>)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}
