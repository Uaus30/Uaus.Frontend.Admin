import type { ProductLabelDraftDto, SaveProductLabelDraftPayload } from "@workspace/api-client-react";
import {
  customNameForPayload,
  formatPriceInput,
  labelTypeFromEnum,
  parsePriceInput,
  parseQuantityInput,
  type LabelDraftItem,
} from "./types";
import { expectedLabelPrice } from "./promotion";

/**
 * Conversões entre a lista da tela e o rascunho salvo no servidor.
 *
 * O rascunho guarda só o que o operador EDITOU (nome e preço); o resto segue o
 * cadastro e vem atualizado a cada abertura. Decisão do dono em 30/09/2026: a
 * lista pode ficar dias aberta enquanto é montada na prateleira, e a etiqueta
 * não pode sair com o preço do dia em que o produto entrou nela.
 */

/** O que a tela precisa para se remontar a partir do rascunho. */
export interface LoadedLabelDraft {
  description: string;
  items: LabelDraftItem[];
}

/** Rascunho vazio — é o que vale quando o servidor responde que não há nenhum. */
export const EMPTY_LABEL_DRAFT: LoadedLabelDraft = { description: "", items: [] };

/** Valor em centavos, para comparar preço sem tropeçar no ponto flutuante. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Preço a guardar no rascunho: **só** quando o operador o editou.
 *
 * Igual ao do cadastro é "não editado" — segue o cadastro. Campo vazio ou
 * inválido (zero, letra, no meio da digitação) também segue: o servidor recusa
 * preço não positivo, e o salvamento automático não pode falhar porque a pessoa
 * ainda está digitando. A tela continua mostrando o que foi digitado, e a
 * validação de verdade acontece ao imprimir.
 */
export function customPriceForPayload(item: LabelDraftItem): number | null {
  const typed = parsePriceInput(item.priceInput);
  if (typed <= 0) return null;
  // A régua do "editado" é o preço que a etiqueta teria sozinha — o promocional,
  // na etiqueta de oferta de um produto em promoção (05/10/2026). Comparar com o
  // de tabela gravaria o preço da relâmpago como oferta digitada, e a etiqueta
  // continuaria com ele depois do sábado.
  return toCents(typed) === toCents(expectedLabelPrice(item)) ? null : toCents(typed) / 100;
}

/**
 * A lista da tela como o servidor espera. Quantidade em branco ou zero vai
 * como 1 pelo mesmo motivo do preço: é estado de digitação, não intenção.
 */
export function toDraftPayload(items: LabelDraftItem[], description: string): SaveProductLabelDraftPayload {
  return {
    description: description.trim() || null,
    items: items.map((item) => ({
      productId: item.productId,
      labelType: item.labelType,
      quantity: Math.max(1, parseQuantityInput(item.quantityInput)),
      productName: customNameForPayload(item),
      price: customPriceForPayload(item),
    })),
  };
}

/** Lista vazia e sem identificação: salvar isso apaga o rascunho no servidor. */
export function isEmptyDraftPayload(payload: SaveProductLabelDraftPayload): boolean {
  return payload.items.length === 0 && !payload.description;
}

/** Remonta a lista da tela a partir do rascunho, com o cadastro de hoje. */
export function fromDraftDto(dto: ProductLabelDraftDto | null): LoadedLabelDraft {
  if (!dto) return EMPTY_LABEL_DRAFT;

  return {
    description: dto.description ?? "",
    items: dto.items.map((item) => ({
      productId: item.productId,
      // A promoção chega depois, pela lista de promoções (`withLabelPromotion`
      // no composer): o rascunho não a guarda, como não guarda o preço.
      productGroupId: item.productGroupId ?? null,
      promotion: null,
      productName: item.customName ?? item.catalogName,
      catalogName: item.catalogName,
      barcode: item.barcode?.trim() ? item.barcode.trim() : null,
      priceInput: formatPriceInput(item.customPrice ?? item.catalogPrice),
      catalogPrice: item.catalogPrice,
      labelType: labelTypeFromEnum(item.labelType),
      quantityInput: String(item.quantity),
    })),
  };
}
