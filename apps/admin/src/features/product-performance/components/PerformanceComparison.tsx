import { ArrowRight, Flame, Sparkles } from "lucide-react";
import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProductGroupSummaryDto, ProductPerformanceComparisonDto } from "@workspace/api-client-react";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";

type PerformanceComparisonProps = {
  comparison: ProductPerformanceComparisonDto;
  /** Quantos produtos cabem em cada ranking — o "100" dos títulos. */
  size: number;
};

/**
 * O confronto entre os dois extremos — a leitura que dá sentido às duas tabelas.
 *
 * Cada lado é medido pelas MESMAS duas fatias: quanto do capital em estoque ele
 * imobiliza e quanto do lucro do período ele devolve. É a comparação que a loja
 * não consegue fazer produto a produto, e ela costuma ser desconfortável — em
 * 07/09/2026, os cem melhores ocupavam 24% do capital e faziam 64% do lucro,
 * enquanto os cem piores ocupavam 31% e devolviam 4%.
 *
 * As barras dividem a MESMA escala (0 a 100% do total da loja), e é isso que
 * permite compará-las de relance. Duas escalas independentes fariam o desenho
 * mentir: a barra de lucro dos piores encheria a linha inteira por ser "o maior
 * valor daquele grupo".
 */
export function PerformanceComparison({ comparison, size }: PerformanceComparisonProps) {
  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[14.5px] font-semibold">Os dois extremos, lado a lado</h2>
        <p className="text-xs text-muted-foreground">
          quanto capital cada grupo prende e quanto lucro devolve, sobre o total do período
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Lado
          titulo={`${size} melhores`}
          icone={Sparkles}
          tom="bom"
          grupo={comparison.best}
          leitura={leituraDoLado(comparison.best, "melhores")}
        />
        <Lado
          titulo={`${size} piores`}
          icone={Flame}
          tom="ruim"
          grupo={comparison.worst}
          leitura={leituraDoLado(comparison.worst, "piores")}
        />
      </div>
    </Card>
  );
}

/**
 * A frase que traduz as duas fatias.
 *
 * Ela existe porque a comparação só vira decisão quando alguém diz em voz alta o
 * que os dois percentuais significam juntos — "muito lucro com pouco capital" e
 * "muito capital com pouco lucro" são a mesma tabela lida de dois jeitos, e o
 * segundo é o que manda queimar estoque.
 */
function leituraDoLado(grupo: ProductGroupSummaryDto, lado: "melhores" | "piores"): string {
  if (grupo.products === 0) {
    return lado === "melhores"
      ? "Nenhum produto vendeu no período."
      : "Nenhum produto com capital em risco — a prateleira está limpa.";
  }

  const capital = formatPercent(grupo.stockCostShare, 0);
  const lucro = formatPercent(grupo.profitShare, 0);

  return lado === "melhores"
    ? `Ocupam ${capital} do capital em estoque e devolvem ${lucro} do lucro. É o dinheiro que está no lugar certo — não pode faltar.`
    : `Ocupam ${capital} do capital em estoque e devolvem ${lucro} do lucro. É o dinheiro que precisa virar caixa.`;
}

type LadoProps = {
  titulo: string;
  icone: typeof Sparkles;
  tom: "bom" | "ruim";
  grupo: ProductGroupSummaryDto;
  leitura: string;
};

function Lado({ titulo, icone: Icone, tom, grupo, leitura }: LadoProps) {
  const bom = tom === "bom";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        bom ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-destructive/25 bg-destructive/[0.04]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-lg p-1.5",
            bom
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/12 text-destructive",
          )}
        >
          <Icone className="h-4 w-4" />
        </span>
        <h3 className="text-[13px] font-semibold">{titulo}</h3>
        <span className="ml-auto text-[11.5px] text-muted-foreground">
          nota média <strong className="text-foreground/80">{formatPercent(grupo.averageScore, 0)}</strong>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Barra
          rotulo="do capital em estoque"
          valor={grupo.stockCostShare}
          detalhe={formatCurrency(grupo.stockCost)}
          tom="capital"
        />
        <Barra
          rotulo="do lucro do período"
          valor={grupo.profitShare}
          detalhe={formatCurrency(grupo.profit)}
          tom={bom ? "bom" : "ruim"}
        />
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
        <Numero rotulo="produtos" valor={formatInteger(grupo.products)} />
        <Numero rotulo="giro" valor={formatPercent(grupo.sellThrough, 0)} />
        <Numero rotulo="margem" valor={formatPercent(grupo.margin, 0)} />
      </dl>

      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{leitura}</span>
      </p>
    </div>
  );
}

/** Uma barra na escala do total da loja, com o valor em reais ao lado. */
function Barra({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: number;
  detalhe: string;
  tom: "capital" | "bom" | "ruim";
}) {
  const largura = Math.max(0, Math.min(100, valor));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-mono tabular-nums text-foreground/80">
          {formatPercent(valor, 0)} · {detalhe}
        </span>
      </div>
      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full",
            tom === "capital" && "bg-sky-500/70",
            tom === "bom" && "bg-emerald-500/80",
            tom === "ruim" && "bg-destructive/70",
          )}
          style={{ width: `${largura}%` }}
        />
      </span>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10.5px] text-muted-foreground">{rotulo}</dt>
      <dd className="text-[15px] font-semibold tracking-tight">{valor}</dd>
    </div>
  );
}
