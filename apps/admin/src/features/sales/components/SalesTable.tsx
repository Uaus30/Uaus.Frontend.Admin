import React from "react";
import { Eye, Loader2, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { formatDateInput, parseDateInput } from "@workspace/ui";
import { DateRangePicker, type DateRange } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { formatCurrency, formatDate } from "@workspace/core";
import type { EnrichedSale } from "../types";

type SalesTableProps = {
  /** True if list of transactions is loading */
  isLoading: boolean;
  /** Enriched sales dataset list */
  saleDetails: EnrichedSale[];
  /** Map of payment methods names */
  paymentMethodById: Record<number, string>;
  /** Current page index */
  page: number;
  /** Callback to update page index */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Paginated sale object from the API */
  salesPage: any;
  /** Callback to view specific sale detail by ID */
  onViewDetails: (id: number) => void;
  /** Callback to delete specific sale by ID */
  onDelete: (id: number) => void;
  /** Callback to reprint the receipt of a specific sale by ID */
  onPrintReceipt: (id: number) => void;
  /** Active sale ID being deleted, or null */
  deletingSaleId: number | null;
  /** Active sale ID having its receipt printed, or null */
  printingSaleId: number | null;
  /** Search string */
  search: string;
  /** Set search string */
  setSearch: (val: string) => void;
  /** Start date string */
  startDate: string;
  /** Set start date string */
  setStartDate: (val: string) => void;
  /** End date string */
  endDate: string;
  /** Set end date string */
  setEndDate: (val: string) => void;
  /** Payment method filter ID string */
  paymentMethodFilter: string;
  /** Set payment method filter ID string */
  setPaymentMethodFilter: (val: string) => void;
  /** Payment status filter ID string */
  paymentStatusFilter: string;
  /** Set payment status filter ID string */
  setPaymentStatusFilter: (val: string) => void;
  /** Payment methods options */
  paymentMethods: any[];
  /** Payment statuses options */
  paymentStatuses: any[];
};

/** Rótulo dos campos de filtro — mesmo padrão da barra de filtros dos logs. */
const FILTER_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * SalesTable
 *
 * Component rendering the grid table listing sales transactions, filter controls, and paging.
 */
export function SalesTable({
  isLoading,
  saleDetails,
  paymentMethodById,
  page,
  setPage,
  salesPage,
  onViewDetails,
  onDelete,
  onPrintReceipt,
  deletingSaleId,
  printingSaleId,
  search,
  setSearch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentMethodFilter,
  setPaymentMethodFilter,
  paymentStatusFilter,
  setPaymentStatusFilter,
  paymentMethods,
  paymentStatuses,
}: SalesTableProps) {
  // Guarda a venda inteira: o diálogo precisa do número, do valor e da
  // quantidade de itens para o operador conferir que é a linha certa antes de
  // apagar um lançamento que os relatórios do período já contam.
  const [saleToDelete, setSaleToDelete] = React.useState<EnrichedSale | null>(null);

  // O filtro trafega as datas como string (yyyy-MM-dd) até a API; o calendário
  // trabalha com Date. A conversão fica na borda, sem mexer no hook.
  const dateRange: DateRange = {
    from: parseDateInput(startDate),
    to: parseDateInput(endDate),
  };

  /** Aplica o período escolhido no calendário e volta para a primeira página. */
  function handleDateRangeChange(range: DateRange) {
    setStartDate(formatDateInput(range.from));
    setEndDate(formatDateInput(range.to));
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Campo de Busca */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[260px]">
            <Label className={FILTER_LABEL_CLASS}>Busca</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, produto ou observação..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          {/* Período de Datas */}
          <div className="flex flex-col gap-1.5 w-64">
            <Label className={FILTER_LABEL_CLASS}>Período</Label>
            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          </div>

          {/* Forma de Pagamento */}
          <div className="flex flex-col gap-1.5 w-[190px]">
            <Label className={FILTER_LABEL_CLASS}>Forma de Pagamento</Label>
            <Select
              value={paymentMethodFilter}
              onValueChange={(val) => {
                setPaymentMethodFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Forma de Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Formas Pagto</SelectItem>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.id} value={String(pm.id)}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Pagamento */}
          <div className="flex flex-col gap-1.5 w-[160px]">
            <Label className={FILTER_LABEL_CLASS}>Status Pagamento</Label>
            <Select
              value={paymentStatusFilter}
              onValueChange={(val) => {
                setPaymentStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Status Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {paymentStatuses.map((ps) => (
                  <SelectItem key={ps.id} value={String(ps.id)}>
                    {ps.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Pagamento</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : saleDetails.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  Nenhuma venda registrada.
                </td>
              </tr>
            ) : (
              saleDetails.map((sale) => (
                <tr key={sale.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                  <td className="px-6 py-4 font-mono font-medium text-muted-foreground">
                    #{sale.id.toString().padStart(4, "0")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatDate(sale.createdAt)}</td>
                  <td className="px-6 py-4 font-medium">
                    {sale.customerName || sale.customer?.name ? (
                      <div className="min-w-0">
                        <p className="truncate">{sale.customerName || sale.customer?.name}</p>
                        {sale.customerDocument && (
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {sale.customerDocument}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Consumidor Final</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(sale.payments?.length ?? 0) > 0 ? (
                        sale.payments!.map((payment) => (
                          <Badge key={payment.id} variant="outline" className="border-border/50 font-normal">
                            {payment.paymentMethodName || paymentMethodById[payment.paymentMethodId] || "—"}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="border-border/50 font-normal">
                          {sale.paymentMethodName ||
                            (sale.paymentMethodId ? paymentMethodById[sale.paymentMethodId] : null) ||
                            "Não informado"}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-primary">{formatCurrency(sale.total)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onViewDetails(sale.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onPrintReceipt(sale.id)}
                        disabled={printingSaleId === sale.id}
                        title="Reimprimir cupom"
                      >
                        {printingSaleId === sale.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => setSaleToDelete(sale)}
                      >
                        {deletingSaleId === sale.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <span>
          Mostrando página {salesPage?.page || 1} de{" "}
          {Math.ceil((salesPage?.total || 0) / (salesPage?.limit || 15)) || 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={salesPage ? salesPage.data.length < salesPage.limit : true}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={saleToDelete !== null}
        onOpenChange={(open) => !open && setSaleToDelete(null)}
        title="Remover esta venda e seus itens?"
        itemName={
          saleToDelete
            ? `Venda #${saleToDelete.id} — ${formatDate(saleToDelete.createdAt)} — ${formatCurrency(saleToDelete.total)}`
            : undefined
        }
        description={`A venda sai do histórico junto com ${saleToDelete?.items.length ?? 0} ${saleToDelete?.items.length === 1 ? "item" : "itens"}. Ela deixa de contar no faturamento, no lucro e nos relatórios do período. A ação não pode ser desfeita.`}
        confirmLabel="Sim, remover venda"
        destructive
        loading={saleToDelete !== null && deletingSaleId === saleToDelete.id}
        onConfirm={() => {
          if (saleToDelete) onDelete(saleToDelete.id);
        }}
      />
    </div>
  </div>
  );
}


