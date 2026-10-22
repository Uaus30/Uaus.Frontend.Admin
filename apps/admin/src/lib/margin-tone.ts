import type { MarginBand } from "@workspace/core";

/**
 * Cor de cada faixa de margem, em classe do Tailwind — a MESMA em toda tela que
 * mostra margem: entrada de estoque, compras e recebimento, cadastro de produto,
 * promoções, a curva ABC e o ranking de desempenho.
 *
 * A FAIXA é regra de negócio e mora no `packages/core` (`marginBand`). Aqui fica
 * só a tradução para cor, que é assunto de tela. Quatro degraus desde 22/10/2026
 * (pedido do dono): vermelho abaixo de 20%, laranja de 20% a 30%, amarelo-limão de
 * 30% a 40% e verde a partir de 40%. Até ali eram três, e cada tela tinha a sua
 * cópia deste mapa — a curva ABC e o ranking pintavam o "baixo" com
 * `text-destructive`, a promoção também, e a listagem de compras sem o tom do
 * tema escuro. Uma cópia por tela é o que faz uma delas ficar para trás quando a
 * régua muda.
 *
 * O amarelo é o `lime`, e não o `yellow`: amarelo puro em texto sobre fundo
 * claro some, e o limão fica entre o laranja e o verde, que é onde a faixa está.
 *
 * Sem margem (produto sem preço) o texto fica apagado, e não verde: "—" em verde
 * sugere um preço saudável que não existe.
 */
const TONES: Record<MarginBand, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  tight: "text-lime-600 dark:text-lime-400",
  thin: "text-orange-600 dark:text-orange-400",
  low: "text-red-600 dark:text-red-400",
};

export function marginToneClass(band: MarginBand | null): string {
  return band === null ? "text-muted-foreground" : TONES[band];
}
