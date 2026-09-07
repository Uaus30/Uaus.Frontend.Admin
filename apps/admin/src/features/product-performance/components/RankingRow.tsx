import { Link } from "wouter";
import { TableCell, TableRow, cn } from "@workspace/ui";
import { formatCurrency, marginBand } from "@workspace/core";
import type { ProductPerformanceItemDto, ProductPerformanceParametersDto } from "@workspace/api-client-react";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { BI_TONE_FILL, BI_TONE_PILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { ACTION_INFO, CLASS_INFO, coberturaLegivel, tomDaCobertura, tomDaNota } from "../lib/performance";

type RankingRowProps = {
  produto: ProductPerformanceItemDto;
  parameters: ProductPerformanceParametersDto;
  /** A coluna de capital em risco só aparece onde ela ordena a lista. */
  mostrarRisco: boolean;
};

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
  const faixaDaMargem = marginBand(produto.margin);

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
          escala é de 0 a 100, e a barra responde isso sem texto. */}
      <TableCell className="px-2 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-9 shrink-0 rounded border px-1 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums",
              BI_TONE_PILL[notaTom],
            )}
          >
            {Math.round(produto.score)}
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
          title={`${formatCurrency(produto.stockCost)} na prateleira, ponderados por uma nota de ${Math.round(produto.score)}`}
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
        title={
          produto.missedProfit > 0
            ? `Na margem média da loja (${formatPercent(parameters.storeMargin)}), o período teria rendido ${formatCurrency(produto.missedProfit)} a mais`
            : `Margem da loja no período: ${formatPercent(parameters.storeMargin)}`
        }
      >
        {produto.units > 0 ? formatPercent(produto.margin) : "—"}
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
