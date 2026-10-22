import { resolveBarcodeInput } from "@workspace/core";
import type { PurchaseDto, ReceiveBarcodeChangePayload } from "@workspace/api-client-react";
import type { PurchaseFormItem } from "../types";

/**
 * "Código de barras mudou?" no recebimento (22/10/2026, decisão do dono).
 *
 * O fabricante troca o código da embalagem, e a compra chega com o número novo.
 * Quem recebe bipa o código novo na variação: sem venda, o backend só troca o
 * código; com venda, o cadastro fica com o antigo como "MARCA ANTERIOR N" e as
 * unidades desta compra entram numa variação nova, com o código novo — são elas
 * que o caixa vai bipar com ele.
 *
 * As linhas que aceitam troca são as que JÁ têm cadastro (`productId` positivo):
 * a marca nova e a variação do produto novo têm o próprio campo de código.
 */
function cadastradas(items: PurchaseFormItem[]): PurchaseFormItem[] {
  // Linha com zero não veio: trocar o código dela separaria o cadastro (com
  // venda) numa variação nova sem nenhuma unidade.
  return items.filter((item) => item.productId > 0 && item.quantity > 0);
}

/**
 * As trocas que vão no corpo do recebimento — só o que mudou de fato.
 *
 * Campo vazio é "não mudou", e o código igual ao do cadastro (bipado para
 * conferir) também: mandá-lo faria o servidor trocar nada, mas é ruído. Linha
 * que saiu da conferência não leva a troca junto.
 */
export function barcodeChangesOf(
  items: PurchaseFormItem[],
  changes: Record<number, string>,
): ReceiveBarcodeChangePayload[] | undefined {
  const trocas = cadastradas(items).flatMap((item) => {
    const digitado = changes[item.productId]?.trim() ?? "";
    if (!digitado) return [];
    const resolvido = resolveBarcodeInput(digitado);
    if (resolvido.code !== null && resolvido.code === item.barcode) return [];
    return [{ productId: item.productId, barcode: digitado }];
  });
  return trocas.length > 0 ? trocas : undefined;
}

/**
 * O que impede o recebimento por causa das trocas, ou `null`.
 *
 * O código inválido é recusado pela mesma regra e com a mesma mensagem do
 * cadastro de produto; o mesmo código novo em duas variações, porque a segunda
 * cairia na primeira.
 */
export function receiveBarcodeProblem(
  items: PurchaseFormItem[],
  changes: Record<number, string>,
): string | null {
  const vistos = new Set<string>();
  for (const item of cadastradas(items)) {
    const digitado = changes[item.productId]?.trim() ?? "";
    if (!digitado) continue;
    const resolvido = resolveBarcodeInput(digitado);
    if (resolvido.kind === "invalid") return `Código novo de ${item.name}: ${resolvido.error}`;
    if (resolvido.code === null || resolvido.code === item.barcode) continue;
    if (vistos.has(resolvido.code)) return `O código ${resolvido.code} foi informado em duas variações.`;
    vistos.add(resolvido.code);
  }
  return null;
}

/**
 * O custo unitário que a margem do recebimento confere.
 *
 * Na conferência com variações, o MAIOR unitário entre as que vieram: em custo
 * manual o GG custa mais que o P, e é nele que o preço único do recebimento
 * pode ficar abaixo do custo. Sem conferência, o unitário da compra.
 */
export function receiveUnitCost(purchase: PurchaseDto, items: PurchaseFormItem[]): number {
  const unitarios = items
    .filter((item) => item.quantity > 0)
    .map((item) => Math.round((item.finalTotal / item.quantity) * 100) / 100);
  return items.length > 1 && unitarios.length > 0 ? Math.max(...unitarios) : purchase.unitFinal;
}
