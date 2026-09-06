import {
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Loader2,
  MoreVertical,
  RotateCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "wouter";
import { Badge, Button, Input, Spinner, Switch } from "@workspace/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { formatDate, formatShortDate } from "@workspace/core";
import type { LowStockItem } from "../types";

type LowStockTableProps = {
  items: LowStockItem[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  maxStock: string;
  setMaxStock: (value: string) => void;
  includeResolved: boolean;
  setIncludeResolved: (value: boolean) => void;
  page: number;
  totalPages: number;
  setPage: (value: number) => void;
  /** Recebe o ITEM (não o id): o botão decide o que fazer pelo `hasOpenPurchase`. */
  onResolve: (item: LowStockItem) => void;
  onReopen: (productId: number) => void;
  onDisableStockControl: (item: LowStockItem) => void;
  mutatingProductId: number | null;
};

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

/** Cor da previsão: vermelho até uma semana, âmbar até três, neutro depois. */
function duracaoTone(days: number | null | undefined, stock: number): string {
  if (stock <= 0) return "font-semibold text-red-600 dark:text-red-400";
  if (days == null) return "text-muted-foreground";
  if (days <= 7) return "font-semibold text-red-600 dark:text-red-400";
  if (days <= 21) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

/**
 * Tabela do relatório de estoque baixo.
 *
 * O saldo sai ao lado do mínimo ("3 / 5") e em vermelho: a pergunta do
 * relatório é "quão abaixo?", e um número solto obrigaria a abrir o produto
 * para saber. As colunas de giro (última venda e duração prevista) respondem à
 * pergunta seguinte, a que decide se vale repor: um produto parado há um ano
 * com saldo 1 não é urgência.
 *
 * A linha resolvida fica esmaecida, com quem e quando, em vez de sumir — sumir
 * esconderia justamente a decisão que alguém tomou.
 */
export function LowStockTable({
  items,
  isLoading,
  search,
  setSearch,
  maxStock,
  setMaxStock,
  includeResolved,
  setIncludeResolved,
  page,
  totalPages,
  setPage,
  onResolve,
  onReopen,
  onDisableStockControl,
  mutatingProductId,
}: LowStockTableProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, código de barras ou grade..."
            className="pl-9"
            aria-label="Buscar produto"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/*
            Com o teto preenchido a pergunta do relatório muda: passa a ser
            "quem tem menos de N unidades", sem olhar o estoque mínimo — é como
            se varre o catálogo inteiro atrás do que está acabando.
          */}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={includeResolved}
              onCheckedChange={setIncludeResolved}
              aria-label="Mostrar resolvidos"
            />
            Mostrar resolvidos
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
          <p className="font-medium text-foreground">
            {maxStock.trim()
              ? `Nenhum produto com estoque menor que ${maxStock.trim()}.`
              : "Nenhum produto abaixo do mínimo."}
          </p>
          <p className="mt-1 text-xs">
            {maxStock.trim()
              ? "O teto de saldo ignora o estoque mínimo e alcança o catálogo inteiro."
              : "Só entram aqui produtos com estoque mínimo configurado (maior que zero) na aba Opcionais."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Produto</TableHead>
                <TableHead className="hidden px-4 py-3 xl:table-cell">Categoria</TableHead>
                <TableHead className="px-4 py-3">Fornecedor</TableHead>
                <TableHead className="px-4 py-3 text-right">Estoque / mín.</TableHead>
                <TableHead className="px-4 py-3" title="Última venda registrada, de toda a história">
                  Última venda
                </TableHead>
                <TableHead
                  className="px-4 py-3 text-right"
                  title="Previsão de duração do saldo no ritmo de venda dos últimos 90 dias"
                >
                  Dura
                </TableHead>
                <TableHead className="px-4 py-3">Situação</TableHead>
                <TableHead className="px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const mutating = mutatingProductId === item.productId;
                return (
                  <TableRow
                    key={item.productId}
                    data-testid="low-stock-row"
                    className={item.isResolved ? "opacity-60" : undefined}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={buildPublicImageUrl(item.imageUrl)}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 shrink-0 rounded-md border border-border/50 bg-white object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={productDetailHref(item.productGroupId)}
                            className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {item.productName}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">{item.barcode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-sm xl:table-cell">
                      {item.categoryName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{item.supplierName ?? "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm">
                      <span className="font-semibold text-destructive">{item.stock}</span>
                      <span className="text-muted-foreground"> / {item.minStock}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {item.lastSaleAt ? (
                        <span title={formatDate(item.lastSaleAt)}>{formatShortDate(item.lastSaleAt)}</span>
                      ) : (
                        <span className="text-muted-foreground">Nunca vendeu</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`px-4 py-3 text-right text-sm ${duracaoTone(item.daysOfCover, item.stock)}`}
                    >
                      <span title={`Média de ${item.averageDailySales ?? 0} un./dia nos últimos 90 dias`}>
                        {duracaoLegivel(item.daysOfCover, item.stock)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {item.isResolved ? (
                        <div>
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                            Resolvido
                          </Badge>
                          {item.resolvedAt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(item.resolvedAt)}
                              {item.resolvedBy ? ` · ${item.resolvedBy}` : ""}
                            </p>
                          )}
                        </div>
                      ) : item.hasOpenPurchase ? (
                        <Badge variant="outline" className="border-blue-500/40 text-blue-500">
                          Compra em aberto
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.isResolved ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={mutating}
                            onClick={() => onReopen(item.productId)}
                          >
                            {mutating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Reabrir
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={mutating}
                            onClick={() => onResolve(item)}
                            title={
                              item.hasOpenPurchase
                                ? "Já existe compra em aberto — confirma o alerta como resolvido"
                                : "Abre o pedido de compra deste produto"
                            }
                          >
                            {mutating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : item.hasOpenPurchase ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <ShoppingCart className="h-3.5 w-3.5" />
                            )}
                            Resolver
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Opções de ${item.productName}`}
                              disabled={mutating}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={productDetailHref(item.productGroupId)}>
                                <ExternalLink className="mr-2 h-4 w-4" /> Abrir produto
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDisableStockControl(item)}>
                              <SlidersHorizontal className="mr-2 h-4 w-4" /> Remover controle de estoque
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
