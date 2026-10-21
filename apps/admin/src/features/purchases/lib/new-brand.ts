import { resolveBarcodeInput } from "@workspace/core";
import type { PurchaseFormItem } from "../types";

/**
 * A linha de MARCA NOVA da compra (fase 4 do plano de grupo × variação, aprovado
 * pelo dono em 14/10/2026).
 *
 * A loja compra a mesma peça de outro fabricante, e a marca nova ainda não tem
 * cadastro: o código de barras muitas vezes só aparece com a caixa na mão. A
 * compra registra a marca; o cadastro nasce no recebimento, com o código bipado
 * ou gerado.
 *
 * Na grade a linha não tem `productId` de verdade. Ela ganha um id NEGATIVO, que
 * é só a chave da linha na tela: a linha que veio do banco usa o id do item da
 * compra com o sinal trocado (é o que o recebimento devolve ao servidor como
 * `purchaseItemId`); a criada agora, um número negativo que não colide com
 * nenhum desses.
 */
export function isNewBrandRow(item: Pick<PurchaseFormItem, "productId">): boolean {
  return item.productId < 0;
}

/** O item da compra que a linha representa (o recebimento manda este id). */
export function purchaseItemIdOf(item: Pick<PurchaseFormItem, "productId">): number | null {
  return isNewBrandRow(item) ? -item.productId : null;
}

/**
 * Chave da linha de marca nova criada agora. Abaixo de todo id de item gravado
 * (que vira negativo pequeno), para as duas formas nunca se encontrarem.
 */
export function nextNewBrandKey(items: PurchaseFormItem[]): number {
  const menor = items.reduce((min, item) => Math.min(min, item.productId), 0);
  return Math.min(menor, -1_000_000_000) - 1;
}

/** A marca como será gravada: sem espaço nas pontas e em caixa alta. */
export function normalizeBrand(brand: string | null | undefined): string {
  return (brand ?? "").trim().toUpperCase();
}

/**
 * O código como a loja o grava — o número curto vira o código interno —, para
 * comparar dois códigos digitados de jeitos diferentes. Inválido volta como veio.
 */
function normalizedBarcode(codigo: string | null | undefined): string | null {
  const limpo = codigo?.trim();
  if (!limpo) return null;
  return resolveBarcodeInput(limpo).code ?? limpo;
}

/** Tamanho máximo da marca — o da coluna de valor de grade. */
export const BRAND_MAX_LENGTH = 100;

/**
 * O que falta nas linhas de marca nova para gravar a compra, ou `null`.
 *
 * O código é OPCIONAL aqui (é o recebimento que o exige), mas, digitado, é
 * conferido pela mesma regra do cadastro de produto: aceito agora, ele só seria
 * recusado no recebimento, com a caixa aberta na mão.
 */
export function newBrandProblem(items: PurchaseFormItem[], existingBrands: string[] = []): string | null {
  const novas = items.filter((item) => isNewBrandRow(item) && item.quantity > 0);
  const vistas = new Set(existingBrands.map(normalizeBrand));
  // O mesmo código em duas marcas: no recebimento a segunda cairia na primeira.
  const codigos = new Set<string>();

  for (const item of novas) {
    const marca = normalizeBrand(item.newBrand);
    if (!marca) return "Informe a marca da variação nova.";
    if (marca.length > BRAND_MAX_LENGTH) return `A marca excede ${BRAND_MAX_LENGTH} caracteres.`;
    if (vistas.has(marca))
      return `A marca ${marca} já está na compra ou no produto: informe a quantidade na linha dela.`;
    vistas.add(marca);

    const codigo = item.newBarcode?.trim();
    if (codigo) {
      const resolvido = resolveBarcodeInput(codigo);
      if (resolvido.kind === "invalid") return resolvido.error;
      const gravado = resolvido.code ?? codigo;
      if (codigos.has(gravado)) return `O código ${gravado} está em duas marcas novas da compra.`;
      codigos.add(gravado);
    }
  }
  return null;
}

/**
 * O que falta nas linhas de marca nova para RECEBER, ou `null`: o código é
 * obrigatório — bipado ou gerado.
 */
export function receiveNewBrandProblem(items: PurchaseFormItem[]): string | null {
  const codigos = new Set<string>();
  for (const item of items.filter((linha) => isNewBrandRow(linha) && linha.quantity > 0)) {
    const codigo = item.newBarcode?.trim();
    if (!codigo && !item.generateBarcode)
      return `Informe o código de barras da marca ${normalizeBrand(item.newBrand)}: bipe o da embalagem ou gere um.`;
    // Com "Gerar código" o que estava no campo (o código da compra) não vai.
    if (codigo && !item.generateBarcode) {
      const resolvido = resolveBarcodeInput(codigo);
      if (resolvido.kind === "invalid") return resolvido.error;
      // Duas marcas com o mesmo código bipado: a segunda viraria recompra da
      // primeira, e a marca dela sumiria sem aviso.
      const gravado = resolvido.code ?? codigo;
      if (codigos.has(gravado)) return `O código ${gravado} foi bipado para duas marcas novas.`;
      codigos.add(gravado);
    }
  }
  return null;
}

/**
 * As linhas de marca nova que VIRAM CADASTRO no recebimento: as que vieram e não
 * são recompra de um cadastro da grade (o código bipado é o dele). "Gerar
 * código" sempre vira cadastro.
 */
function brandsToCreate(items: PurchaseFormItem[]): PurchaseFormItem[] {
  const cadastrados = new Set(
    items.filter((item) => !isNewBrandRow(item)).flatMap((item) => normalizedBarcode(item.barcode) ?? []),
  );
  return items.filter(
    (item) =>
      isNewBrandRow(item) &&
      item.quantity > 0 &&
      (item.generateBarcode || !cadastrados.has(normalizedBarcode(item.newBarcode) ?? "")),
  );
}

/**
 * Produto SIMPLES com marca nova: o cadastro atual vira a primeira variação e
 * precisa de uma marca. Não precisa quando toda marca nova que veio é recompra
 * de um cadastro da grade, porque aí nada é convertido e a marca pedida seria
 * ignorada.
 */
export function needsCurrentBrand(items: PurchaseFormItem[]): boolean {
  return brandsToCreate(items).length > 0;
}

/**
 * O que falta na marca do cadastro atual, ou `null`. Ela não pode repetir a de
 * uma marca que vai virar cadastro; a da recompra do próprio cadastro pode — é
 * ele (achado da revisão de 21/10/2026).
 */
export function currentBrandProblem(items: PurchaseFormItem[], currentBrand: string): string | null {
  const marca = normalizeBrand(currentBrand);
  if (!marca) return "Informe a marca do cadastro atual.";
  // A API recusa do mesmo jeito; aqui o aviso vem antes do clique.
  if (brandsToCreate(items).some((item) => normalizeBrand(item.newBrand) === marca))
    return `A marca do cadastro atual tem que ser diferente da marca nova (${marca}).`;
  return null;
}

/**
 * O recebimento tem CONFERÊNCIA (grade editável)? Com mais de uma variação, ou
 * com marca nova — que precisa do código no recebimento mesmo sozinha.
 */
export function conferencia(items: PurchaseFormItem[]): boolean {
  return items.length > 1 || items.some(isNewBrandRow);
}
