import { PRODUCT_LABEL_TYPE, enumCode, type EnumValue } from "@workspace/api-client-react";

/** Código numérico do tipo de etiqueta (enum ProductLabelType do backend). */
export type LabelTypeCode =
  | typeof PRODUCT_LABEL_TYPE.Normal
  | typeof PRODUCT_LABEL_TYPE.Promotion
  | typeof PRODUCT_LABEL_TYPE.Clearance;

/** Aparência e nome de um tipo de etiqueta, compartilhados por preview e impressão. */
export interface LabelTypeInfo {
  code: LabelTypeCode;
  /** Nome exibido nos selects e badges. */
  name: string;
  /** Cor de fundo da etiqueta, no modelo dos cartazes de oferta. */
  background: string;
  /** Cor do texto — preto em todos os tipos, como no modelo de referência. */
  foreground: string;
}

/** Os três tipos imprimíveis, na ordem dos selects. */
export const LABEL_TYPE_INFOS: LabelTypeInfo[] = [
  { code: PRODUCT_LABEL_TYPE.Normal, name: "Normal", background: "#ffffff", foreground: "#000000" },
  { code: PRODUCT_LABEL_TYPE.Promotion, name: "Promoção", background: "#ffe600", foreground: "#000000" },
  {
    code: PRODUCT_LABEL_TYPE.Clearance,
    name: "Queima de Estoque",
    background: "#ee3524",
    foreground: "#000000",
  },
];

/** Metadados do tipo; cai para Normal (branca) quando o código é desconhecido. */
export function getLabelTypeInfo(code: number): LabelTypeInfo {
  return LABEL_TYPE_INFOS.find((info) => info.code === code) ?? LABEL_TYPE_INFOS[0];
}

/**
 * Normaliza o tipo vindo da API (nome "Promotion" ou número) para o código.
 * Valores desconhecidos caem para Normal, que imprime a etiqueta branca.
 */
export function labelTypeFromEnum(value: EnumValue): LabelTypeCode {
  const code = enumCode(value, PRODUCT_LABEL_TYPE);
  return code === PRODUCT_LABEL_TYPE.Promotion || code === PRODUCT_LABEL_TYPE.Clearance
    ? code
    : PRODUCT_LABEL_TYPE.Normal;
}

/**
 * Item em edição na aba de geração. Preço e quantidade ficam como **texto**
 * enquanto o usuário digita (aceita vírgula, campo vazio no meio da edição);
 * os números saem de `parsePriceInput`/`parseQuantityInput` na hora de usar.
 */
export interface LabelDraftItem {
  productId: number;
  productName: string;
  barcode: string | null;
  /** Preço digitado (ex.: "12,50"). Na promoção, o valor da oferta. */
  priceInput: string;
  labelType: LabelTypeCode;
  /** Cópias digitadas (ex.: "3"). */
  quantityInput: string;
}

/** Uma etiqueta pronta para preview/impressão; `quantity` repete a célula na folha. */
export interface PrintableLabel {
  productName: string;
  barcode: string | null;
  price: number;
  labelType: LabelTypeCode;
  quantity: number;
}

/** Converte o preço digitado ("12,50", "1.234,56" ou "12.50") em número; inválido vira 0. */
export function parsePriceInput(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  // Com vírgula, o ponto é separador de milhar; sem vírgula, é decimal.
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Converte a quantidade digitada em inteiro; inválida vira 0 (barrada na validação). */
export function parseQuantityInput(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Formata um preço numérico para o campo de edição ("12,50"). */
export function formatPriceInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Materializa um item do rascunho na etiqueta de preview/impressão. */
export function draftToPrintable(item: LabelDraftItem): PrintableLabel {
  return {
    productName: item.productName,
    barcode: item.barcode,
    price: parsePriceInput(item.priceInput),
    labelType: item.labelType,
    quantity: Math.max(1, parseQuantityInput(item.quantityInput)),
  };
}
