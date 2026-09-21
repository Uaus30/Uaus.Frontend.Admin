import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ComparisonWindowDto, RevenueFactorDto } from "@workspace/api-client-react";
import { BI_TONE_PILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { formatSignedPercent } from "@/features/dashboard/utils";
import { formatInteger } from "@/features/supplier-performance/lib/format";
import { deltaTone, describeRange, FACTOR_LABELS, FACTOR_MEANING } from "../lib/comparison";

type ComparisonHeadlineProps = {
  previous: ComparisonWindowDto;
  current: ComparisonWindowDto;
  leadingFactor: RevenueFactorDto | null;
};

/**
 * A primeira coisa da tela: a diferença em reais e, embaixo, a causa que mais
 * pesou — em uma frase, antes de qualquer gráfico.
 *
 * A frase existe porque a ponte é um gráfico, e gráfico se lê depois de decidir
 * que vale a pena olhar. O número sozinho ("caiu R$ 2.822") é o que o painel já
 * dava; o que muda a conversa é "caiu porque cada peça passou a valer R$ 3,88 a
 * menos".
 */
export function ComparisonHeadline({ previous, current, leadingFactor }: ComparisonHeadlineProps) {
  const delta = current.revenue - previous.revenue;
  const tone = deltaTone(delta);
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;
  const variacao =
    previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : null;

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Diferença de faturamento
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className={cn("text-[34px] font-semibold leading-none", BI_TONE_TEXT[tone])}>
              {delta > 0 ? "+" : ""}
              {formatCurrency(delta)}
            </span>
            {variacao !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  BI_TONE_PILL[tone],
                )}
              >
                <Icon className="h-3 w-3" />
                {formatSignedPercent(variacao)}
              </span>
            )}
          </div>

          {leadingFactor && (
            <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-foreground/80">
              O que mais pesou foi{" "}
              {/* O `??` acompanha as guardas de `MixPricePanel` e `ComparisonHelp`:
                  um valor novo no enum do backend chega aqui como `undefined` e
                  estoura em `.toLowerCase()`. O `ErrorBoundary` da rota
                  (`App.tsx`) pega e mostra a tela de recuperação — não é tela
                  branca —, mas trocar a tela inteira por um campo a mais no
                  contrato é caro demais para o preço de um `??`. */}
              <strong className="font-semibold">
                {(FACTOR_LABELS[leadingFactor.factor] ?? "").toLowerCase()}
              </strong>{" "}
              — {FACTOR_MEANING[leadingFactor.factor] ?? ""} — respondendo por{" "}
              <strong className={cn("font-semibold", BI_TONE_TEXT[deltaTone(leadingFactor.amount)])}>
                {leadingFactor.amount > 0 ? "+" : ""}
                {formatCurrency(leadingFactor.amount)}
              </strong>{" "}
              da diferença.
            </p>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-x-7 gap-y-1 text-right">
          <Lado titulo="Antes" janela={previous} />
          <Lado titulo="Depois" janela={current} />
        </div>
      </div>
    </Card>
  );
}

/** Um dos dois lados, com o que a ponte reparte logo abaixo. */
function Lado({ titulo, janela }: { titulo: string; janela: ComparisonWindowDto }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-lg font-semibold leading-none">{formatCurrency(janela.revenue)}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        {describeRange(janela.startDate, janela.endDate)}
      </p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        {formatInteger(janela.openDays)} dias · {formatInteger(janela.sales)} cupons ·{" "}
        {formatInteger(janela.units)} peças
      </p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        {formatCurrency(janela.revenuePerUnit)} por peça · lucro {formatCurrency(janela.profit)}
      </p>
    </div>
  );
}
