import type { ReceiptStore, StoreInfo } from "./types";

/**
 * Identidade padrão da loja — o FALLBACK dos cupons.
 *
 * A identidade oficial vem do cadastro da empresa (`GET /CompanySettings`) e
 * chega ao cupom via `resolveStoreInfo`. Estes valores só entram em cena quando
 * o cadastro não respondeu (PDV recém-instalado sem internet, backend anterior
 * aos campos) ou quando um campo foi deixado em branco — são os mesmos valores
 * que eram impressos quando a identidade vivia hardcoded aqui.
 */
const FALLBACK_STORE_INFO: StoreInfo = {
  storeName: "MÁXIMO 30",
  addressLine: "RUA PARANAGUÁ, 663",
  phone: "Cel: (44) 99137-2305",
  // Cru, sem rótulo, como no cadastro: o "CNPJ: " é impresso por `toReceiptStore`.
  document: "64.958.682/0001-22",
  receiptFooterMessage: "Obrigado pela preferência!",
};

/** Usa o valor informado, ou o padrão quando ele veio vazio (ou só espaços). */
function orFallback(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Resolve a identidade da loja campo a campo, caindo no padrão embutido.
 *
 * Campo ausente, vazio ou só com espaços usa o fallback — assim um cadastro
 * preenchido pela metade não imprime cupom com buraco no cabeçalho. Aceita o
 * próprio `CompanySettingsDto` da API, cujos nomes de campos são os mesmos.
 *
 * @param overrides Identidade vinda do cadastro da empresa, parcial ou não.
 * @returns Identidade completa, pronta para `ReceiptData.store`.
 */
export function resolveStoreInfo(overrides?: Partial<StoreInfo>): StoreInfo {
  return {
    storeName: orFallback(overrides?.storeName, FALLBACK_STORE_INFO.storeName),
    addressLine: orFallback(overrides?.addressLine, FALLBACK_STORE_INFO.addressLine),
    phone: orFallback(overrides?.phone, FALLBACK_STORE_INFO.phone),
    document: orFallback(overrides?.document, FALLBACK_STORE_INFO.document),
    receiptFooterMessage: orFallback(
      overrides?.receiptFooterMessage,
      FALLBACK_STORE_INFO.receiptFooterMessage,
    ),
  };
}

/**
 * Distingue a identidade do cadastro (`StoreInfo`) da sobrescrita avulsa por
 * campo (`Partial<ReceiptStore>`) em `ReceiptData.store`.
 *
 * Basta olhar `storeName`: o `StoreInfo` sempre o tem — o tipo não é parcial,
 * então quem monta um chegou por `resolveStoreInfo` — e o `ReceiptStore` nunca.
 */
export function isStoreInfo(value: Partial<ReceiptStore> | StoreInfo): value is StoreInfo {
  return "storeName" in value;
}

/**
 * Converte a identidade do cadastro no formato de impressão do cabeçalho.
 *
 * É aqui que o documento cru ganha o rótulo "CNPJ: " — a menos que o cadastro
 * já traga um rótulo próprio (alguém que digitou "CNPJ:" ou "CPF:" junto), para
 * o cupom não sair com rótulo dobrado.
 */
export function toReceiptStore(info: StoreInfo): ReceiptStore {
  return {
    name: info.storeName,
    addressLines: [info.addressLine],
    phone: info.phone || undefined,
    document: info.document
      ? /\b(CNPJ|CPF)\b/i.test(info.document)
        ? info.document
        : `CNPJ: ${info.document}`
      : undefined,
  };
}

/**
 * Identidade padrão no formato de impressão do cabeçalho.
 *
 * Mantida como constante porque os testes e quem consome o pacote a usam como
 * referência do que sai impresso quando nada foi sobrescrito.
 */
export const STORE_INFO: ReceiptStore = toReceiptStore(resolveStoreInfo());

/** Mensagem de rodapé padrão, impressa quando o cadastro não define outra. */
export const RECEIPT_FOOTER_MESSAGE = FALLBACK_STORE_INFO.receiptFooterMessage;
