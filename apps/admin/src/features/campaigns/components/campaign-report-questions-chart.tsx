import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@workspace/ui";
import { formatCurrency, formatPercentage } from "@workspace/core";
import type { CampaignReportQuestionDto, CampaignReportQuestionOptionDto } from "@workspace/api-client-react";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  GRID_PROPS,
  MAX_BAR_SIZE,
  SERIES_COLORS,
} from "@/features/dashboard/components/chart-primitives";

type CampaignReportQuestionsChartProps = {
  questions: CampaignReportQuestionDto[];
  isLoading: boolean;
};

/** Altura de cada faixa de opção; oito opções cabem sem apertar. */
const ROW_HEIGHT = 34;

/**
 * Tooltip da distribuição.
 *
 * Mostra o ticket médio junto da contagem porque as duas leituras discordam com
 * frequência: a alternativa mais escolhida costuma não ser a que traz o carrinho
 * maior, e é essa diferença que decide onde a próxima campanha investe.
 */
function OptionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CampaignReportQuestionOptionDto }>;
}) {
  if (!active || !payload?.length) return null;
  const option = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-medium text-muted-foreground">{option.label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {option.count} resposta(s)
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {formatPercentage(option.percentage)}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(option.revenue)} faturados</p>
      <p className="text-xs text-muted-foreground">Ticket médio de {formatCurrency(option.averageTicket)}</p>
    </div>
  );
}

/**
 * Distribuição de UMA pergunta, em barras horizontais.
 *
 * Barras e não pizza: os rótulos das alternativas são texto livre do editor de
 * questionário e costumam ser longos ("Instagram", "Indicação de amigo"), o que
 * numa pizza vira legenda e obriga o leitor a ir e voltar entre a cor e o texto.
 * Comparar comprimentos também é mais fácil que comparar ângulos.
 *
 * Todas as barras usam o mesmo matiz: a identidade já está no rótulo do eixo, e
 * colorir cada uma gastaria o canal de cor para repetir o que o texto diz.
 */
function QuestionChart({ question }: { question: CampaignReportQuestionDto }) {
  return (
    <ChartCard
      title={question.label}
      description={`${question.answered} resgate(s) responderam esta pergunta`}
    >
      <div className="w-full" style={{ height: question.options.length * ROW_HEIGHT + 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={question.options}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            {/* Barra horizontal pede grade vertical: a linha de referência tem
                que cruzar o comprimento que se está comparando. */}
            <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
            <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
            <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={120} interval={0} />
            <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} content={<OptionTooltip />} />
            <Bar
              dataKey="count"
              name="Respostas"
              fill={SERIES_COLORS[0]}
              maxBarSize={MAX_BAR_SIZE}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/**
 * CampaignReportQuestionsChart
 *
 * Uma distribuição por pergunta do questionário, na ordem em que o balcão
 * perguntou.
 *
 * Só aparecem as alternativas que alguém escolheu — é o que o backend devolve.
 * Trazer as opções sem resposta exigiria ler o catálogo atual da campanha e
 * misturar, na mesma lista, rótulo congelado no resgate com rótulo vivo do
 * cadastro: duas verdades diferentes sobre linhas vizinhas.
 */
export function CampaignReportQuestionsChart({ questions, isLoading }: CampaignReportQuestionsChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[320px] rounded-xl" />;
  }

  if (questions.length === 0) {
    return (
      <ChartCard
        title="Respostas do questionário"
        description="Distribuição das alternativas escolhidas no balcão."
      >
        <ChartEmptyState message="Nenhuma resposta registrada. A campanha pode não ter questionário, ou os cupons dela ainda não foram usados." />
      </ChartCard>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {questions.map((question) => (
        <QuestionChart key={question.questionId} question={question} />
      ))}
    </div>
  );
}
