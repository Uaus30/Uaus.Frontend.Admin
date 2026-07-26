import type { ReceiptStore } from "./types";

/**
 * Identificação da loja no cabeçalho do cupom.
 *
 * Ainda não existe cadastro de empresa no backend, então os dados vivem aqui.
 * Quando o cadastro existir, basta alimentar `ReceiptData.store` com o que vier
 * da API — o cupom já dá preferência a esses valores.
 */
export const STORE_INFO: ReceiptStore = {
  name: "MÁXIMO 30",
  addressLines: ["RUA PARANAGUÁ, 663"],
  phone: "Cel: (44) 99137-2305",
  document: "CNPJ: 64.958.682/0001-22",
};

/** Mensagem de rodapé impressa no fim de todo cupom. */
export const RECEIPT_FOOTER_MESSAGE = "Obrigado pela preferência!";
