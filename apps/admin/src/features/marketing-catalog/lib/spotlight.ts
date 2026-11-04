import {
  CATALOG_UNAVAILABLE_REASON,
  enumCode,
  type CatalogSpotlightDto,
  type StorefrontProductDto,
} from "@workspace/api-client-react";
import { storeDateKey } from "../template/text";
import type { CatalogProduct, SpotlightKind } from "../types";
import { ROLE_CODE, toCatalogProduct } from "./catalogProducts";
import { normalizePrintedName, unavailableLabel } from "./customSelection";
import { CATALOG_FORMATS } from "./formats";

/**
 * O banner de destaque (04/11/2026): um produto só por imagem, como promoção,
 * novidade ou reposição. Regras puras da tela — quem decide se o produto é
 * novidade ou reposição é o servidor; aqui fica o que a pessoa lê.
 */

export interface SpotlightKindOption {
  key: SpotlightKind;
  /** Como o tipo aparece na tela. */
  label: string;
  /** O título sugerido para o cabeçalho; a pessoa pode trocar. */
  title: string;
}

/**
 * Os três tipos. Os títulos e o "REPOSIÇÃO" impresso são do dono (04/11/2026);
 * o selo de cada um é o do catálogo (`BADGE_LABEL`).
 */
export const SPOTLIGHT_KINDS: Record<SpotlightKind, SpotlightKindOption> = {
  offer: { key: "offer", label: "Promocional", title: "Promoção" },
  new: { key: "new", label: "Novidade", title: "Chegou novidade!" },
  restock: { key: "restock", label: "Reposição", title: "Reposição" },
};

export const SPOTLIGHT_KIND_ORDER: readonly SpotlightKind[] = ["offer", "new", "restock"];

/** Há promoção no preço de agora: a de unidade ou o combo, a mesma conta do site. */
export function hasPromotion(card: StorefrontProductDto | null | undefined): boolean {
  return card?.promotion != null || card?.combo != null;
}

/**
 * O tipo que a tela sugere: a promoção primeiro (é ela que muda o preço
 * impresso), depois a novidade, depois a reposição. Sem nenhum, a novidade — o
 * padrão que o dono pediu para qualquer produto.
 */
export function suggestedKind(
  spotlight: Pick<CatalogSpotlightDto, "card" | "isNew" | "isRestock">,
): SpotlightKind {
  if (hasPromotion(spotlight.card)) return "offer";
  if (spotlight.isNew) return "new";
  return spotlight.isRestock ? "restock" : "new";
}

export interface SpotlightKindState {
  /** Pode ser escolhido. Só o promocional trava: sem promoção, o selo mentiria sobre o preço. */
  enabled: boolean;
  /** É o que os dados do produto dizem. */
  suggested: boolean;
  /** Por que está travado — a linha miúda do botão. */
  reason?: string;
}

/**
 * O que cada tipo pode, para o produto de agora. Sem a resposta do servidor
 * (antes da primeira consulta), nada trava: quem escolheu o tipo foi o menu.
 *
 * Novidade e reposição nunca travam (decisões do dono, 04/11/2026): a novidade
 * vale para qualquer produto, e a reposição pode ser escolhida à mão — a
 * marca "sugerido" é que segue os dados.
 */
export function kindStates(spotlight: CatalogSpotlightDto | null): Record<SpotlightKind, SpotlightKindState> {
  if (!spotlight) {
    return {
      offer: { enabled: true, suggested: false },
      new: { enabled: true, suggested: false },
      restock: { enabled: true, suggested: false },
    };
  }

  const promoted = hasPromotion(spotlight.card);
  return {
    offer: promoted
      ? { enabled: true, suggested: true }
      : { enabled: false, suggested: false, reason: "sem promoção ativa" },
    new: { enabled: true, suggested: !promoted && spotlight.isNew },
    restock: { enabled: true, suggested: !promoted && !spotlight.isNew && spotlight.isRestock },
  };
}

/** O aviso discreto da novidade fora da janela (decisão do dono, 04/11/2026: avisa, não trava). */
export function noveltyHint(spotlight: CatalogSpotlightDto | null, kind: SpotlightKind): string | null {
  if (!spotlight || kind !== "new" || spotlight.isNew) return null;
  const days = spotlight.daysInStore === 1 ? "1 dia" : `${spotlight.daysInStore} dias`;
  return `Na loja há ${days} — fora da janela de novidade do catálogo (30 dias).`;
}

/**
 * "Válida até 08/11", "Só hoje", ou nada. O dia sai do TEXTO da API, que já vem
 * no horário da loja e sem fuso: `new Date` o leria no fuso do aparelho (a
 * armadilha 8 do repositório). Ano só quando é outro.
 */
export function validityNote(validUntil: string | null | undefined, today: Date): string | null {
  const day = validUntil?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const todayKey = storeDateKey(today);
  if (day < todayKey) return null;
  if (day === todayKey) return "Só hoje";

  const [year, month, date] = day.split("-");
  return `Válida até ${date}/${month}${year === todayKey.slice(0, 4) ? "" : `/${year}`}`;
}

/** "Limite de 3 por cliente", ou nada. */
export function limitNote(maxQuantityPerSale: number | null | undefined): string | null {
  return maxQuantityPerSale != null && maxQuantityPerSale > 0
    ? `Limite de ${maxQuantityPerSale} por cliente`
    : null;
}

/**
 * As linhas miúdas abaixo do preço (decisão do dono, 04/11/2026: a validade e o
 * limite, quando existirem). Elas acompanham o PREÇO impresso: a promoção de
 * unidade muda o preço em qualquer tipo de banner, e o combo só aparece no
 * promocional, no selo.
 */
export function promotionNotes(card: StorefrontProductDto, kind: SpotlightKind, today: Date): string[] {
  const notes = card.promotion
    ? [validityNote(card.promotion.validUntil, today), limitNote(card.promotion.maxQuantityPerSale)]
    : card.combo && kind === "offer"
      ? [validityNote(card.combo.validUntil, today)]
      : [];
  return notes.filter((note): note is string => note !== null);
}

/**
 * O produto no formato do molde, com o papel do tipo (é com ele que vai ao
 * histórico) e o nome que a pessoa reescreveu — só no banner, como na etiqueta
 * de gôndola. `null` sem foto.
 */
export function toSpotlightProduct(
  card: StorefrontProductDto,
  kind: SpotlightKind,
  printedName: string,
): CatalogProduct | null {
  const product = toCatalogProduct({ role: ROLE_CODE[kind], product: card });
  if (!product) return null;

  const printed = normalizePrintedName(printedName);
  return printed ? { ...product, name: printed } : product;
}

/** O que impede gerar, dito para a pessoa. `null` = pode. */
export function spotlightBlocker(spotlight: CatalogSpotlightDto, kind: SpotlightKind): string | null {
  const reason = enumCode(spotlight.unavailable, CATALOG_UNAVAILABLE_REASON);
  if (reason !== CATALOG_UNAVAILABLE_REASON.None || !spotlight.card) {
    return `${spotlight.name} não pode sair no banner: ${unavailableLabel(reason)}.`;
  }
  if (kind === "offer" && !hasPromotion(spotlight.card)) {
    return "A promoção deste produto não está valendo agora. Escolha Novidade ou Reposição.";
  }
  return null;
}

/**
 * Abaixo disto a foto é "pequena": o mesmo número do catálogo em PDF e do
 * servidor (`CatalogDrawRules.LargeCardMinPhotoSide`), e da etiqueta "Foto
 * pequena" em BI › Anomalias.
 */
export const SMALL_PHOTO_SIDE = CATALOG_FORMATS.pdf.minPhotoSide;

/** O aviso da foto pequena (decisão do dono, 04/11/2026: avisa, não trava). */
export function smallPhotoHint(photo: { width: number; height: number } | undefined): string | null {
  if (!photo || photo.width <= 0 || photo.height <= 0) return null;
  const side = Math.min(photo.width, photo.height);
  if (side >= SMALL_PHOTO_SIDE) return null;

  return (
    `A foto deste produto é pequena (${side} px) e sai menor no banner, para não borrar. ` +
    "Ela está em BI › Anomalias, na etiqueta Foto pequena."
  );
}
