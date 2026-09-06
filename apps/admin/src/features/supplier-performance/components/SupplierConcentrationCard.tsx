import * as React from "react";
import { Card } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { SupplierPerformanceDto } from "@workspace/api-client-react";
import { formatPercent, plural } from "../lib/format";

/**
 * Paleta categórica do tema, na ordem fixa em que as séries são atribuídas.
 *
 * Ordem fixa e nunca ciclada: a cor segue o fornecedor, não a posição dele. Um
 * filtro que muda a lista não pode repintar quem sobrou — quem aprendeu "Shopee
 * é laranja" passaria a ler a barra errada. O cinza fecha a lista como "Outros",
 * que é o único jeito honesto de não gerar uma nona cor.
 */
const CORES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const COR_OUTROS = "hsl(215 20% 42%)";

/** Quantos fornecedores ganham fatia própria antes do agrupamento. */
const TOP = 5;

type SupplierConcentrationCardProps = {
  suppliers: SupplierPerformanceDto[];
  suppliersWithoutSales: number;
  stockOfSuppliersWithoutSales: number;
};

/**
 * De quem saiu o faturamento e de quem saiu o lucro.
 *
 * São duas barras e não uma: a diferença entre elas é a informação. Um
 * fornecedor que faz 74% do faturamento e 75% do lucro está puxando a média para
 * cima; um que faz 20% do faturamento e 8% do lucro está ocupando prateleira.
 *
 * <b>Não há alerta de concentração aqui.</b> Ele existiu na primeira versão e
 * saiu: o fornecedor concentrador da loja é um marketplace, com vários vendedores
 * atrás do mesmo nome, e chamar aquilo de "risco de depender de um fornecedor só"
 * é falso. Quem quiser a leitura de risco tem a marca de marketplace no cadastro
 * para separar os dois casos.
 */
export function SupplierConcentrationCard({
  suppliers,
  suppliersWithoutSales,
  stockOfSuppliersWithoutSales,
}: SupplierConcentrationCardProps) {
  const ativos = React.useMemo(
    () => [...suppliers].filter((x) => x.revenue > 0).sort((a, b) => b.revenue - a.revenue),
    [suppliers],
  );

  const segmentos = React.useMemo(() => {
    const principais = ativos.slice(0, TOP).map((fornecedor, indice) => ({
      id: String(fornecedor.supplierId),
      nome: fornecedor.supplierName,
      cor: CORES[indice],
      faturamento: fornecedor.revenueShare,
      lucro: fornecedor.profitShare,
    }));

    const resto = ativos.slice(TOP);
    if (resto.length === 0) return principais;

    return [
      ...principais,
      {
        id: "outros",
        nome: `Outros (${resto.length})`,
        cor: COR_OUTROS,
        faturamento: resto.reduce((soma, x) => soma + x.revenueShare, 0),
        lucro: resto.reduce((soma, x) => soma + x.profitShare, 0),
      },
    ];
  }, [ativos]);

  if (segmentos.length === 0) {
    return (
      <Card className="border-border/60 p-5">
        <h2 className="text-[14.5px] font-semibold">Concentração do período</h2>
        <p className="mt-6 text-sm text-muted-foreground">Nenhuma venda atribuída no período.</p>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 p-5">
      <h2 className="text-[14.5px] font-semibold">Concentração do período</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Quanto do faturamento e do lucro saiu de cada fornecedor
      </p>

      <Barra titulo="Faturamento" segmentos={segmentos} campo="faturamento" />
      <Barra titulo="Lucro" segmentos={segmentos} campo="lucro" />

      <ul className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-5">
        {segmentos.map((segmento) => (
          <li key={segmento.id} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="h-2.5 w-2.5 flex-none rounded-sm"
              style={{ backgroundColor: segmento.cor }}
              aria-hidden
            />
            <span className="truncate">{segmento.nome}</span>
            <span className="ml-auto whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">
              {formatPercent(segmento.faturamento)} · {formatPercent(segmento.lucro)}
            </span>
          </li>
        ))}
      </ul>

      {suppliersWithoutSales > 0 && (
        <p className="mt-4 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
          {plural(suppliersWithoutSales, "fornecedor não vendeu", "fornecedores não venderam")} nada no
          período e somam{" "}
          <strong className="text-foreground">{formatCurrency(stockOfSuppliersWithoutSales)}</strong> parados
          em estoque.
        </p>
      )}
    </Card>
  );
}

type Segmento = { id: string; nome: string; cor: string; faturamento: number; lucro: number };

/**
 * Barra empilhada 100%. Os 2px de separação são a superfície do card aparecendo
 * entre as fatias — é o que separa dois tons vizinhos sem desenhar contorno, que
 * acrescentaria tinta que não é dado.
 */
function Barra({
  titulo,
  segmentos,
  campo,
}: {
  titulo: string;
  segmentos: Segmento[];
  campo: "faturamento" | "lucro";
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <div className="mt-1.5 flex h-7 gap-0.5">
        {segmentos.map((segmento) => {
          const valor = segmento[campo];
          if (valor <= 0) return null;
          return (
            <div
              key={segmento.id}
              className="grid place-items-center overflow-hidden rounded-sm text-[11px] font-bold text-white first:rounded-l-lg last:rounded-r-lg"
              style={{ flex: valor, backgroundColor: segmento.cor }}
              title={`${segmento.nome}: ${formatPercent(valor)}`}
            >
              {valor >= 9 && formatPercent(valor)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
