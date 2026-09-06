type SupplierSparklineProps = {
  /** Faturamento de cada dia do período, do mais antigo ao mais recente. */
  series: number[];
  color: string;
  height?: number;
  /** Descrição para leitor de tela — o gráfico sozinho não diz nada a ele. */
  label: string;
};

/**
 * Minigráfico do ritmo do fornecedor no período.
 *
 * SVG na mão pelo mesmo motivo do anel da nota: são dezenas por tela. E a série
 * chega do servidor com os dias sem venda em ZERO, não omitidos — uma linha que
 * pula os buracos desenha um fornecedor constante que não existe.
 */
export function SupplierSparkline({ series, color, height = 30, label }: SupplierSparklineProps) {
  if (series.length < 2) return null;

  const largura = 240;
  const maximo = Math.max(...series, 1);
  const pontos = series
    .map((valor, indice) => {
      const x = (indice / (series.length - 1)) * largura;
      const y = height - (valor / maximo) * (height - 3);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${largura} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <polyline
        points={pontos}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}
