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
  /**
   * Ficha da loja no Google Maps — abre o cartão do estabelecimento (nome,
   * fotos, horário, avaliações, "Como chegar"), não um alfinete solto no
   * endereço. O `cid` é o identificador permanente do lugar (0x864f37992156cdb8
   * em hexadecimal, como aparece na URL longa do Maps). Não troque pela URL que
   * o navegador mostra na barra: ela carrega token de sessão (`g_ep`, `entry`)
   * e enquadramento de câmera, que vencem — esta forma curta não vence.
   */
  mapsPlaceUrl: "https://maps.google.com/?cid=9678015255071346104",
  /**
   * O mesmo lugar dentro de um `<iframe>`. `output=embed` é o modo público do
   * Maps, sem chave de API; o Google redireciona para /maps/embed com o cid.
   */
  mapsEmbedUrl: "https://maps.google.com/maps?cid=9678015255071346104&output=embed",
} as const;

/** Tagline longa do rodapé, verbatim do site original. */
export const SITE_FOOTER_TAGLINE =
  "Tudo o que você precisa por no máximo R$ 30,00. Qualidade e preço baixo em um só lugar.";

/** Uma regra de horário: para quais dias vale e em que janelas a loja abre. */
export interface OpeningHoursRule {
  days: string;
  hours: string;
}

/**
 * Horário de funcionamento da loja, informado pelo dono em 29/08/2026.
 *
 * Para comércio local, horário é o dado mais consultado depois do endereço, e
 * a ausência dele é lida como "site abandonado". Ele NÃO vem da API: o
 * `StorefrontCompanyDto` (nome, endereço, telefone, CNPJ) não tem o campo, e
 * este arquivo é o cadastro enquanto isso for verdade. Mudou o horário da
 * loja? É aqui, e vai junto com um deploy.
 *
 * É lista, e não uma frase só, porque o sábado tem duas regras — a diferença
 * entre o 1º/2º sábado e os demais é justamente o que o cliente precisa
 * conferir antes de sair de casa, e ela se perde quando vira texto corrido.
 *
 * Quem exibe: o cartão do `VisitBanner` na home e a coluna de informações da
 * página de contato.
 */
export const SITE_OPENING_HOURS: readonly OpeningHoursRule[] = [
  { days: "Segunda a sexta", hours: "8h30 às 12h e 13h30 às 18h" },
  { days: "1º e 2º sábado do mês", hours: "8h30 às 18h" },
  { days: "Demais sábados", hours: "8h30 às 13h" },
];
