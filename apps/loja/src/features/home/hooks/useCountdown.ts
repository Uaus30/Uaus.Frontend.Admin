import { useCallback, useEffect, useState } from "react";

/**
 * A contagem regressiva do banner da relâmpago, em segundos.
 *
 * ## Duração do servidor, âncora do cliente
 *
 * O ponto de partida vem do SERVIDOR (`endsInSeconds`), e não de uma data
 * comparada com o relógio do visitante: celular com a hora errada é comum, e
 * uma contagem calculada a partir de um instante absoluto mostraria "faltam 9
 * horas" para quem tem o fuso trocado.
 *
 * Mas o que passou desde a leitura é medido com `Date.now()`, e isso **não**
 * reintroduz o problema: um INTERVALO entre dois instantes do mesmo relógio é
 * correto ainda que o relógio esteja errado. Sem ele, duas coisas quebravam:
 *
 * - **A contagem andava para trás.** O cache da vitrine dura 5 minutos: sair da
 *   home, abrir um produto e voltar em quatro minutos remontava o componente
 *   com o MESMO `endsInSeconds` — e o relógio pulava de `03:56:00` de volta
 *   para `04:00:00`. É o padrão de navegação de quem está decidindo comprar.
 * - **A aba aberta a noite inteira.** O site não refaz a consulta ao voltar o
 *   foco (decisão da vitrine: ela não é painel), e o navegador congela o
 *   `setInterval` em segundo plano. Às 20h o topo da home ainda mostraria
 *   "Termina em 01:12:40" para uma relâmpago que acabou às 18h.
 *
 * Devolve `0` quando acabou — e é quem consome que decide o que fazer com isso
 * (o banner some).
 *
 * @param seconds Duração inicial em segundos, ou nulo quando não há contagem.
 * @param anchoredAt Instante em que a duração foi LIDA (o `dataUpdatedAt` da
 *   consulta). É ele que torna a contagem imune a remontagem e a aba congelada.
 */
export function useCountdown(seconds: number | null | undefined, anchoredAt: number): number {
  const total = seconds != null && seconds > 0 ? Math.floor(seconds) : 0;

  const restanteAgora = useCallback(
    () => Math.max(0, total - Math.floor((Date.now() - anchoredAt) / 1000)),
    [total, anchoredAt],
  );

  const [restante, setRestante] = useState(restanteAgora);

  /*
   * Leitura nova do servidor reinicia a contagem — ajuste de estado DURANTE o
   * render, que é o padrão do React para estado derivado e o que o lint cobra.
   */
  const [ancora, setAncora] = useState(`${total}|${anchoredAt}`);
  const atual = `${total}|${anchoredAt}`;
  if (ancora !== atual) {
    setAncora(atual);
    setRestante(restanteAgora());
  }

  useEffect(() => {
    if (total <= 0) return;

    // `setInterval`, e não `requestAnimationFrame`: a contagem é de SEGUNDOS, e
    // rAF gastaria sessenta quadros por segundo para redesenhar a mesma coisa —
    // no celular da cliente, no 4G da cidade. Cada tique RECALCULA a partir da
    // âncora em vez de subtrair um, e é isso que faz a aba que ficou congelada
    // acordar com o número certo.
    const id = setInterval(() => setRestante(restanteAgora()), 1000);
    return () => clearInterval(id);
  }, [total, restanteAgora]);

  return restante;
}

/** `02:45:09` — horas sempre presentes, porque a relâmpago dura horas. */
export function formatCountdown(totalSeconds: number): string {
  const seguro = Math.max(0, Math.floor(totalSeconds));
  const horas = Math.floor(seguro / 3600);
  const minutos = Math.floor((seguro % 3600) / 60);
  const segundos = seguro % 60;
  const dois = (valor: number) => String(valor).padStart(2, "0");

  return `${dois(horas)}:${dois(minutos)}:${dois(segundos)}`;
}
