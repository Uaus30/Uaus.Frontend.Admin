/**
 * A leitura visual da nota do fornecedor.
 *
 * A cor é contínua e SEMPRE acompanha o número e o rótulo. Cor sozinha não
 * comunica nota nenhuma para quem não distingue vermelho de verde — e é
 * justamente o par vermelho/verde que a escala percorre.
 */

/** Paradas da rampa, do pior ao melhor. Interpoladas em RGB entre elas. */
const PARADAS: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
  [0, [239, 68, 68]], // vermelho
  [30, [249, 115, 22]], // laranja
  [55, [234, 179, 8]], // âmbar
  [78, [34, 197, 94]], // verde
  [100, [16, 185, 129]], // esmeralda
];

/** Cinza da nota zero: quem não vendeu não tem desempenho a colorir. */
export const COR_SEM_NOTA = "hsl(215 20% 45%)";

/**
 * Cor da nota, contínua de 0 a 100.
 *
 * Todas as paradas foram conferidas contra a superfície do card do admin
 * (`--card`, 222 47% 10%): a pior delas, o vermelho, fica em 4,84:1 — acima do
 * mínimo de 4,5:1 para texto normal.
 */
export function corDaNota(nota: number): string {
  if (nota <= 0) return COR_SEM_NOTA;

  const valor = Math.max(0, Math.min(100, nota));

  for (let i = 1; i < PARADAS.length; i++) {
    const [inicio, corInicio] = PARADAS[i - 1];
    const [fim, corFim] = PARADAS[i];
    if (valor > fim) continue;

    const t = (valor - inicio) / (fim - inicio);
    const [r, g, b] = corInicio.map((canal, k) => Math.round(canal + (corFim[k] - canal) * t));
    return `rgb(${r},${g},${b})`;
  }

  return `rgb(${PARADAS[PARADAS.length - 1][1].join(",")})`;
}

/** Rótulo da faixa. É o canal que não depende de enxergar cor. */
export function rotuloDaNota(nota: number): string {
  if (nota <= 0) return "Sem venda";
  if (nota >= 80) return "Excelente";
  if (nota >= 65) return "Bom";
  if (nota >= 50) return "Regular";
  if (nota >= 35) return "Atenção";
  return "Crítico";
}
