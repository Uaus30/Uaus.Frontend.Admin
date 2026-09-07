/**
 * O vocabulário de cor das telas de BI.
 *
 * Mora aqui, e não dentro de uma das features, porque as três telas de BI
 * precisam dizer "bom", "atenção" e "ruim" com a MESMA cor. Cor só funciona
 * quando significa a mesma coisa em toda tela — a regra está escrita em
 * `Uaus.Docs/dominio/convencoes-de-interface.md`, e o significado de cada matiz
 * já tem dono no sistema inteiro:
 *
 * - verde (`emerald`) = positivo, dentro da meta
 * - âmbar (`amber`) = atenção, parcial
 * - vermelho (`destructive`) = negativo, bloqueado
 * - cinza (`muted`) = indisponível, sem ação possível
 *
 * O `neutro` não é uma quinta cor: é a ausência de cor, para o estado do meio de
 * uma escala de três. Colorir os três gastaria o contraste que faz os extremos
 * saltarem, que é a única coisa que se quer enxergar de relance num ranking de
 * cem linhas.
 *
 * **Cor nunca sozinha.** Toda pílula desta paleta sai acompanhada de ícone ou
 * texto: quem não distingue verde de âmbar fica sem a informação, e numa
 * impressão em preto e branco ela some para todo mundo — e estas são telas que
 * se imprimem para levar ao balcão.
 */

export type BiTone = "bom" | "atencao" | "ruim" | "neutro" | "mudo";

/** Pílula: borda, fundo e texto. Para badges e ícones em caixa. */
export const BI_TONE_PILL: Record<BiTone, string> = {
  bom: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  atencao: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ruim: "border-destructive/30 bg-destructive/10 text-destructive",
  neutro: "border-border/60 bg-muted/40 text-foreground/70",
  mudo: "border-border/50 bg-muted/30 text-muted-foreground",
};

/** Só o texto, para números dentro de célula de tabela. */
export const BI_TONE_TEXT: Record<BiTone, string> = {
  bom: "text-emerald-600 dark:text-emerald-400",
  atencao: "text-amber-600 dark:text-amber-400",
  ruim: "text-destructive",
  neutro: "text-foreground/80",
  mudo: "text-muted-foreground",
};

/** Preenchimento sólido, para barras e medidores. */
export const BI_TONE_FILL: Record<BiTone, string> = {
  bom: "bg-emerald-500",
  atencao: "bg-amber-500",
  ruim: "bg-destructive",
  neutro: "bg-foreground/40",
  mudo: "bg-muted-foreground/40",
};
