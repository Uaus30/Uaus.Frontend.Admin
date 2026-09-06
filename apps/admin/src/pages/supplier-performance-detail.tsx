import { AlertCircle, ArrowLeft, ShoppingCart } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Badge, Button, Card, Spinner } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { AppLayout } from "@/components/layout";
import { useSupplierDetail } from "@/features/supplier-performance/hooks/useSupplierDetail";
import { SupplierScoreRing } from "@/features/supplier-performance/components/SupplierScoreRing";
import { SupplierScoreBreakdown } from "@/features/supplier-performance/components/SupplierScoreBreakdown";
import { SupplierDailyRevenueChart } from "@/features/supplier-performance/components/SupplierDailyRevenueChart";
import { SupplierMixCard } from "@/features/supplier-performance/components/SupplierMixCard";
import { SupplierRelationCard } from "@/features/supplier-performance/components/SupplierRelationCard";
import {
  NomeDoProduto,
  SupplierProductList,
} from "@/features/supplier-performance/components/SupplierProductList";
import { corDaNota } from "@/features/supplier-performance/lib/score";
import { formatDaysAgo, formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";

/**
 * BI › Desempenho de Fornecedores › detalhe.
 *
 * Todos os números aqui saem do MESMO cálculo do ranking — o endpoint carrega o
 * conjunto inteiro e devolve o mix de um só. Sem isso, os componentes
 * comparativos da nota (margem e resultado, medidos contra as médias da loja)
 * dariam valores diferentes aqui e lá, para o mesmo fornecedor e o mesmo
 * período.
 */
export default function SupplierPerformanceDetailPage() {
  const [, params] = useRoute("/bi/fornecedores/:id");
  const supplierId = params?.id ? Number(params.id) : null;
  const tela = useSupplierDetail(Number.isFinite(supplierId) ? supplierId : null);
  const detalhe = tela.detail;

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <Link
          href="/bi/fornecedores"
          className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao ranking
        </Link>

        {tela.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Não foi possível carregar a análise deste fornecedor.</span>
          </div>
        )}

        {tela.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        )}

        {detalhe && (
          <>
            <Cabecalho detalhe={detalhe} periodo={tela.period.label} />

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Indicador
                rotulo="Faturamento"
                valor={formatCurrency(detalhe.summary.revenue)}
                nota={`${formatPercent(detalhe.summary.revenueShare)} do total da loja`}
              />
              <Indicador
                rotulo="Lucro"
                valor={formatCurrency(detalhe.summary.profit)}
                nota={`${formatPercent(detalhe.summary.profitShare)} do lucro da loja`}
              />
              <Indicador
                rotulo="Margem"
                valor={formatPercent(detalhe.summary.margin)}
                nota={`média da loja ${formatPercent(detalhe.parameters.storeMargin)}`}
              />
              <Indicador
                rotulo="Ticket médio"
                valor={formatCurrency(detalhe.summary.averageTicket)}
                nota={`${formatInteger(detalhe.summary.sales)} vendas · ${formatInteger(detalhe.summary.units)} un`}
              />
              <Indicador
                rotulo="Capital em estoque"
                valor={formatCurrency(detalhe.summary.stockCost)}
                nota={`${formatInteger(detalhe.summary.stockUnits)} unidades`}
              />
              <Indicador
                rotulo="Retorno do estoque"
                valor={
                  detalhe.summary.stockReturn === null ? "—" : formatCurrency(detalhe.summary.stockReturn)
                }
                nota="de lucro por R$ 1 parado, no período"
              />
            </div>

            <div className="grid items-start gap-3 xl:grid-cols-[1fr_360px]">
              <div className="flex flex-col gap-3">
                <SupplierScoreBreakdown supplier={detalhe.summary} parameters={detalhe.parameters} />

                <SupplierDailyRevenueChart
                  series={detalhe.summary.dailyRevenue}
                  startDate={detalhe.startDate}
                  color={corDaNota(detalhe.summary.score)}
                />

                <SupplierProductList
                  titulo={
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                      Produtos bons
                    </span>
                  }
                  descricao={`Vendem com margem de ${formatPercent(detalhe.parameters.goodMarginThreshold, 0)} ou mais`}
                  produtos={tela.listas.bons}
                  limite={tela.limite}
                  vazio="Nenhum produto deste fornecedor vendeu com boa margem no período."
                  colunas={[
                    { titulo: "Produto", render: (p) => <NomeDoProduto produto={p} /> },
                    { titulo: "Vendidos", numeric: true, render: (p) => formatInteger(p.soldUnits) },
                    { titulo: "Faturamento", numeric: true, render: (p) => formatCurrency(p.revenue) },
                    { titulo: "Lucro", numeric: true, render: (p) => formatCurrency(p.profit) },
                    {
                      titulo: "Margem",
                      numeric: true,
                      render: (p) => <span className="text-emerald-400">{formatPercent(p.margin)}</span>,
                    },
                    { titulo: "Estoque", numeric: true, render: (p) => formatInteger(p.stock) },
                    {
                      titulo: "Cobertura",
                      numeric: true,
                      render: (p) => (p.coverageDays === null ? "—" : `${Math.round(p.coverageDays)}d`),
                    },
                  ]}
                />

                <SupplierProductList
                  titulo={
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden />
                      Produtos parados
                    </span>
                  }
                  descricao="Têm estoque e não venderam no período"
                  produtos={tela.listas.parados}
                  limite={tela.limite}
                  vazio="Nenhum produto parado — todo o estoque deste fornecedor girou."
                  colunas={[
                    { titulo: "Produto", render: (p) => <NomeDoProduto produto={p} /> },
                    { titulo: "Estoque", numeric: true, render: (p) => formatInteger(p.stock) },
                    {
                      titulo: "Custo parado",
                      numeric: true,
                      render: (p) => <span className="text-orange-400">{formatCurrency(p.stockCost)}</span>,
                    },
                    {
                      titulo: "Sem vender",
                      numeric: true,
                      render: (p) =>
                        p.daysWithoutSelling === null
                          ? "nunca vendeu"
                          : `${formatInteger(p.daysWithoutSelling)} dias`,
                    },
                    {
                      titulo: "Na loja há",
                      numeric: true,
                      render: (p) => (p.daysInStore === null ? "—" : `${formatInteger(p.daysInStore)} dias`),
                    },
                  ]}
                />

                <SupplierProductList
                  titulo={
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
                      Vendem, mas com margem baixa
                    </span>
                  }
                  descricao={`Abaixo de ${formatPercent(detalhe.parameters.goodMarginThreshold, 0)} de margem`}
                  produtos={tela.listas.margemBaixa}
                  limite={6}
                  vazio="Nenhum produto vendendo com margem abaixo do piso."
                  colunas={[
                    { titulo: "Produto", render: (p) => <NomeDoProduto produto={p} /> },
                    { titulo: "Vendidos", numeric: true, render: (p) => formatInteger(p.soldUnits) },
                    { titulo: "Faturamento", numeric: true, render: (p) => formatCurrency(p.revenue) },
                    {
                      titulo: "Margem",
                      numeric: true,
                      render: (p) => <span className="text-orange-400">{formatPercent(p.margin)}</span>,
                    },
                    {
                      titulo: "Custo atual",
                      numeric: true,
                      render: (p) => (p.currentCost === null ? "—" : formatCurrency(p.currentCost)),
                    },
                    {
                      titulo: "Variação",
                      numeric: true,
                      render: (p) =>
                        p.costChangePercent === null ? (
                          "—"
                        ) : (
                          <span className={p.costChangePercent > 0 ? "text-destructive" : "text-emerald-400"}>
                            {p.costChangePercent > 0 ? "▲" : "▼"}{" "}
                            {formatPercent(Math.abs(p.costChangePercent), 0)}
                          </span>
                        ),
                    },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-3">
                <SupplierProductList
                  compacta
                  titulo={
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      Comprar em breve
                    </span>
                  }
                  descricao="Vendem bem e o estoque acaba em menos de 45 dias"
                  produtos={tela.listas.recompra}
                  limite={12}
                  vazio="Nada urgente: o estoque atual cobre mais de 45 dias em todos os itens."
                  colunas={[
                    { titulo: "Produto", render: (p) => <NomeDoProduto produto={p} /> },
                    {
                      titulo: "Estoque",
                      numeric: true,
                      // Zero em vermelho: é o único caso da lista em que a loja já
                      // está perdendo venda, e não apenas prestes a perder.
                      render: (p) =>
                        p.stock === 0 ? (
                          <span className="font-semibold text-destructive">0</span>
                        ) : (
                          formatInteger(p.stock)
                        ),
                    },
                  ]}
                />

                <SupplierMixCard detail={detalhe} />
                <SupplierRelationCard detail={detalhe} />
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Cabecalho({
  detalhe,
  periodo,
}: {
  detalhe: NonNullable<ReturnType<typeof useSupplierDetail>["detail"]>;
  periodo: string;
}) {
  const { summary } = detalhe;
  const cor = summary.avatarColor ?? "#6366f1";
  const iniciais = summary.supplierName.trim().split(/\s+/).filter(Boolean);
  const sigla =
    iniciais.length === 1
      ? iniciais[0].substring(0, 2).toUpperCase()
      : `${iniciais[0]?.[0] ?? "?"}${iniciais[1]?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="flex h-14 w-14 flex-none select-none items-center justify-center rounded-full text-lg font-bold"
        style={{ backgroundColor: `${cor}25`, color: cor, border: `2px solid ${cor}40` }}
      >
        {sigla}
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[27px] font-semibold tracking-tight">{summary.supplierName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          {summary.isRecurring && (
            <Badge className="border-0 bg-violet-500/15 text-[10px] font-semibold text-violet-300">
              Recorrente
            </Badge>
          )}
          {summary.isMarketplace && (
            <Badge className="border-0 bg-sky-500/15 text-[10px] font-semibold text-sky-300">
              Marketplace
            </Badge>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-xs">{periodo}</span>
          <span>
            {formatInteger(summary.totalProducts)} produtos comprados dele · última venda{" "}
            {formatDaysAgo(summary.daysWithoutSelling)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/estoque/entradas?supplierId=${summary.supplierId}`}>Ver entradas</Link>
        </Button>
        <SupplierScoreRing score={summary.score} size={72} />
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <Card className="border-border/60 p-3.5">
      <p className="text-[11.5px] text-muted-foreground">{rotulo}</p>
      <p className="mt-1.5 text-[21px] font-semibold tracking-tight">{valor}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{nota}</p>
    </Card>
  );
}
