import { Card } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { SupplierPerformanceDto, SupplierPerformanceParametersDto } from "@workspace/api-client-react";
import { formatPercent } from "../lib/format";
import { corDaNota } from "../lib/score";

type SupplierScoreBreakdownProps = {
  supplier: SupplierPerformanceDto;
  parameters: SupplierPerformanceParametersDto;
};

/**
 * De onde saiu a nota, componente por componente.
 *
 * Cada linha traz o VALOR REAL, a régua e a nota que aquele valor gerou. É o
 * conserto de um defeito de leitura da primeira versão: a listagem mostrava
 * "margem 58" ao lado de "42,2%", duas coisas com o mesmo nome e valores
 * diferentes, sem nada explicando a distância entre elas. Aqui há espaço para
 * dizer a frase inteira — "42,2% de margem, 101% da média da loja, nota 100".
 */
export function SupplierScoreBreakdown({ supplier, parameters }: SupplierScoreBreakdownProps) {
  const componentes = [
    {
      chave: "aproveitamento",
      nome: "Aproveitamento do mix",
      peso: parameters.hitRateWeight,
      nota: supplier.scoreBreakdown.hitRate,
      real: `${formatPercent(supplier.hitRate, 0)} dos produtos`,
      regua: `${supplier.goodProducts} de ${supplier.judgedProducts} vendem com margem ≥ ${formatPercent(parameters.goodMarginThreshold, 0)} · a loja gira ${formatPercent(parameters.storeHitRate, 0)}`,
    },
    {
      chave: "margem",
      nome: "Margem média",
      peso: parameters.marginWeight,
      nota: supplier.scoreBreakdown.margin,
      real: formatPercent(supplier.margin),
      regua: `${formatPercent(supplier.scoreBreakdown.margin, 0)} da média da loja, que é ${formatPercent(parameters.storeMargin)}`,
    },
    {
      chave: "giro",
      nome: "Giro do estoque",
      peso: parameters.turnoverWeight,
      nota: supplier.scoreBreakdown.turnover,
      real: formatPercent(supplier.turnover),
      regua: `do estoque saiu no período · alvo ${formatPercent(parameters.turnoverTarget, 0)}`,
    },
    {
      chave: "resultado",
      nome: "Resultado gerado",
      peso: parameters.resultWeight,
      nota: supplier.scoreBreakdown.result,
      real: formatCurrency(supplier.profit),
      regua: `${formatPercent(supplier.scoreBreakdown.result, 0)} do lucro médio por fornecedor, que é ${formatCurrency(parameters.averageProfitPerSupplier)}`,
    },
  ];

  return (
    <Card className="border-border/60 p-5">
      <h2 className="text-[14.5px] font-semibold">Por que a nota é {supplier.score}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada componente com o valor real, a régua da loja e a nota que ele gerou
      </p>

      <div className="mt-3">
        {componentes.map((componente) => (
          <div
            key={componente.chave}
            className="grid grid-cols-[minmax(120px,168px)_1fr_minmax(110px,150px)_44px] items-center gap-3 border-b border-border/40 py-2.5 last:border-b-0"
          >
            <div>
              <p className="text-[13px] font-semibold leading-tight">{componente.nome}</p>
              <p className="text-[10.5px] text-muted-foreground">
                peso {formatPercent(componente.peso * 100, 0)}
              </p>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${componente.nota}%`, backgroundColor: corDaNota(componente.nota) }}
              />
            </div>

            <div className="text-right">
              <p className="text-xs text-foreground/80">{componente.real}</p>
              <p className="text-[10.5px] leading-tight text-muted-foreground">{componente.regua}</p>
            </div>

            <p
              className="text-right font-mono text-base font-semibold"
              style={{ color: corDaNota(componente.nota) }}
            >
              {Math.round(componente.nota)}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        Nota final <strong style={{ color: corDaNota(supplier.score) }}>{supplier.score}</strong> ={" "}
        {componentes.map((c) => `${Math.round(c.nota)}×${formatPercent(c.peso * 100, 0)}`).join(" + ")}
      </p>
    </Card>
  );
}
