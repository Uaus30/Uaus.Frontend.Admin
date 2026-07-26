import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

/**
 * Peças compartilhadas por todos os gráficos do painel.
 *
 * Existe para que as especificações visuais — espessura das marcas, opacidade do
 * preenchimento, recuo dos eixos, formato do tooltip — sejam decididas uma vez.
 * Quando cada gráfico carrega sua própria cópia, elas divergem no primeiro ajuste
 * e o painel deixa de parecer uma coisa só.
 */

/**
 * Paleta categórica, na ordem fixa em que as séries são atribuídas.
 *
 * A ordem é o mecanismo de legibilidade: os passos foram escolhidos para que
 * vizinhos na sequência continuem distinguíveis sob daltonismo. Atribua sempre em
 * ordem, nunca ciclando — a sexta série não ganha uma cor nova, ela vira "Outros".
 */
export const SERIES_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/** Cor da superfície em que as marcas são desenhadas (fundo do card). */
export const SURFACE_COLOR = "hsl(var(--card))";

/** Cinza de recuo usado em grades, eixos e séries de contexto. */
export const MUTED_COLOR = "hsl(var(--muted-foreground))";

/** Espessura máxima das barras: a sobra da faixa é o respiro do gráfico. */
export const MAX_BAR_SIZE = 24;

/** Propriedades comuns dos eixos — texto discreto, sem linha nem tique. */
export const AXIS_PROPS = {
  stroke: MUTED_COLOR,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Grade horizontal fina e sólida; tracejado compete com as marcas. */
export const GRID_PROPS = {
  strokeDasharray: "",
  vertical: false,
  stroke: "hsl(var(--border))",
  strokeWidth: 1,
} as const;

type TooltipRow = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  /** Converte o rótulo do eixo em título do tooltip. */
  labelFormatter?: (label: string) => string;
  /** Converte cada valor; o padrão é moeda. */
  valueFormatter?: (value: number, row: TooltipRow) => string;
};

/**
 * Tooltip padrão do painel.
 *
 * O componente do Recharts é substituído porque o dele coloca o texto na cor da
 * série — e as cores das marcas, escolhidas para contrastar com a superfície como
 * bloco, ficam ilegíveis como texto. Aqui a identidade vem do ponto colorido ao
 * lado, e o texto usa os tokens de tipografia.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const format = valueFormatter ?? ((value: number) => formatCurrency(value));

  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      {label !== undefined && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((row, index) => (
          <div key={`${row.dataKey}-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {typeof row.value === "number" ? format(row.value, row) : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ChartCardProps = {
  title: string;
  /** Uma linha explicando o que o gráfico responde. */
  description?: string;
  /** Controles do canto superior direito (seletores, botões). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** Moldura comum dos painéis: título, subtítulo, ação e conteúdo. */
export function ChartCard({ title, description, action, className, children }: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col gap-5 border-border/60 p-5 shadow-lg shadow-black/10", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/**
 * Legenda das séries.
 *
 * Fica sempre presente a partir de duas séries: cor sozinha não é canal de
 * identidade confiável. Uma série só dispensa a legenda — o título já diz o que
 * está plotado.
 */
export function SeriesLegend({ items }: { items: Array<{ name: string; color: string }> }) {
  if (items.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-xs text-muted-foreground">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Estado vazio dos gráficos, no lugar de uma moldura sem nada dentro. */
export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border/60">
      <p className="max-w-xs text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
