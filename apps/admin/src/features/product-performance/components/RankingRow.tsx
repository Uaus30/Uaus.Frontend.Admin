import { Link } from "wouter";
import { TableCell, TableRow, cn } from "@workspace/ui";
import { formatCurrency, marginBand } from "@workspace/core";
import type { ProductPerformanceItemDto, ProductPerformanceParametersDto } from "@workspace/api-client-react";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { BI_TONE_FILL, BI_TONE_PILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import {
  ACTION_INFO,
  CLASS_INFO,
  coberturaLegivel,
  formatScore,
  margemDaLinha,
  tomDaCobertura,
  tomDaNota,
} from "../lib/performance";
import type { MargemDaLinha } from "../lib/performance";

type RankingRowProps = {
  produto: ProductPerformanceItemDto;
  parameters: ProductPerformanceParametersDto;
  /** A coluna de capital em risco só aparece onde ela ordena a lista. */
  mostrarRisco: boolean;
};

/**
 * A conta da nota por extenso, para o `title` da pílula.
 *
 * É o que responde "por que este produto está acima daquele" sem abrir o manual
 * da tela: as seis parciais com o peso de cada uma, na ordem em que entram na
 * média. Num produto parado as quatro primeiras são zero, e fica visível que
 * quem o posicionou foram capital e liquidez.
 */
function detalharNota(
  produto: ProductPerformanceItemDto,
  parameters: ProductPerformanceParametersDto,
): string {
  const { scoreBreakdown: parciais } = produto;

  const componentes: [string, number, number][] = [
    ["Giro", parciais.turnover, parameters.turnoverWeight],
    ["Margem", parciais.margin, parameters.marginWeight],
    ["Resultado", parciais.result, parameters.resultWeight],
    ["Constância", parciais.consistency, parameters.consistencyWeight],
    ["Capital", parciais.capital, parameters.capitalWeight],
    ["Liquidez", parciais.liquidity, parameters.liquidityWeight],
  ];

  const conta = componentes
    .map(([nome, valor, peso]) => `${nome} ${formatScore(valor)} (${Math.round(peso * 100)}%)`)
    .join(" · ");

  return `Nota ${formatScore(produto.score)} — ${conta}`;
}

/** O que a célula de margem está mostrando, e o que fazer com o número. */
function explicarMargem(
  produto: ProductPerformanceItemDto,
  margem: MargemDaLinha,
  parameters: ProductPerformanceParametersDto,
): string {
  const daLoja = `Margem da loja no período: ${formatPercent(parameters.storeMargin)}`;

  if (margem.deEntrada) {
    if (margem.valor === null) return `Sem preço de venda cadastrado. ${daLoja}`;

    return (
      `Margem de ENTRADA: ${formatCurrency(produto.price)} de preço contra ` +
      `${formatCurrency(produto.costPrice)} de custo da última entrada de estoque. ` +
      `Este produto não vendeu no período, então não há margem realizada — é este o ` +
      `espaço que existe para descontar. ${daLoja}.`
    );
  }

  if (produto.missedProfit > 0) {
    return (
      `Margem realizada no período. Na margem média da loja ` +
      `(${formatPercent(parameters.storeMargin)}), o período teria rendido ` +
      `${formatCurrency(produto.missedProfit)} a mais`
    );
  }

  return `Margem realizada no período. ${daLoja}`;
}

/** Cor da margem — a mesma faixa da entrada de estoque e do recebimento de compra. */
const MARGEM_TOM = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  tight: "text-amber-600 dark:text-amber-400",
  low: "text-destructive",
} as const;

/**
 * Uma linha do ranking.
 *
 * Três colunas carregam a leitura de "bom ou ruim" e as três usam cor COM ícone
 * ou texto: a nota (pílula), a situação e a ação sugerida. Cor sozinha não
 * sobrevive a uma impressão em preto e branco nem a quem não distingue verde de
 * âmbar — e esta é uma tela que se imprime para levar ao balcão.
 */
export function RankingRow({ produto, parameters, mostrarRisco }: RankingRowProps) {
  const classe = CLASS_INFO[produto.class];
  const acao = ACTION_INFO[produto.action];
  const notaTom = tomDaNota(produto.score, parameters.standoutScore, parameters.steadyScore);

  const margem = margemDaLinha(produto);
  const faixaDaMargem = marginBand(margem.valor);

  const coberturaTom = tomDaCobertura(
    produto.coverageDays,
    produto.stock,
    parameters.shortCoverageDays,
    parameters.excessCoverageDays,
  );

  return (
    <TableRow className="border-border/40">
      <TableCell className="px-2 py-2 text-right font-mono text-[11.5px] text-muted-foreground">
        {produto.rank}
      </TableCell>

      <TableCell className="max-w-[260px] px-2 py-2">
        {produto.productGroupId ? (
          <Link
            href={`/produtos/${produto.productGroupId}/detalhes`}
            className="block truncate text-[12.5px] font-medium hover:text-primary hover:underline"
          >
            {produto.productName}
          </Link>
        ) : (
          <span className="block truncate text-[12.5px] font-medium">{produto.productName}</span>
        )}
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {[produto.categoryName, produto.supplierName].filter(Boolean).join(" · ") || produto.barcode}
        </span>
      </TableCell>

      {/* A nota traz a barra junto: o número sozinho obriga a lembrar que a
          escala é de 0 a 100, e a barra responde isso sem texto.

          A casa decimal é o que torna a ordem legível. Com a nota arredondada
          para inteiro, meia dúzia de parados seguidos aparecia como "4, 4, 4" e
          a lista parecia fora de ordem — quando o que os separava era 4,1 · 3,9
          · 3,6, e é exatamente essa diferença que decide a posição. */}
      <TableCell className="px-2 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-12 shrink-0 rounded border px-1 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums",
              BI_TONE_PILL[notaTom],
            )}
            title={detalharNota(produto, parameters)}
          >
            {formatScore(produto.score)}
          </span>
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", BI_TONE_FILL[notaTom])}
              style={{ width: `${Math.max(2, Math.min(100, produto.score))}%` }}
            />
          </span>
        </div>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
            BI_TONE_PILL[classe.tom],
          )}
          title={classe.explicacao}
        >
          <classe.icone className="h-3 w-3" />
          {classe.rotulo}
        </span>
      </TableCell>

      {mostrarRisco && (
        <TableCell
          className="px-2 py-2 text-right font-mono text-[12px] font-semibold tabular-nums text-destructive"
          title={`${formatCurrency(produto.stockCost)} na prateleira, ponderados pela nota de venda (${formatScore(produto.salesScore)}). O capital preso já está dentro da nota cheia; pesar os reais por ela também os contaria duas vezes.`}
        >
          {formatCurrency(produto.capitalAtRisk)}
        </TableCell>
      )}

      <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
        <span
          title={`${formatInteger(produto.sales)} venda(s) · ${produto.weeksWithSales} semana(s) com venda`}
        >
          {formatInteger(produto.units)}
        </span>
      </TableCell>

      <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
        {formatCurrency(produto.revenue)}
      </TableCell>

      <TableCell
        className={cn(
          "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
          produto.profit < 0 && "font-semibold text-destructive",
        )}
      >
        {formatCurrency(produto.profit)}
      </TableCell>

      <TableCell
        className={cn(
          "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
          faixaDaMargem ? MARGEM_TOM[faixaDaMargem] : "text-muted-foreground",
        )}
        title={explicarMargem(produto, margem, parameters)}
      >
        {formatPercent(margem.valor)}
        {/* A origem vai em TEXTO, e não só num tom mais apagado: a mesma regra
            das outras colunas desta tela, que se imprime em preto e branco para
            ir ao balcão. Sem o rótulo, "38,2%" numa linha de produto parado
            seria lido como margem realizada — que ele não tem. */}
        {margem.deEntrada && margem.valor !== null && (
          <span className="block text-[9.5px] font-normal uppercase tracking-wide text-muted-foreground">
            entrada
          </span>
        )}
      </TableCell>

      <TableCell
        className={cn(
          "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
          produto.sellThrough >= parameters.storeSellThrough ? BI_TONE_TEXT.bom : BI_TONE_TEXT.mudo,
        )}
        title={`Saiu ${formatPercent(produto.sellThrough)} do que existia. A loja escoou ${formatPercent(parameters.storeSellThrough)}.`}
      >
        {formatPercent(produto.sellThrough, 0)}
      </TableCell>

      <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
        <span title={`${formatCurrency(produto.stockCost)} de custo parado`}>
          {formatInteger(produto.stock)}
          <span className="ml-1 text-[10.5px]">un</span>
        </span>
      </TableCell>

      <TableCell className={cn("px-2 py-2 text-right text-[12px]", BI_TONE_TEXT[coberturaTom])}>
        {coberturaLegivel(produto.coverageDays, produto.stock)}
      </TableCell>

      <TableCell className="px-2 py-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
            BI_TONE_PILL[acao.tom],
          )}
          title={acao.explicacao}
        >
          <acao.icone className="h-3 w-3" />
          {acao.rotulo}
        </span>
      </TableCell>
    </TableRow>
  );
}
