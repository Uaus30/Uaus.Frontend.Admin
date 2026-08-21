/** Nomes canônicos do `LogType` para APIs que ainda serializam o enum como número. */
const NUMERIC_LOG_TYPES: Readonly<Record<number, string>> = {
  0: "None",
  1: "Information",
  2: "Alert",
  3: "Error",
  4: "Critical",
};

/**
 * Normaliza o tipo vindo da API sem confiar no DTO em tempo de execução.
 * Respostas antigas usam o número do enum; valores inesperados viram um badge
 * genérico, mas nunca impedem a tela de renderizar.
 */
export function normalizeLogType(type: unknown): string {
  if (typeof type === "string") return type.trim();
  if (typeof type === "number") return NUMERIC_LOG_TYPES[type] ?? "";
  return "";
}

/** Identifica o tipo crítico nos contratos textual e numérico da API. */
export function isCriticalLogType(type: unknown): boolean {
  return normalizeLogType(type).toLowerCase().includes("critical");
}
