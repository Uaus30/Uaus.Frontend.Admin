import * as React from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { Badge, Button, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { SupplierPerformanceDto, SupplierPerformanceParametersDto } from "@workspace/api-client-react";
import { formatDaysAgo, formatInteger, formatPercent } from "../lib/format";
import { corDaNota } from "../lib/score";
import { motivosDaNota } from "../lib/reasons";
import { SupplierScoreRing } from "./SupplierScoreRing";
import { SupplierSparkline } from "./SupplierSparkline";

type SupplierRankingRowProps = {
  supplier: SupplierPerformanceDto;
  parameters: SupplierPerformanceParametersDto;
  position: number;
  /** Posição no ranking de LUCRO — é o que deixa o motivo dizer "2º maior da loja". */
  profitPosition: number;
  activeSuppliers: number;
  onOpen: (supplierId: number) => void;
};

/** Iniciais para o avatar, no mesmo molde da listagem de cadastro. */
function iniciais(nome: string) {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "??";
  if (palavras.length === 1) return palavras[0].substring(0, 2).toUpperCase();
  return `${palavras[0][0]}${palavras[1][0]}`.toUpperCase();
}

/**
 * Uma linha do ranking — o fornecedor inteiro em duas alturas de texto.
 *
 * É linha, e não card de grade, porque a pergunta da tela é comparativa: com uma
 * linha por fornecedor as colunas se alinham na vertical e dá para varrer "quem
 * tem a pior margem" sem ler nome por nome.
 *
 * O `xl:contents` nos dois agrupadores é o que permite as duas leituras com uma
 * marcação só: abaixo de `xl` eles são blocos empilhados; a partir dele se
 * dissolvem e os filhos viram colunas da MESMA grade, alinhadas entre as linhas.
 */
export function SupplierRankingRow({
  supplier,
  parameters,
  position,
  profitPosition,
  activeSuppliers,
  onOpen,
}: SupplierRankingRowProps) {
  const cor = corDaNota(supplier.score);
  const semVenda = supplier.sales === 0;
  const corDoAvatar = supplier.avatarColor ?? "#6366f1";
  const motivos = motivosDaNota(supplier, parameters, profitPosition, activeSuppliers);
  const margemAcimaDaMedia = supplier.margin >= parameters.storeMargin;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(supplier.supplierId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(supplier.supplierId);
        }
      }}
      className={cn(
        "cursor-pointer rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors",
        "hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none",
        semVenda && "opacity-60",
      )}
      data-testid="supplier-ranking-row"
    >
      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[28px_minmax(180px,1.25fr)_repeat(5,minmax(0,1fr))_132px_62px_104px] xl:items-center">
        <div className="flex items-center gap-3 xl:contents">
          <span
            className={cn(
              "text-center text-[15px] font-bold",
              position <= 3 ? "text-primary" : "text-muted-foreground",
            )}
          >
            {position}
          </span>

          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 flex-none select-none items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: `${corDoAvatar}25`,
                color: corDoAvatar,
                border: `2px solid ${corDoAvatar}40`,
              }}
            >
              {iniciais(supplier.supplierName)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{supplier.supplierName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                {supplier.isRecurring && (
                  <Badge className="border-0 bg-violet-500/15 px-1.5 py-0 text-[10px] font-semibold text-violet-300">
                    Recorrente
                  </Badge>
                )}
                {supplier.isMarketplace && (
                  <Badge className="border-0 bg-sky-500/15 px-1.5 py-0 text-[10px] font-semibold text-sky-300">
                    Marketplace
                  </Badge>
                )}
                {supplier.sales > 0 && supplier.judgedProducts < 5 && (
                  <Badge className="border-0 bg-amber-500/15 px-1.5 py-0 text-[10px] font-semibold text-amber-300">
                    amostra pequena
                  </Badge>
                )}
                <span className="truncate">última venda {formatDaysAgo(supplier.daysWithoutSelling)}</span>
              </div>
            </div>
          </div>

          {/* Em tela estreita a nota acompanha o nome; a partir de xl ela volta
              para a coluna própria, ao lado do minigráfico. */}
          <SupplierScoreRing score={supplier.score} size={44} className="ml-auto xl:hidden" />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:contents">
          <Metrica valor={formatInteger(supplier.sales)} rotulo="vendas" />

          <Metrica valor={formatCurrency(supplier.revenue)} rotulo="faturamento">
            {supplier.revenueChangePercent !== null && (
              <span
                className={cn(
                  "flex items-center justify-end gap-0.5 text-[10.5px] font-semibold",
                  supplier.revenueChangePercent >= 0 ? "text-emerald-400" : "text-destructive",
                )}
              >
                {supplier.revenueChangePercent >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {formatPercent(Math.abs(supplier.revenueChangePercent))}
              </span>
            )}
          </Metrica>

          <Metrica
            valor={semVenda ? "—" : formatPercent(supplier.margin)}
            rotulo="margem"
            corDoValor={semVenda ? undefined : margemAcimaDaMedia ? "#10b981" : "#f97316"}
          />

          <Metrica
            valor={supplier.judgedProducts > 0 ? formatPercent(supplier.hitRate, 0) : "—"}
            rotulo="produtos bons"
          >
            <span className="text-[10.5px] text-muted-foreground">
              {supplier.goodProducts} de {supplier.judgedProducts}
            </span>
          </Metrica>

          <Metrica valor={formatPercent(supplier.revenueShare)} rotulo="do faturamento" />
        </div>

        <div className="hidden xl:block">
          {semVenda ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <SupplierSparkline
              series={supplier.dailyRevenue}
              color={cor}
              label={`Faturamento diário de ${supplier.supplierName} no período`}
            />
          )}
        </div>

        <SupplierScoreRing score={supplier.score} className="hidden xl:flex" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-9 xl:flex"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(supplier.supplierId);
          }}
        >
          Detalhes
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/40 pt-2.5 xl:ml-10">
        {motivos.map((motivo) => (
          <span
            key={motivo.texto}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] leading-tight",
              motivo.tipo === "bom"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-orange-500/10 text-orange-300",
            )}
          >
            <span aria-hidden>{motivo.tipo === "bom" ? "✓" : "⚠"}</span>
            {motivo.texto}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metrica({
  valor,
  rotulo,
  corDoValor,
  children,
}: {
  valor: string;
  rotulo: string;
  corDoValor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-right">
      <p
        className="text-[15.5px] font-semibold leading-tight"
        style={corDoValor ? { color: corDoValor } : undefined}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[10.5px] text-muted-foreground">{rotulo}</p>
      {children}
    </div>
  );
}
