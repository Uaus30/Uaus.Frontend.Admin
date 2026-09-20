import { useEffect, useState } from "react";

/**
 * A contagem regressiva do banner da relâmpago, em segundos.
 *
 * O ponto de partida vem do SERVIDOR (`endsInSeconds`), e não de uma data
 * comparada com o relógio do visitante: celular com a hora errada é comum, e
 * uma contagem calculada no cliente mostraria "faltam 9 horas" para quem tem o
 * fuso trocado. O que o servidor manda é uma DURAÇÃO, que não depende de relógio
 * nenhum.
 *
 * Devolve `0` quando acabou — e é quem consome que decide o que fazer com isso
 * (o banner some).
 *
 * @param seconds Duração inicial em segundos, ou nulo quando não há contagem.
 */
export function useCountdown(seconds?: number | null): number {
  const inicial = seconds != null && seconds > 0 ? Math.floor(seconds) : 0;
  const [restante, setRestante] = useState(inicial);

  /*
   * O valor do servidor reinicia a contagem — ajuste de estado DURANTE o render,
   * que é o padrão do React para estado derivado e o que o lint cobra. Sem ele,
   * uma reconsulta em segundo plano (voltar o foco à aba) traria segundos novos
   * que o estado ignoraria.
   */
  const [ancora, setAncora] = useState(inicial);
  if (ancora !== inicial) {
    setAncora(inicial);
    setRestante(inicial);
  }

  useEffect(() => {
    if (inicial <= 0) return;

    // `setInterval`, e não `requestAnimationFrame`: a contagem é de SEGUNDOS, e
    // rAF gastaria sessenta quadros por segundo para redesenhar a mesma coisa —
    // no celular da cliente, no 4G da cidade.
    const id = setInterval(() => setRestante((atual) => Math.max(0, atual - 1)), 1000);
    return () => clearInterval(id);
  }, [inicial]);

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
