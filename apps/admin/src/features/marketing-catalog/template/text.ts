import { round2 } from "@workspace/core";
import type { CatalogBadge } from "../types";

/** O preço partido como na etiqueta de mercado: reais grandes, centavos pequenos. */
export interface PriceParts {
  whole: string;
  cents: string;
}

/**
 * Parte o preço em reais e centavos, no formato brasileiro.
 *
 * Arredonda com o `round2` do core, e não com `toFixed` direto: `toFixed`
 * arredonda 1,005 para 1,00, e o preço do catálogo não pode divergir em um
 * centavo do preço do balcão.
 */
export function splitPrice(value: number): PriceParts {
  const [whole, cents] = round2(Math.max(0, value)).toFixed(2).split(".");
  return { whole: Number(whole).toLocaleString("pt-BR"), cents };
}

/** Preço por extenso, para o "de" riscado: `R$ 15,00`. */
export function formatPrice(value: number): string {
  const { whole, cents } = splitPrice(value);
  return `R$ ${whole},${cents}`;
}

/**
 * O dia no calendário da LOJA (Brasília), e não no do aparelho.
 *
 * O banner é gerado no celular de quem estiver na loja, mas a data impressa é
 * a referência dos preços: um aparelho com o fuso errado não pode datar a peça
 * de ontem ou de amanhã.
 */
export function formatStoreDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * O aviso fixo de toda peça (texto pedido pelo dono em 03/10/2026).
 *
 * A data vai DENTRO do aviso porque a imagem circula por dias depois de
 * compartilhada: sem ela, o preço de hoje vira promessa sem prazo.
 */
export function priceDisclaimer(date: Date): string {
  return (
    `Preços de referência em ${formatStoreDate(date)}, sujeitos a alteração sem aviso ` +
    "e à disponibilidade de estoque. Imagens meramente ilustrativas."
  );
}

/** O maior título que o cabeçalho comporta, na menor fonte. */
export const TITLE_MAX_LENGTH = 36;

/** Título pronto para o cabeçalho: sem espaço sobrando e dentro do teto. */
export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX_LENGTH).trim();
}

/**
 * Corpo do título conforme o comprimento, para ele caber em UMA linha.
 *
 * A Montserrat 900 em maiúsculas ocupa cerca de 0,72 do corpo por caractere, e
 * a linha útil tem 1000 px: 18 caracteres a 64 px, 24 a 54, 30 a 46 e 36 a 38.
 */
export function titleFontSize(title: string): number {
  const length = normalizeTitle(title).length;
  if (length <= 18) return 64;
  if (length <= 24) return 54;
  if (length <= 30) return 46;
  return 38;
}

/** O texto de cada selo, como sai impresso. */
export const BADGE_LABEL: Record<CatalogBadge, string> = {
  offer: "OFERTA",
  new: "NOVIDADE",
  lastUnits: "ÚLTIMAS UNIDADES",
};
