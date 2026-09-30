import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ImageIcon, Search } from "lucide-react";
import { Link } from "wouter";
import { Button, ImageHoverZoom, Input, Spinner } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { formatDate, formatShortDate } from "@workspace/core";
import type { LowStockScope, LowStockSort } from "@workspace/api-client-react";
import { outOfControlLabel } from "@/lib/stock-control";
import type { LowStockItem } from "../types";
import { LowStockRowActions } from "./LowStockRowActions";

type LowStockTableProps = {
  /** Qual lista está aberta: muda o botão da linha e o texto do vazio. */
  scope: LowStockScope;
  items: LowStockItem[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  maxStock: string;
  setMaxStock: (value: string) => void;
  minRecentSales: string;
  setMinRecentSales: (value: string) => void;
  sort: LowStockSort;
  /** Clique no cabeçalho de "Vendas 30d". */
  onToggleSalesSort: () => void;
  page: number;
  totalPages: number;
  setPage: (value: number) => void;
  /** Botão "Comprar": leva ao pedido de compra do produto, já preenchido. */
  onComprar: (item: LowStockItem) => void;
  onDisableStockControl: (item: LowStockItem) => void;
  onEnableStockControl: (item: LowStockItem) => void;
  onInactivate: (item: LowStockItem) => void;
  mutatingProductId: number | null;
};

/** O título do "nada encontrado" cita o filtro que esvaziou a tela, não um genérico. */
function tituloDoVazio(scope: LowStockScope, maxStock: string, minRecentSales: string): string {
  const teto = maxStock.trim();
  const vendas = minRecentSales.trim();

  if (scope === "OutOfControl")
    return teto || vendas
      ? "Nenhum produto fora do controle com esses filtros."
      : "Todo produto está no controle de estoque.";

  if (teto && vendas)
    return `Nenhum produto para repor com estoque menor que ${teto} e ${vendas} ou mais vendas em 30 dias.`;
  if (teto) return `Nenhum produto para repor com estoque menor que ${teto}.`;
  if (vendas) return `Nenhum produto para repor com ${vendas} ou mais vendas nos últimos 30 dias.`;
  return "Nenhum produto precisando de reposição.";
}

/** Caminho do detalhe do produto — o id é o do GRUPO, que é o que a tela edita. */
function productDetailHref(productGroupId: number): string {
  return `/produtos/${productGroupId}/detalhes`;
}

/**
 * Quanto tempo o saldo dura, em texto curto.
 *
 * Vira "acaba hoje" abaixo de um dia e ganha o mês quando passa de sessenta:
 * "92 dias" é preciso e ilegível para quem só quer saber se dá para esperar a
 * próxima compra.
 */
function duracaoLegivel(days: number | null | undefined, stock: number): string {
  // Saldo zero e passado, nao previsao: "acaba hoje" para quem ja acabou manda
  // a pessoa conferir uma data que nao existe mais.
  if (stock <= 0) return "esgotado";
  if (days == null) return "—";
  if (days < 1) return "acaba hoje";
  if (days <= 60) return `${Math.round(days)} dias`;
  return `${Math.round(days / 30)} meses`;
}

/**
 * O título da coluna "Dura" mostra a conta inteira: "0,13 un./dia" sozinho não
 * diz de onde saiu, e é esta coluna que decide a ordem da lista.
 */
function tituloDaDuracao(item: LowStockItem): string {
  const porMes = ((item.dailyDemand ?? 0) * 30).toFixed(1).replace(".", ",");
  const mediana =
    item.monthlySalesMedian != null
      ? ` — mediana de ${String(item.monthlySalesMedian).replace(".", ",")}/mês`
      : "";
  return `Demanda prevista de ${porMes} un./mês (${item.averageDailySales ?? 0} por dia)${mediana}`;
}

/** Cor da previsão: vermelho até uma semana, âmbar até três, neutro depois. */
function duracaoTone(days: number | null | undefined, stock: number): string {
  if (stock <= 0) return "font-semibold text-red-600 dark:text-red-400";
  if (days == null) return "text-muted-foreground";
  if (days <= 7) return "font-semibold text-red-600 dark:text-red-400";
  if (days <= 21) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

/** O texto de rodapé do vazio: o que entra em cada lista. */
function explicacaoDoVazio(scope: LowStockScope, filtrado: boolean): string {
  if (filtrado) return "Os dois filtros só estreitam a lista; apague-os para ver tudo.";
  return scope === "OutOfControl"
    ? "Aqui ficam os produtos com o controle desligado e os que vendem menos de 1 por mês."
    : "Entram aqui os produtos controlados que esgotaram, acabam em menos de 30 dias ou chegaram ao estoque mínimo.";
}

/**
 * Tabela do relatório de estoque baixo.
 *
 * O saldo sai ao lado do mínimo que VALE para o produto ("3 / 2") — o próprio,
 * ou o padrão da loja — e em vermelho: a pergunta do relatório é "quão
 * abaixo?". As colunas de giro (última venda e duração prevista) respondem à
 * pergunta seguinte, a que decide se vale repor.
 *
 * Na aba "Fora do controle" a linha diz por quê — o motivo de quem desligou ou o
 * giro baixo —, porque é isso que decide se vale religar.
 */
export function LowStockTable({
  scope,
  items,
  isLoading,
  search,
  setSearch,
  maxStock,
  setMaxStock,
  minRecentSales,
  setMinRecentSales,
  sort,
  onToggleSalesSort,
  page,
  totalPages,
  setPage,
  onComprar,
  onDisableStockControl,
  onEnableStockControl,
  onInactivate,
  mutatingProductId,
}: LowStockTableProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
      {/* Uma linha só no monitor; em tela estreita, a busca em cima e as quantidades embaixo. */}
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:justify-between">
        <div className="relative order-1 min-w-0 flex-1 lg:max-w-sm lg:flex-none lg:basis-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, código de barras ou grade..."
            className="pl-9"
            aria-label="Buscar produto"
          />
        </div>
        {/* `w-full` é o que joga as quantidades para a linha de baixo no estreito. */}
        <div className="order-3 flex w-full flex-wrap items-center gap-4 lg:w-auto">
          {/*
            Os dois campos ESTREITAM o relatório, nunca o abrem (12/09/2026).
            Antes o teto trocava o critério da tela por "quem tem menos de N
            unidades", e com isso ela deixava de responder à própria pergunta.
          */}
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
            Estoque menor que
            <Input
              type="number"
              min={1}
              step={1}
              value={maxStock}
              onChange={(event) => setMaxStock(event.target.value)}
              placeholder="mín."
              aria-label="Estoque menor que"
              className="h-9 w-24"
            />
          </label>
          {/*
            O filtro de saída separa "acabando e vende" de "acabando e está
            parado desde sempre" — o segundo é candidato a inativar, não a
            comprar.
          */}
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
            Vendeu ao menos
            <Input
              type="number"
              min={1}
              step={1}
              value={minRecentSales}
              onChange={(event) => setMinRecentSales(event.target.value)}
              placeholder="un."
              aria-label="Vendeu ao menos, em 30 dias"
              className="h-9 w-20"
            />
            em 30d
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500/60" />
          <p className="font-medium text-foreground">{tituloDoVazio(scope, maxStock, minRecentSales)}</p>
          <p className="mt-1 text-xs">
            {explicacaoDoVazio(scope, Boolean(maxStock.trim() || minRecentSales.trim()))}
          </p>
        </div>
      ) : (
        // Largura minima + rolagem: sem ela o navegador espreme as colunas para
        // caber, e a ultima — a das acoes — e a que perde espaco, deixando o
        // "Comprar" cortado. Com a largura minima a tela estreita ganha barra
        // horizontal, que e o comportamento previsivel. A largura minima cai
        // junto com as colunas escondidas: exigir 64rem de quatro colunas
        // devolveria a barra de rolagem que esconde-las veio tirar.
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table className="min-w-[44rem] 2xl:min-w-[64rem]">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Produto</TableHead>
                {/*
                  Abaixo de `2xl` saem fornecedor, saldo/mínimo e última venda —
                  mesmo tratamento da tela de Compras, e pela mesma razão: com as
                  sete colunas a tabela pede mais de 1.200px, e a área útil de um
                  notebook Full HD a 125% de zoom é de ~1.140px. O que caía fora
                  da tela era a ponta direita, ou seja, o botão "Comprar" e o
                  menu — as duas coisas que se veio fazer aqui. As três colunas
                  continuam a um clique, no produto e no XLSX; a barra de
                  rolagem não tinha atalho.
                */}
                <TableHead className="hidden px-4 py-3 2xl:table-cell">Fornecedor</TableHead>
                <TableHead className="hidden px-4 py-3 text-right 2xl:table-cell">Estoque / mín.</TableHead>
                <TableHead
                  className="hidden px-4 py-3 2xl:table-cell"
                  title="Última venda registrada, de toda a história"
                >
                  Última venda
                </TableHead>
                <TableHead className="px-1 py-1 text-right">
                  {/*
                    Cabeçalho clicável, e não um select de ordenação à parte: a
                    coluna é o próprio controle, que é onde a pessoa já está
                    olhando quando decide comparar quem vende mais.
                  */}
                  <button
                    type="button"
                    onClick={onToggleSalesSort}
                    title="Unidades vendidas nos últimos 30 dias. Clique para ordenar."
                    aria-label="Ordenar por vendas dos últimos 30 dias"
                    className="flex w-full items-center justify-end gap-1 rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    Vendas 30d
                    {sort === "RecentSalesDesc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-primary" />
                    ) : sort === "RecentSalesAsc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead
                  className="px-4 py-3 text-right"
                  title="Previsão de duração do saldo na demanda prevista — média ponderada dos três últimos meses"
                >
                  Dura
                </TableHead>
                <TableHead className="w-px whitespace-nowrap px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const mutating = mutatingProductId === item.productId;
                return (
                  <TableRow key={item.productId} data-testid="low-stock-row">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <ImageHoverZoom
                            src={buildPublicImageUrl(item.imageUrl)}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-md border border-border/50 bg-white object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                        {/*
                          Teto de ~40 caracteres com quebra de linha, em vez de
                          truncar: nome de produto aqui costuma passar de 60
                          caracteres com a variação, e uma coluna que cresce sem
                          limite empurra as demais para fora da tela. Cortar com
                          reticências esconderia justamente o fim do nome, que é
                          onde mora a variação que distingue duas linhas iguais.
                        */}
                        <div className="min-w-0 max-w-[40ch]">
                          <Link
                            href={productDetailHref(item.productGroupId)}
                            className="block break-words font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {item.productName}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">{item.barcode}</p>
                          {scope === "OutOfControl" && (
                            <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              {outOfControlLabel(item)}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-sm 2xl:table-cell">
                      {item.supplierName ?? "—"}
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-right font-mono text-sm 2xl:table-cell">
                      <span className="font-semibold text-destructive">{item.stock}</span>
                      <span
                        className="text-muted-foreground"
                        title={item.minStock > 0 ? "Mínimo próprio do produto" : "Mínimo padrão da loja"}
                      >
                        {" "}
                        / {item.effectiveMinStock ?? item.minStock}
                      </span>
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-sm 2xl:table-cell">
                      {item.lastSaleAt ? (
                        <span title={formatDate(item.lastSaleAt)}>{formatShortDate(item.lastSaleAt)}</span>
                      ) : (
                        <span className="text-muted-foreground">Nunca vendeu</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm">
                      {item.recentSales > 0 ? (
                        <span className="font-semibold text-foreground">{item.recentSales}</span>
                      ) : (
                        <span className="text-muted-foreground" title="Nenhuma venda nos últimos 30 dias">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`px-4 py-3 text-right text-sm ${duracaoTone(item.daysOfCover, item.stock)}`}
                    >
                      {/*
                        O título mostra a conta INTEIRA, e não só a média: "0,13
                        un./dia" sozinho não diz de onde saiu, e é esta coluna
                        que decide a ordem da lista e quem entra nela.
                      */}
                      <span title={tituloDaDuracao(item)}>
                        {duracaoLegivel(item.daysOfCover, item.stock)}
                      </span>
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap px-4 py-3 text-right">
                      <LowStockRowActions
                        item={item}
                        scope={scope}
                        mutating={mutating}
                        productHref={productDetailHref(item.productGroupId)}
                        onComprar={onComprar}
                        onDisableStockControl={onDisableStockControl}
                        onEnableStockControl={onEnableStockControl}
                        onInactivate={onInactivate}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
