import { CheckCircle2, ExternalLink, ImageIcon, Loader2, RotateCcw, Search } from "lucide-react";
import { Link } from "wouter";
import { Badge, Button, Input, Spinner, Switch } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@workspace/core";
import type { LowStockItem } from "../types";

type LowStockTableProps = {
  items: LowStockItem[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  includeResolved: boolean;
  setIncludeResolved: (value: boolean) => void;
  page: number;
  totalPages: number;
  setPage: (value: number) => void;
  onResolve: (productId: number) => void;
  onReopen: (productId: number) => void;
  mutatingProductId: number | null;
};

/** Caminho do detalhe do produto — o id é o do GRUPO, que é o que a tela edita. */
function productDetailHref(productGroupId: number): string {
  return `/produtos/${productGroupId}/detalhes`;
}

/**
 * Tabela do relatório de estoque baixo.
 *
 * O saldo sai ao lado do mínimo ("3 / 5") e em vermelho: a pergunta do
 * relatório é "quão abaixo?", e um número solto obrigaria a abrir o produto para
 * saber. A linha resolvida fica esmaecida, com quem e quando, em vez de sumir —
 * sumir esconderia justamente a decisão que alguém tomou.
 */
export function LowStockTable({
  items,
  isLoading,
  search,
  setSearch,
  includeResolved,
  setIncludeResolved,
  page,
  totalPages,
  setPage,
  onResolve,
  onReopen,
  mutatingProductId,
}: LowStockTableProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, código de barras ou grade..."
            className="pl-9"
            aria-label="Buscar produto"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={includeResolved}
            onCheckedChange={setIncludeResolved}
            aria-label="Mostrar resolvidos"
          />
          Mostrar resolvidos
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500/60" />
          <p className="font-medium text-foreground">Nenhum produto abaixo do mínimo.</p>
          <p className="mt-1 text-xs">
            Só entram aqui produtos com estoque mínimo configurado (maior que zero) na aba Opcionais.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Produto</TableHead>
                <TableHead className="px-4 py-3">Categoria</TableHead>
                <TableHead className="px-4 py-3">Fornecedor</TableHead>
                <TableHead className="px-4 py-3 text-right">Estoque / mín.</TableHead>
                <TableHead className="px-4 py-3 text-right">Preço</TableHead>
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
                    <TableCell className="px-4 py-3 text-sm">{item.categoryName}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{item.supplierName ?? "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm">
                      <span className="font-semibold text-destructive">{item.stock}</span>
                      <span className="text-muted-foreground"> / {item.minStock}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm">
                      {formatCurrency(item.price)}
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
                      ) : (
                        <Badge variant="destructive">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild type="button" variant="ghost" size="sm" className="gap-1">
                          <Link href={productDetailHref(item.productGroupId)} aria-label="Abrir produto">
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </Link>
                        </Button>
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
                            onClick={() => onResolve(item.productId)}
                          >
                            {mutating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Resolver
                          </Button>
                        )}
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
