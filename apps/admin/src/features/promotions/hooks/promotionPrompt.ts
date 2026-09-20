import { formatCurrency, toDateKey } from "@workspace/core";
import { instantToDate, instantToTime } from "./promotionRules";

/**
 * O texto que a loja cola na ferramenta de IA para gerar a arte da relâmpago.
 *
 * ## Por que ele é composto e não guardado
 *
 * Regenerar é de graça, e um texto gravado envelhece junto com o preço: a
 * promoção que muda de R$ 0,99 para R$ 1,29 na sexta teria um prompt prometendo
 * o preço de quarta. Nada aqui vai ao banco — é função pura, sem rede, e o
 * resultado sai **editável** na modal.
 *
 * ## Por que os blocos são condicionais
 *
 * O molde saiu de três artes que a loja publicou (copo americano, xuxinhas,
 * batons), e **elas não são um padrão fechado**: as três divergem na assinatura
 * (duas "Máximo 30", uma "Uaus!"), no endereço (duas trazem, uma não) e na cor do
 * raio. Um molde rígido viraria um parágrafo que alguém reescreve à mão toda
 * semana — então cada bloco entra só quando o dado existe, e a assinatura é
 * escolhida na modal.
 *
 * ## Por que os textos vão entre aspas
 *
 * Gerador de imagem erra texto antes de errar qualquer outra coisa, e erra mais
 * em português. O prompt manda escrever **exatamente** o que está entre aspas, e
 * repete o pedido de ortografia no fim.
 */

/** Os dois formatos: feed/WhatsApp e Stories. */
export type PromotionArtFormat = "feed" | "story";

/** Proporção e tamanho de cada formato, na ordem em que o prompt os nomeia. */
export const ART_FORMAT: Record<PromotionArtFormat, { ratio: string; size: string; label: string }> = {
  feed: { ratio: "4:5", size: "1080 x 1350 px", label: "Feed e WhatsApp" },
  story: { ratio: "9:16", size: "1080 x 1920 px", label: "Stories" },
};

/**
 * O espaço que o `Intl` do pt-BR põe entre "R$" e o número.
 *
 * Escrito por código, e não como caractere literal: no fonte ele é invisível, e
 * o lint o recusa justamente porque ninguém enxerga a diferença numa revisão.
 */
const ESPACO_NAO_SEPARAVEL = String.fromCharCode(160);

/** As duas assinaturas que a loja já usou nas artes publicadas. */
export const ART_SIGNATURES = ["Máximo 30", "Uaus!"] as const;

export interface PromotionPromptInput {
  /** Nome do produto, como sai no cartaz. */
  productName: string;
  /** Descrição do cadastro — só serve para achar a medida (volume, quantidade). */
  productDescription?: string | null;
  /** O "por": menor preço promocional do grupo. */
  price: number;
  /** O maior preço promocional. Diferente do menor vira "A PARTIR DE". */
  priceMax?: number;
  /** Teto de unidades por venda, quando houver. */
  maxQuantityPerSale?: number | null;
  /** Início da vigência, `"yyyy-MM-ddTHH:mm:ss"`. */
  validFrom: string;
  /** Fim da vigência. Nulo = sem prazo. */
  validUntil?: string | null;
  format: PromotionArtFormat;
  /** Assinatura escolhida na modal. */
  signature: string;
  /** Endereço de Configurações da Empresa. Vazio simplesmente não entra. */
  addressLine?: string;
  cityState?: string;
}

/**
 * A validade em uma frase de cartaz.
 *
 * Cobre os três casos das artes de referência, e é o bloco que mais erra se for
 * genérico: "válido até 19/09" num cartaz que circula no grupo de WhatsApp às
 * 15h de sábado não diz à cliente que ela tem três horas.
 *
 * @param validFrom Início da vigência, no formato da API.
 * @param validUntil Fim da vigência, ou nulo.
 * @param hoje Injetado para o teste não depender do relógio.
 */
export function describeValidity(
  validFrom: string,
  validUntil: string | null | undefined,
  hoje: Date,
): string {
  if (!validUntil) return "PROMOÇÃO POR TEMPO LIMITADO!";

  const dia = instantToDate(validFrom);
  if (!dia) return "PROMOÇÃO POR TEMPO LIMITADO!";

  const inicio = instantToTime(validFrom, "00:00");
  const fim = instantToTime(validUntil, "23:59");
  const diaTodo = inicio === "00:00" && fim >= "23:59";

  if (toDateKey(dia) === toDateKey(hoje)) {
    return diaTodo ? "VÁLIDO APENAS PARA HOJE!" : `SOMENTE HOJE ATÉ ${porExtenso(fim)}!`;
  }

  // Dentro da semana, o dia da semana é mais legível que a data: "NESTE SÁBADO"
  // é o que a cliente confere sem abrir o calendário. Fora dela, a data não tem
  // substituto — "no sábado" a três semanas daqui é ambíguo.
  const distancia = Math.round((diaSemHora(dia).getTime() - diaSemHora(hoje).getTime()) / 86_400_000);
  const quando =
    distancia > 0 && distancia <= 7 ? `NESTE ${nomeDoDia(dia)}` : `EM ${dia.toLocaleDateString("pt-BR")}`;

  return diaTodo
    ? `SOMENTE ${quando} — O DIA TODO!`
    : `SOMENTE ${quando}, DAS ${porExtenso(inicio)} ÀS ${porExtenso(fim)}!`;
}

/**
 * A medida que aparece no nome ou na descrição — volume, peso ou quantidade.
 *
 * Existe porque o cartaz do copo dizia "300ML" numa faixa própria: a medida é o
 * que responde "é grande?" antes de a cliente perguntar. Nulo quando não há, e
 * aí o bloco não entra — inventar "TAMANHO ÚNICO" seria escrever no cartaz algo
 * que ninguém conferiu.
 */
export function extractAttribute(productName: string, description?: string | null): string | null {
  const texto = `${productName} ${description ?? ""}`;
  const medida = /(\d+(?:[.,]\d+)?)\s*(ml|lt|l|kg|g|cm|mm|und|un|pçs|pç|pcs|peças|peça|pares|par)\b/i.exec(
    texto,
  );

  if (!medida) return null;

  return `${medida[1]}${medida[2].toUpperCase()}`.replace(/\s+/g, "");
}

/** O prompt inteiro, pronto para copiar. */
export function buildPromotionPrompt(input: PromotionPromptInput, hoje: Date = new Date()): string {
  const formato = ART_FORMAT[input.format];
  const medida = extractAttribute(input.productName, input.productDescription);
  const faixa = input.priceMax != null && input.priceMax > input.price;

  const textos: string[] = [
    `- Cabeçalho: "PROMOÇÃO" numa caixa preta, e logo abaixo "RELÂMPAGO" em laranja, com um raio ao lado`,
    `- Produto: "${input.productName.toUpperCase()}"`,
  ];

  if (medida) textos.push(`- Medida, numa faixa própria: "${medida}"`);

  textos.push(
    faixa
      ? `- Preço: "A PARTIR DE" em branco, e "${precoDoCartaz(input.price)}" em laranja, bem grande`
      : `- Preço: "POR APENAS" em branco, e "${precoDoCartaz(input.price)}" em laranja, bem grande`,
  );
  textos.push(`- Logo abaixo do preço, menor: "A UNIDADE"`);

  if (input.maxQuantityPerSale && input.maxQuantityPerSale > 0) {
    textos.push(`- Limite: "LIMITE DE ${input.maxQuantityPerSale} UNIDADES POR CLIENTE"`);
  }

  textos.push(
    `- Validade, em destaque no rodapé: "${describeValidity(input.validFrom, input.validUntil, hoje)}"`,
  );
  textos.push(`- Assinatura: "${input.signature}"`);

  const endereco = [input.addressLine, input.cityState].filter(Boolean).join(" — ");
  if (endereco) textos.push(`- Endereço, na última linha, pequeno: "${endereco}"`);

  return [
    `Crie uma arte publicitária vertical ${formato.ratio} (${formato.size}) para a promoção relâmpago de uma loja de variedades.`,
    ``,
    `ESTILO`,
    `- Fundo preto com textura sutil. Tipografia condensada, pesada, toda em caixa alta.`,
    `- Acento em laranja vibrante e amarelo; um raio estilizado em 3D como elemento do cabeçalho.`,
    `- Composição centralizada, contraste alto, legível na miniatura do WhatsApp.`,
    ``,
    `TEXTOS — escreva EXATAMENTE o que está entre aspas, em português do Brasil. Não traduza, não reescreva e não acrescente nenhum outro texto.`,
    ...textos,
    ``,
    `PRODUTO`,
    `Use a foto anexada, recortada do fundo, sobre um círculo branco com sombra suave. Não mude a cor nem o formato do produto.`,
    ``,
    `CUIDADOS`,
    `- Nenhum texto além dos listados acima — nem selo, nem marca-d'água, nem texto decorativo.`,
    `- Confira acentos e cedilha: "PROMOÇÃO", "RELÂMPAGO", "UNIDADE".`,
    ...(input.format === "story"
      ? [
          `- Deixe a faixa de 250 px do topo e a de 320 px do rodapé livres de texto: a interface do Instagram cobre as duas.`,
        ]
      : []),
  ].join("\n");
}

/**
 * O preço como o cartaz escreve.
 *
 * `formatCurrency` põe um espaço NÃO SEPARÁVEL entre "R$" e o número — é o que o
 * `Intl` do pt-BR produz. Ele é invisível, sobrevive ao copiar e colar, e chega
 * na ferramenta de IA dentro de um texto que o prompt manda reproduzir letra por
 * letra: exatamente o lugar onde um caractere invisível vira quadradinho no
 * cartaz impresso.
 */
function precoDoCartaz(value: number): string {
  return formatCurrency(value).split(ESPACO_NAO_SEPARAVEL).join(" ");
}

/** Meia-noite do dia, para a distância em dias não depender da hora. */
function diaSemHora(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nomeDoDia(date: Date): string {
  return date.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
}

/**
 * A hora como o cartaz escreve.
 *
 * "MEIO DIA" saiu de uma das artes de referência, e é assim que a loja fala.
 * "18:00" vira "AS 18H" porque o cartaz não usa dois pontos.
 */
function porExtenso(hhmm: string): string {
  if (hhmm === "12:00") return "MEIO DIA";

  const [hora = "0", minuto = "00"] = hhmm.split(":");
  const numero = Number(hora);

  return minuto === "00" ? `AS ${numero}H` : `AS ${numero}H${minuto}`;
}
