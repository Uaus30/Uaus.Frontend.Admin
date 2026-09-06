import * as React from "react";
import { Card } from "@workspace/ui";
import type { SupplierPerformanceDto } from "@workspace/api-client-react";
import { formatPercent } from "../lib/format";

/** Quantas linhas cabem sem a leitura virar tabela. */
const LIMITE = 9;

const COR_ACIMA = "#10b981";
const COR_ABAIXO = "#f97316";

type SupplierMarginSpreadCardProps = {
  suppliers: SupplierPerformanceDto[];
  storeMargin: number;
};

/**
 * Quem puxa a margem da loja para cima e quem puxa para baixo.
 *
 * Barra divergente: dois matizes opostos e um eixo neutro no meio — a forma que
 * a polaridade pede. O que se lê é a DISTÂNCIA até a média da loja, em pontos
 * percentuais, com a margem real ao lado para a linha se explicar sozinha.
 *
 * Ordenado por margem, e não por faturamento: assim o desenho vira um funil e o
 * olho encontra o pior sem ler nome por nome.
 */
export function SupplierMarginSpreadCard({ suppliers, storeMargin }: SupplierMarginSpreadCardProps) {
  const linhas = React.useMemo(
    () =>
      suppliers
        .filter((x) => x.sales > 0)
        .sort((a, b) => b.margin - a.margin)
        .slice(0, LIMITE),
    [suppliers],
  );

  /** Escala arredondada para 5 em 5, para os rótulos do eixo saírem redondos. */
  const escala = React.useMemo(() => {
    const maior = Math.max(...linhas.map((x) => Math.abs(x.margin - storeMargin)), 0);
    return Math.max(5, Math.ceil(maior / 5) * 5);
  }, [linhas, storeMargin]);

  if (linhas.length === 0) {
    return (
      <Card className="border-border/60 p-5">
        <h2 className="text-[14.5px] font-semibold">Margem contra a média da loja</h2>
        <p className="mt-6 text-sm text-muted-foreground">Nenhuma venda atribuída no período.</p>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 p-5">
      <h2 className="text-[14.5px] font-semibold">Margem contra a média da loja</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Quem puxa a margem para cima e quem puxa para baixo — em pontos percentuais
      </p>

      <div className="mt-4 grid grid-cols-[minmax(90px,140px)_1fr_118px] items-center gap-3">
        <div />
        <p className="border-b border-border pb-1 text-center text-[11px] text-muted-foreground">
          média da loja <strong className="text-foreground">{formatPercent(storeMargin)}</strong>
        </p>
        <div />
      </div>

      <div className="flex flex-col gap-1">
        {linhas.map((fornecedor) => {
          const delta = fornecedor.margin - storeMargin;
          const largura = (Math.abs(delta) / escala) * 50;
          const acima = delta >= 0;

          return (
            <div
              key={fornecedor.supplierId}
              className="grid h-7 grid-cols-[minmax(90px,140px)_1fr_118px] items-center gap-3 rounded-md hover:bg-muted/40"
            >
              <span className="truncate text-right text-[12.5px] text-foreground/80">
                {fornecedor.supplierName}
              </span>

              <span className="relative h-full">
                <span className="absolute inset-y-0 left-1/4 w-px bg-border/60" aria-hidden />
                <span className="absolute inset-y-0 left-3/4 w-px bg-border/60" aria-hidden />
                <span className="absolute -inset-y-0.5 left-1/2 w-px bg-muted-foreground/70" aria-hidden />
                <span
                  className="absolute top-1.5 h-4"
                  style={{
                    backgroundColor: acima ? COR_ACIMA : COR_ABAIXO,
                    width: `${largura}%`,
                    left: acima ? "50%" : undefined,
                    right: acima ? undefined : "50%",
                    borderRadius: acima ? "0 4px 4px 0" : "4px 0 0 4px",
                  }}
                />
              </span>

              <span className="flex items-baseline gap-2 font-mono text-[12.5px]">
                <strong className="font-semibold text-foreground/80">
                  {formatPercent(fornecedor.margin)}
                </strong>
                <span className="text-[11.5px] text-muted-foreground">
                  {acima ? "+" : "−"}
                  {Math.abs(delta).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{" "}
                  pp
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-[minmax(90px,140px)_1fr_118px] gap-3">
        <div />
        <div className="flex justify-between font-mono text-[10.5px] text-muted-foreground">
          <span>−{escala}</span>
          <span>−{escala / 2}</span>
          <span>0</span>
          <span>+{escala / 2}</span>
          <span>+{escala}</span>
        </div>
        <div />
      </div>
    </Card>
  );
}
