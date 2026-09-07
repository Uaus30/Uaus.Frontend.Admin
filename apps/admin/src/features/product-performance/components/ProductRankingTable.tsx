import * as React from "react";
import { Badge, Button, Card, Table, TableBody, TableHeader, TableRow, cn } from "@workspace/ui";
import type { ProductPerformanceItemDto, ProductPerformanceParametersDto } from "@workspace/api-client-react";
import { BiColumnHeader } from "@/components/bi-column-header";
import { formatInteger } from "@/features/supplier-performance/lib/format";
import { RankingRow } from "./RankingRow";

type ProductRankingTableProps = {
  title: string;
  /** Uma linha dizendo por que a lista está nesta ordem. */
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "best" | "worst";
  products: ProductPerformanceItemDto[];
  /** Total antes do recorte — é o que dá sentido a "12 de 100". */
  total: number;
  parameters: ProductPerformanceParametersDto;
  /** Rótulo do recorte em vigor, quando há um. */
  focusLabel: string | null;
  emptyMessage: string;
};

/** Quantas linhas por vez. Duas tabelas de cem numa tela só cansam a rolagem. */
const PAGINA = 25;

/**
 * Um dos dois rankings.
 *
 * O mesmo componente serve aos dois porque as colunas são as mesmas — o que muda
 * é a ORDEM e uma coluna: os melhores saem por nota, os piores por capital em
 * risco, que só aparece do lado em que ela decide alguma coisa. Duas tabelas
 * escritas à mão divergiriam no primeiro ajuste de coluna, e comparar os dois
 * extremos exige que eles sejam lidos do mesmo jeito.
 */
export function ProductRankingTable({
  title,
  description,
  icon: Icone,
  variant,
  products,
  total,
  parameters,
  focusLabel,
  emptyMessage,
}: ProductRankingTableProps) {
  /**
   * A paginação carrega junto o recorte a que pertence — o mesmo cuidado da
   * tabela da curva ABC. Sem isso, trocar o filtro mostraria "25 de 3".
   */
  const recorte = focusLabel ?? "";
  const [paginacao, setPaginacao] = React.useState({ recorte, limite: PAGINA });

  const limite = paginacao.recorte === recorte ? paginacao.limite : PAGINA;
  const visiveis = products.slice(0, limite);
  const melhores = variant === "best";

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={cn(
            "rounded-lg p-1.5",
            melhores
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/12 text-destructive",
          )}
        >
          <Icone className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[14.5px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>

        {focusLabel && (
          <Badge className="gap-1 border-primary/40 bg-primary/10 text-primary" variant="outline">
            {focusLabel}
          </Badge>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {formatInteger(products.length)} de {formatInteger(total)}
        </span>
      </div>

      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table className="min-w-[70rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <BiColumnHeader className="w-10">#</BiColumnHeader>
                <BiColumnHeader>Produto</BiColumnHeader>
                <BiColumnHeader
                  className="w-28 text-center"
                  dica={`Média ponderada de giro (${pct(parameters.turnoverWeight)}), margem (${pct(parameters.marginWeight)}), resultado (${pct(parameters.resultWeight)}) e constância (${pct(parameters.consistencyWeight)}), cada um medido contra a própria loja`}
                >
                  Nota
                </BiColumnHeader>
                <BiColumnHeader className="w-24 text-center" dica="A nota em uma palavra">
                  Situação
                </BiColumnHeader>
                {!melhores && (
                  <BiColumnHeader
                    className="text-right"
                    dica="Custo do que está na prateleira, ponderado pela nota, mais o prejuízo já realizado. É o que ordena esta lista."
                  >
                    Em risco
                  </BiColumnHeader>
                )}
                <BiColumnHeader className="text-right">Vendidos</BiColumnHeader>
                <BiColumnHeader className="text-right">Faturamento</BiColumnHeader>
                <BiColumnHeader className="text-right">Lucro</BiColumnHeader>
                <BiColumnHeader
                  className="text-right"
                  dica={`Margem da loja no período: ${pct(parameters.storeMargin / 100)}. Verde a partir de ${pct(parameters.healthyMarginThreshold / 100)}, vermelho abaixo de ${pct(parameters.lowMarginThreshold / 100)}.`}
                >
                  Margem
                </BiColumnHeader>
                <BiColumnHeader
                  className="text-right"
                  dica={`Quanto do que existia saiu no período. A loja escoou ${pct(parameters.storeSellThrough / 100)}.`}
                >
                  Giro
                </BiColumnHeader>
                <BiColumnHeader className="text-right" dica="Saldo de hoje e o custo dele">
                  Estoque
                </BiColumnHeader>
                <BiColumnHeader
                  className="text-right"
                  dica={`Quanto o saldo dura no ritmo do período. Até ${parameters.shortCoverageDays} dias é risco de faltar; a partir de um ano é estoque demais.`}
                >
                  Dura
                </BiColumnHeader>
                <BiColumnHeader className="w-40">Ação sugerida</BiColumnHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((produto) => (
                <RankingRow
                  key={produto.productId}
                  produto={produto}
                  parameters={parameters}
                  mostrarRisco={!melhores}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {products.length > limite && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaginacao({ recorte, limite: limite + PAGINA })}
          >
            Mostrar mais {Math.min(PAGINA, products.length - limite)} de{" "}
            {formatInteger(products.length - limite)} restantes
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Fração em percentual inteiro: `0.3` vira "30%". */
function pct(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}
