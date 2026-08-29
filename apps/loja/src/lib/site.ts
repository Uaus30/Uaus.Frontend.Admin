/**
 * Identidade e contatos da loja — os valores do site original, verbatim.
 *
 * São o FALLBACK: o rodapé e a página de contato preferem o que vier do
 * endpoint público `/Storefront/company` (mantido pelo admin em Configurações
 * da Empresa) e caem aqui quando o campo estiver vazio ou a API fora do ar.
 * Mudou o telefone da loja? Atualize no admin — este arquivo é a rede de
 * segurança, não o cadastro.
 */
export const SITE_NAME = "Uaus!";

export const SITE_TAGLINE = "MÁXIMO 30";

export const SITE_CONTACT = {
  /** Número em formato wa.me (código do país + DDD + número, só dígitos). */
  whatsappNumber: "5544991365567",
  whatsappDisplay: "(44) 99136-5567",
  email: "uaus30@gmail.com",
  instagramUrl: "https://www.instagram.com/uaus_maximo30/",
  addressLine: "Rua Paranaguá, 663",
  addressDistrict: "Centro, Tapira-PR",
  landmark: "Pertinho do Correios",
  cnpjLine: "CNPJ: 64.958.682/0001-22",
  mapsShareUrl: "https://share.google/ryVm9lKIGuVFk0sN2",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=Rua+Paranagu%C3%A1,+663,+centro,+Tapira-PR&t=&z=16&ie=UTF8&iwloc=&output=embed",
} as const;

/** Tagline longa do rodapé, verbatim do site original. */
export const SITE_FOOTER_TAGLINE =
  "Tudo o que você precisa por no máximo R$ 30,00. Qualidade e preço baixo em um só lugar.";
