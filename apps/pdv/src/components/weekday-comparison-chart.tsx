import { accumulateWeekComparison, formatCurrency, type WeekComparisonPoint } from "@workspace/core";
import type { WeekdayComparisonDto } from "@workspace/api-client-react";
import { weekComparisonScale, weekdayLabel } from "@/lib/performance";

/**
 * Semana atual sobre a anterior, pela curva acumulada dia a dia — o mesmo
 * formato dos comparativos do painel administrativo. A conta é a MESMA
 * (`accumulateWeekComparison`, do `@workspace/core`), então o caixa e o painel
 * mostram a mesma curva porque somam igual, não porque foram escritos iguais.
 *
 * Desenhado com SVG e CSS em vez de recharts: o PDV não tem essa dependência, e
 * puxá-la para o bundle do caixa — que hoje é um arquivo único de ~900 KB e é
 * baixado inteiro a cada deploy pelo service worker — por causa de duas linhas
 * seria caro pelo que entrega.
 *
 * A linha da semana atual para no dia de hoje, com um ponto marcando onde ela
 * está; a da semana anterior segue até o domingo como referência. A leitura de
 * cada dia continua nos `title` nativos, numa coluna invisível por dia — o
 * mesmo papel que os `title` das barras cumpriam antes.
 */
export interface WeekdayComparisonChartProps {
  days: WeekdayComparisonDto[];
}

/** Texto do `title` nativo de um dia — a única "tooltip" que o gráfico tem. */
function tituloDoDia(ponto: WeekComparisonPoint): string {
  const rotulo = weekdayLabel(ponto.weekday);
  const anterior = `semana anterior: ${formatCurrency(ponto.previous)}`;

  return ponto.current == null
    ? `${rotulo} ainda não chegou · ${anterior}`
    : `${rotulo} — acumulado: ${formatCurrency(ponto.current)} · ${anterior}`;
}

export function WeekdayComparisonChart({ days }: WeekdayComparisonChartProps) {
  const pontos = accumulateWeekComparison(days);
  const escala = weekComparisonScale(pontos);

  // Altura de um valor em % do container, com 2% de folga em cada borda para a
  // linha não encostar no teto nem no chão do quadro.
  const altura = (valor: number) => (valor / escala) * 96 + 2;

  // Centro da coluna do dia i, em % — o mesmo centro das colunas `flex-1` dos
  // rótulos logo abaixo, para ponto, linha e rótulo ficarem alinhados.
  const centro = (indice: number) => ((indice + 0.5) / pontos.length) * 100;

  const paraCoordenadas = (valores: Array<{ indice: number; valor: number }>) =>
    valores.map(({ indice, valor }) => `${centro(indice)},${100 - altura(valor)}`).join(" ");

  const linhaAnterior = paraCoordenadas(pontos.map((p, i) => ({ indice: i, valor: p.previous })));

  const pontosAtuais = pontos
    .map((p, i) => ({ indice: i, valor: p.current }))
    .filter((p): p is { indice: number; valor: number } => p.valor != null);
  const linhaAtual = paraCoordenadas(pontosAtuais);

  // Último dia que já aconteceu — o "onde estamos" da semana.
  const hoje = pontosAtuais.at(-1) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          Semana atual x anterior
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-primary" aria-hidden="true" />
            Atual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
            Anterior
          </span>
        </div>
      </div>

      <div className="relative h-32">
        {/* preserveAspectRatio="none" estica o viewBox 100×100 para o container:
            as coordenadas viram percentuais. O vector-effect mantém o traço com
            espessura fixa mesmo com a distorção. */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {pontos.length > 1 && (
            <polyline
              points={linhaAnterior}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="text-muted-foreground/40"
            />
          )}
          {pontosAtuais.length > 1 && (
            <polyline
              points={linhaAtual}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="text-primary"
            />
          )}
        </svg>

        {/* O ponto de hoje fica FORA do SVG: com preserveAspectRatio="none" um
            <circle> viraria elipse. Também é o que desenha a semana na manhã de
            segunda, quando a linha ainda tem um ponto só. */}
        {hoje && (
          <span
            className="absolute h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${centro(hoje.indice)}%`, bottom: `${altura(hoje.valor)}%` }}
            aria-hidden="true"
          />
        )}

        <div className="absolute inset-0 flex">
          {pontos.map((ponto) => (
            <div key={ponto.weekday} className="flex-1" title={tituloDoDia(ponto)} />
          ))}
        </div>
      </div>

      <div className="flex">
        {pontos.map((ponto) => (
          <span
            key={ponto.weekday}
            className={`flex-1 text-center text-[10px] font-mono ${
              ponto.current == null ? "text-muted-foreground/40" : "text-muted-foreground"
            }`}
          >
            {weekdayLabel(ponto.weekday)}
          </span>
        ))}
      </div>
    </div>
  );
}
