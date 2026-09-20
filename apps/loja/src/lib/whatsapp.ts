import { formatCurrency } from "@workspace/core";
import { SITE_CONTACT } from "./site";

/**
 * Montagem dos links de WhatsApp — o canal de conversão do site.
 *
 * O site NÃO envia nada sozinho: todo fluxo termina abrindo o WhatsApp do
 * visitante com a mensagem pré-preenchida, e é ele quem confirma o envio. Foi a
 * troca deliberada pelo formulário do site antigo, que postava num backend
 * próprio com credencial de e-mail hardcoded.
 */

/** Dados do formulário de contato que viram mensagem. */
export interface ContactMessageInput {
  name: string;
  phone?: string;
  message: string;
}

/** Dados do produto que viram mensagem de reserva. */
export interface ReservationMessageInput {
  name: string;
  /** Preço de TABELA. Só é citado quando não há promoção vigente. */
  price: number;
  priceMax?: number | null;
  /** O que o cliente paga com a promoção. Ausente sem promoção. */
  promotionalPrice?: number | null;
  promotionalPriceMax?: number | null;
  /** Variação escolhida no detalhe, quando o grupo tem mais de uma. */
  variationName?: string;
  /** URL absoluta do produto no site, para a lojista abrir direto. */
  url?: string;
}

/** Link wa.me com a mensagem codificada. */
export function buildWhatsAppUrl(message: string, phoneNumber: string = SITE_CONTACT.whatsappNumber): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

/** Mensagem do formulário de contato. */
export function buildContactMessage(input: ContactMessageInput): string {
  const lines = [`Olá! Meu nome é ${input.name.trim()}.`];

  if (input.phone?.trim()) {
    lines.push(`Telefone: ${input.phone.trim()}`);
  }

  lines.push("", input.message.trim());

  return lines.join("\n");
}

/**
 * Mensagem de reserva de um produto.
 *
 * Cita nome, preço e o LINK do produto: o link é o que permite à lojista abrir
 * o cadastro certo sem adivinhar qual "caneca" o cliente quis — nome de produto
 * repete, URL não.
 *
 * **O preço citado é o que o cliente VAI PAGAR.** Com promoção vigente a página
 * mostra "de R$ 1,75 por R$ 0,99" e a mensagem chegava na loja dizendo R$ 1,75:
 * a cliente pede reserva citando um preço que não é o dela, e quem descobre é o
 * balcão. Quando há variação escolhida, o preço é o DELA — é a razão de o
 * detalhe carregar o promocional por variação.
 */
export function buildReservationMessage(input: ReservationMessageInput): string {
  const base = input.promotionalPrice ?? input.price;
  const baseMax = input.promotionalPrice != null ? input.promotionalPriceMax : input.priceMax;

  const price =
    baseMax != null && baseMax > base ? `a partir de ${formatCurrency(base)}` : formatCurrency(base);

  const lines = [`Olá! Quero reservar o produto *${input.name.trim()}* (${price}) que vi no site.`];

  if (input.variationName?.trim()) {
    lines.push(`Variação: ${input.variationName.trim()}`);
  }

  if (input.url) {
    lines.push("", input.url);
  }

  return lines.join("\n");
}
