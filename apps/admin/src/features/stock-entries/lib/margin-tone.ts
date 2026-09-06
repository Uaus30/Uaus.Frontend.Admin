import type { MarginBand } from "@workspace/core";

/**
 * Cor de cada faixa de margem, em classe do Tailwind.
 *
 * A FAIXA é regra de negócio e mora no `packages/core` (`marginBand`): verde a
 * partir de 40%, amarelo de 30% a 40%, vermelho abaixo disso. Aqui fica só a
 * tradução para cor, que é assunto de tela — e ela mora num arquivo só para a
 * prévia da entrada, o recebimento de compra e o histórico de entradas
 * pintarem a mesma margem da mesma cor.
 *
 * Sem margem (produto sem preço) o texto fica apagado, e não verde: "—" em
 * verde sugere um preço saudável que não existe.
 */
const TONES: Record<MarginBand, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  tight: "text-amber-600 dark:text-amber-400",
  low: "text-red-600 dark:text-red-400",
};

export function marginToneClass(band: MarginBand | null): string {
  return band === null ? "text-muted-foreground" : TONES[band];
}
