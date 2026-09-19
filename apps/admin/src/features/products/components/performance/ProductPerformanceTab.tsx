import { Card, ScoreGauge, Spinner, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { useGetProductPerformanceProfile } from "@workspace/api-client-react";
import type {
  ProductPerformanceParametersDto,
  ProductPerformancePointDto,
} from "@workspace/api-client-react";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import {
  ACTION_INFO,
  CLASS_INFO,
  coberturaLegivel,
  formatScore,
} from "@/features/product-performance/lib/performance";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { ScoreHistoryChart } from "./ScoreHistoryChart";

type ProductPerformanceTabProps = {
  /** A VARIAÇÃO, e não o grupo: é ela que tem estoque, preço e nota. */
  productId: number;
};

/** Janela do histórico. Noventa dias é a mesma escala da apuração. */
const JANELA = 90;

/**
 * Aba Desempenho da tela do produto.
 *
 * <b>Duas perguntas, nesta ordem.</b> O velocímetro responde "como este produto
 * está hoje", e é o que a pessoa veio ver. O gráfico responde <b>"o que eu fiz
 * funcionou"</b> — e essa é a pergunta que nenhuma outra tela do sistema
 * respondia: até existir a apuração diária, tomar a decisão e medir o efeito
 * eram coisas separadas por um vazio.
 *
 * A aba lê a apuração guardada, e não recalcula nada: por isso abre instantânea.
 * A nota depende das réguas da LOJA inteira (giro, margem, lucro médio, custo de
 * prateleira, cobertura), e calculá-la aqui custaria varrer o catálogo a cada
 * produto aberto.
 */
export function ProductPerformanceTab({ productId }: ProductPerformanceTabProps) {
  const { data, isLoading, isError } = useGetProductPerformanceProfile(productId, JANELA);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/60 p-8 text-center text-sm text-muted-foreground">
        Não foi possível carregar o desempenho deste produto.
      </Card>
    );
  }

  const atual = data?.current;
  const parametros = data?.parameters;

  // Nota zero seria um juízo que ninguém fez. Produto que entrou hoje, ou loja em
  // que a apuração ainda não rodou, merecem a frase e não o velocímetro.
  if (!atual || !parametros) {
    return (
      <Card className="border-border/60 p-8 text-center">
        <p className="text-sm font-medium">Este produto ainda não foi apurado.</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          O desempenho é apurado uma vez por dia, às 19h, depois que a loja fecha — apurar de manhã mediria o
          dia pela metade. A partir da primeira apuração, esta aba passa a mostrar a nota e a evolução dela.
        </p>
      </Card>
    );
  }

  const classe = CLASS_INFO[atual.class];
  const acao = ACTION_INFO[atual.action];

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/60 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="flex flex-col items-center">
            {/* A palavra da faixa vai DENTRO do arco, como no Prisma: o número
                sozinho obriga a lembrar onde ficam os cortes. */}
            <ScoreGauge score={atual.score} rotulo={classe.rotulo} />
            <span className="-mt-2 text-[12.5px] text-muted-foreground">
              {atual.rank > 0
                ? `${formatInteger(atual.rank)}º de ${formatInteger(atual.analysedProducts)}`
                : "ainda não julgado"}
            </span>
          </div>

          <div className="flex min-w-[240px] flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold",
                  BI_TONE_PILL[acao.tom],
                )}
              >
                <acao.icone className="h-3.5 w-3.5" />
                {acao.rotulo}
              </span>
            </div>

            {/* A faixa já está escrita dentro do arco; aqui fica o que ela
                significa, e depois a decisão que o produto está pedindo. */}
            <p className="text-[13px] leading-relaxed text-muted-foreground">{classe.explicacao}</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{acao.explicacao}</p>

            <Parciais ponto={atual} parameters={parametros} />
          </div>
        </div>
      </Card>

      <Card className="border-border/60 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[14.5px] font-semibold">Evolução da nota</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              é aqui que se vê se o que você fez com este produto funcionou
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.history.length === 1
              ? "1 apuração até agora"
              : `${formatInteger(data.history.length)} apurações`}
          </span>
        </div>

        {data.history.length < 2 ? (
          <p className="py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
            A série começa na primeira apuração e ganha um ponto por dia. Com dois dias já dá para ver
            movimento.
          </p>
        ) : (
          <div className="mt-4">
            <ScoreHistoryChart
              history={data.history}
              standoutScore={parametros.standoutScore}
              steadyScore={parametros.steadyScore}
            />
          </div>
        )}
      </Card>

      <Card className="border-border/60 p-5">
        <h3 className="text-[14.5px] font-semibold">Os números da última apuração</h3>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <Numero rotulo="Vendidos" valor={formatInteger(atual.units)} />
          <Numero rotulo="Faturamento" valor={formatCurrency(atual.revenue)} />
          <Numero rotulo="Lucro" valor={formatCurrency(atual.profit)} />
          <Numero
            rotulo="Margem"
            valor={atual.units > 0 ? formatPercent(atual.margin) : "—"}
            dica={`Margem da loja no período: ${formatPercent(parametros.storeMargin)}`}
          />
          <Numero
            rotulo="Giro"
            valor={formatPercent(atual.sellThrough, 0)}
            dica={`A loja escoou ${formatPercent(parametros.storeSellThrough)}`}
          />
          <Numero
            rotulo="Estoque"
            valor={`${formatInteger(atual.stock)} un`}
            dica={formatCurrency(atual.stockCost)}
          />
          <Numero rotulo="Dura" valor={coberturaLegivel(atual.coverageDays, atual.stock)} />
          <Numero
            rotulo="Em risco"
            valor={formatCurrency(atual.capitalAtRisk)}
            dica="Custo na prateleira ponderado pela parte de venda da nota, mais o prejuízo já realizado"
          />
        </div>
      </Card>
    </div>
  );
}

/**
 * As seis parciais em barras.
 *
 * É o que separa "a nota caiu" de "a nota caiu POR QUÊ": num produto parado as
 * quatro de venda ficam zeradas e fica visível que quem o posicionou foram
 * capital e liquidez — e aí a ação é de estoque, não de preço.
 */
function Parciais({
  ponto,
  parameters,
}: {
  ponto: ProductPerformancePointDto;
  parameters: ProductPerformanceParametersDto;
}) {
  const linhas: [string, number, number][] = [
    ["Giro", ponto.scoreBreakdown.turnover, parameters.turnoverWeight],
    ["Margem", ponto.scoreBreakdown.margin, parameters.marginWeight],
    ["Resultado", ponto.scoreBreakdown.result, parameters.resultWeight],
    ["Constância", ponto.scoreBreakdown.consistency, parameters.consistencyWeight],
    ["Capital", ponto.scoreBreakdown.capital, parameters.capitalWeight],
    ["Liquidez", ponto.scoreBreakdown.liquidity, parameters.liquidityWeight],
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {linhas.map(([nome, valor, peso]) => (
        <div key={nome} className="flex items-center gap-2 text-[11.5px]">
          <span className="w-20 shrink-0 text-muted-foreground">{nome}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(1, Math.min(100, valor))}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right font-mono tabular-nums">{formatScore(valor)}</span>
          <span className="w-8 shrink-0 text-right text-muted-foreground">{Math.round(peso * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function Numero({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div title={dica}>
      <span className="block text-[10.5px] uppercase tracking-wider text-muted-foreground">{rotulo}</span>
      <span className="block font-mono text-[14px] tabular-nums">{valor}</span>
    </div>
  );
}
