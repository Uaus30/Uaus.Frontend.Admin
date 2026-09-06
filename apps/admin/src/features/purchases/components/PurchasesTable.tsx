import {
  ExternalLink,
  ImageIcon,
  Loader2,
  MoreVertical,
  PackageCheck,
  Pencil,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { Link } from "wouter";
import { Button, Input, Spinner } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui";
import { PURCHASE_STATUS, buildPublicImageUrl, enumCode } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage, formatShortDate } from "@workspace/core";
import type { PurchaseDto } from "../types";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";

type PurchasesTableProps = {
  items: PurchaseDto[];
  isLoading: boolean;
  searchValue: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  page: number;
  totalPages: number;
  setPage: (value: number) => void;
  onEdit: (purchase: PurchaseDto) => void;
  onDelete: (id: number) => void;
  onSetStatus: (id: number, status: number) => void;
  onReceive: (purchase: PurchaseDto) => void;
  mutatingId: number | null | undefined;
};

/**
 * Listagem de compras.
 *
 * A coluna de valor mostra o total FINAL com o percentual de desconto ou
 * acréscimo ao lado: é o número que o operador confere contra o extrato, e o
 * bruto sozinho esconderia o frete ou o desconto que fecham a conta.
 */
export function PurchasesTable({
  items,
  isLoading,
  searchValue,
  setSearch,
  statusFilter,
  setStatusFilter,
  page,
  totalPages,
  setPage,
  onEdit,
  onDelete,
  onSetStatus,
  onReceive,
  mutatingId,
}: PurchasesTableProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por produto, fornecedor ou detalhe..."
            className="pl-9"
            aria-label="Buscar compra"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Situação">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value={String(PURCHASE_STATUS.Pending)}>Pendente</SelectItem>
            <SelectItem value={String(PURCHASE_STATUS.InTransit)}>A caminho</SelectItem>
            <SelectItem value={String(PURCHASE_STATUS.Received)}>Lançado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Truck className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p>Nenhuma compra registrada neste recorte.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Produto</TableHead>
                <TableHead className="px-4 py-3">Fornecedor</TableHead>
                <TableHead className="px-4 py-3 text-right">Qtd.</TableHead>
                <TableHead className="px-4 py-3 text-right">Total final</TableHead>
                <TableHead className="px-4 py-3 text-right">Unit. final</TableHead>
                <TableHead className="px-4 py-3">Situação</TableHead>
                <TableHead className="px-4 py-3">Data</TableHead>
                <TableHead className="w-16 px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((purchase) => {
                const status = enumCode(purchase.status, PURCHASE_STATUS);
                const received = status === PURCHASE_STATUS.Received;
                const busy = mutatingId === purchase.id;
                const cover = purchase.images[0];
                return (
                  <TableRow key={purchase.id} data-testid="purchase-row">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {cover ? (
                          <img
                            src={buildPublicImageUrl(cover.url)}
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
                          {purchase.productGroupId ? (
                            <Link
                              href={`/produtos/${purchase.productGroupId}/detalhes`}
                              className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {purchase.productName}
                            </Link>
                          ) : (
                            <p className="truncate font-medium text-foreground">
                              {purchase.productName}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                (produto novo)
                              </span>
                            </p>
                          )}
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {purchase.productBarcode ?? purchase.details ?? ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{purchase.supplierName}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm">
                      {purchase.quantity}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm">
                      <span className="font-semibold">{formatCurrency(purchase.finalTotal)}</span>
                      {purchase.adjustmentPercent !== 0 && (
                        <span
                          className={`ml-1 text-xs ${purchase.adjustmentPercent < 0 ? "text-emerald-600" : "text-amber-600"}`}
                        >
                          ({purchase.adjustmentPercent > 0 ? "+" : ""}
                          {formatPercentage(purchase.adjustmentPercent)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm">
                      {formatCurrency(purchase.unitFinal)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <PurchaseStatusBadge status={purchase.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatShortDate(purchase.receivedAt ?? purchase.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!received && (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => onReceive(purchase)}
                            disabled={busy}
                          >
                            <PackageCheck className="h-3.5 w-3.5" /> Lançar recebimento
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Opções da compra ${purchase.id}`}
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {purchase.purchaseLink && (
                              <DropdownMenuItem asChild>
                                <a href={purchase.purchaseLink} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir link da compra
                                </a>
                              </DropdownMenuItem>
                            )}
                            {!received && status !== PURCHASE_STATUS.InTransit && (
                              <DropdownMenuItem
                                onClick={() => onSetStatus(purchase.id, PURCHASE_STATUS.InTransit)}
                              >
                                <Truck className="mr-2 h-4 w-4" /> Marcar como a caminho
                              </DropdownMenuItem>
                            )}
                            {!received && status !== PURCHASE_STATUS.Pending && (
                              <DropdownMenuItem
                                onClick={() => onSetStatus(purchase.id, PURCHASE_STATUS.Pending)}
                              >
                                <Truck className="mr-2 h-4 w-4" /> Voltar para pendente
                              </DropdownMenuItem>
                            )}
                            {!received && (
                              <DropdownMenuItem onClick={() => onEdit(purchase)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                            )}
                            {!received && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(purchase.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            )}
                            {received && <DropdownMenuItem disabled>Lançada — sem ações</DropdownMenuItem>}
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
