import { PRODUCT_STATUS, enumCode, type ReactivatedProductDto } from "@workspace/api-client-react";

/** O pedaço do formulário que a reativação toca: o id da variação e o status. */
type StatusCarrier = { id: number | null; status: string };

/**
 * O formulário depois de uma entrada de estoque que reativou a variação.
 *
 * O editor carrega o status na abertura. Se a aba Estoque lança uma entrada que
 * devolve a variação a Ativo, o formulário continua mostrando "Inativo" — e o
 * próximo Salvar gravaria o status velho por cima da reativação, em silêncio e
 * com linha no histórico.
 *
 * Só troca o status que ainda ESPELHA o de antes da entrada. Se a pessoa mudou
 * o status à mão e ainda não salvou, a escolha dela fica: é intenção, não cópia
 * velha do servidor. Devolve o MESMO objeto quando nada muda, para o React não
 * renderizar à toa.
 */
export function withReactivatedStatus<T extends StatusCarrier>(
  item: T,
  products: ReactivatedProductDto[],
): T {
  if (item.id === null) return item;

  const reactivated = products.find((product) => product.productId === item.id);
  if (!reactivated) return item;

  const formStatus = enumCode(item.status, PRODUCT_STATUS);
  if (formStatus !== enumCode(reactivated.previousStatus, PRODUCT_STATUS)) return item;

  return { ...item, status: String(PRODUCT_STATUS.Active) };
}

/** A mesma troca na lista de variações; devolve a MESMA lista quando nenhuma muda. */
export function withReactivatedStatuses<T extends StatusCarrier>(
  items: T[],
  products: ReactivatedProductDto[],
): T[] {
  const next = items.map((item) => withReactivatedStatus(item, products));
  return next.some((item, index) => item !== items[index]) ? next : items;
}
