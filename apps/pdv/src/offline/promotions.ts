import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, enumCode } from "@workspace/api-client-react";
import { META_KEY } from "./database";
import { readMeta, writeMeta } from "./meta";
import type { LocalPromotion, PdvSnapshotPromotion } from "./types";

/**
 * Promoções na base local do PDV.
 *
 * O balcão recebe a **regra** (grupo, desconto, janela, limite), nunca um preço
 * pronto: é isso que faz a relâmpago das 14h valer numa sessão de caixa aberta às
 * 9h, com ou sem internet. Quem decide o preço é `allocatePromotions`, pelo
 * relógio local, a cada venda.
 *
 * ## Onde as promoções moram, e por quê
 *
 * Numa chave da store `meta`, não numa store própria — a mesma escolha dos
 * cupons, e pelo mesmo motivo: store nova exigiria `DATABASE_VERSION` 3, e a
 * migração apagaria `products`, `paymentMethods` e `customers` de **todo caixa da
 * rede** na primeira abertura depois do deploy (armadilha 4 do CLAUDE.md). Um
 * caixa que subisse a versão sem internet ficaria sem catálogo para vender.
 *
 * ## Duas escritas, uma leitura
 *
 * Escrevem aqui o snapshot (na abertura da sessão) e a atualização em tempo real
 * (`GET /Pdv/promotions`, a cada cinco minutos e no início de uma venda quando a
 * lista já passou de um minuto — ver `features/pdv/hooks/use-promotions.ts`). Lê
 * daqui o carrinho, e só ele. É o que garante que uma queda de internet no meio
 * do sábado não muda preço nenhum: sem rede, vale o que está gravado.
 */

/**
 * Converte a promoção do servidor no registro local.
 *
 * Normaliza na **carga**, não na consulta, pelo mesmo motivo do `searchName` do
 * produto e do código do cupom: o carrinho avalia a cada item bipado, e a carga
 * acontece uma vez por turno. O que se normaliza aqui são os dois enums — a API
 * os serializa pelo NOME, e comparar contra `PROMOTION_TYPE` no balcão daria
 * falso a cada avaliação.
 */
export function toLocalPromotion(promotion: PdvSnapshotPromotion): LocalPromotion {
  return {
    id: promotion.id,
    productGroupId: promotion.productGroupId,
    type: enumCode(promotion.type, PROMOTION_TYPE) ?? PROMOTION_TYPE.None,
    discountType: enumCode(promotion.discountType, PROMOTION_DISCOUNT_TYPE) ?? PROMOTION_DISCOUNT_TYPE.None,
    discountValue: promotion.discountValue ?? 0,
    validFrom: promotion.validFrom,
    validUntil: promotion.validUntil ?? null,
    maxQuantityPerSale: promotion.maxQuantityPerSale ?? null,
  };
}

/**
 * Grava a lista de promoções, substituindo a anterior por inteiro.
 *
 * Substituição, e não mesclagem: a lista do servidor é a verdade, e uma promoção
 * que sumiu de lá (excluída, desativada, ou que saiu da janela de sete dias) tem
 * que sumir daqui. Mesclar deixaria promoção encerrada valendo no balcão até
 * alguém fechar o caixa.
 */
export function writeLocalPromotions(promotions: LocalPromotion[] | null): Promise<void> {
  return writeMeta(META_KEY.promotions, promotions ?? []);
}

/**
 * Lê as promoções gravadas. Lista vazia quando nunca houve carga — e não nulo:
 * "sem promoção" é o estado normal da loja na maior parte da semana, e obrigar
 * cada chamador a distinguir os dois casos só multiplicaria o mesmo `?? []`.
 */
export async function readLocalPromotions(): Promise<LocalPromotion[]> {
  const stored = await readMeta<LocalPromotion[]>(META_KEY.promotions);
  return Array.isArray(stored) ? stored : [];
}
