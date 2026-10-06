import React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { formatDateInput, parseDateInput } from "@workspace/ui";
import { type DateRange } from "@workspace/ui";
import { TablePagination } from "@workspace/ui";
import { formatCurrency, formatDate } from "@workspace/core";
import type { SaleDto, UiPagedResult } from "@workspace/api-client-react";
import { SALES_PAGE_SIZE } from "../hooks/useSales";
import type { EnrichedSale } from "../types";
import { SalesFilters } from "./SalesFilters";
import { SaleRowActions } from "./SaleRowActions";

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
  /**
   * Página de vendas devolvida pela API. `undefined` enquanto a primeira busca
   * não volta — nesse intervalo o rodapé não tem total e não se desenha.
   */
  salesPage: UiPagedResult<SaleDto> | undefined;
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

/** As formas de pagamento da venda — na coluna (computador) e embaixo do cliente (celular). */
function PaymentBadges({
  sale,
  paymentMethodById,
}: {
  sale: EnrichedSale;
  paymentMethodById: Record<number, string>;
}) {
  if ((sale.payments?.length ?? 0) > 0) {
    return (
      <>
        {sale.payments!.map((payment) => (
          <Badge key={payment.id} variant="outline" className="border-border/50 font-normal">
            {payment.paymentMethodName || paymentMethodById[payment.paymentMethodId] || "—"}
          </Badge>
        ))}
      </>
    );
  }
  return (
    <Badge variant="outline" className="border-border/50 font-normal">
      {sale.paymentMethodName ||
        (sale.paymentMethodId ? paymentMethodById[sale.paymentMethodId] : null) ||
        "Não informado"}
    </Badge>
  );
}

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
      <SalesFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        paymentMethodFilter={paymentMethodFilter}
        onPaymentMethodChange={(value) => {
          setPaymentMethodFilter(value);
          setPage(1);
        }}
        paymentStatusFilter={paymentStatusFilter}
        onPaymentStatusChange={(value) => {
          setPaymentStatusFilter(value);
          setPage(1);
        }}
        paymentMethods={paymentMethods}
        paymentStatuses={paymentStatuses}
      />

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="hidden px-6 py-4 lg:table-cell">ID</th>
                <th className="hidden px-6 py-4 lg:table-cell">Data</th>
                <th className="px-3 py-3 lg:px-6 lg:py-4">Cliente</th>
                <th className="hidden px-6 py-4 lg:table-cell">Pagamento</th>
                <th className="px-3 py-3 lg:px-6 lg:py-4">Total</th>
                <th className="px-2 py-3 text-right lg:px-6 lg:py-4">Ações</th>
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
                  // A linha inteira abre a venda: no celular o olho era o único
                  // caminho, e ficava além da borda direita da tela.
                  <tr
                    key={sale.id}
                    onClick={() => {
                      // Quem arrasta o mouse para copiar o nome ou o CPF não quer
                      // abrir a venda: o `mouseup` da seleção também é um clique.
                      if (window.getSelection()?.toString()) return;
                      onViewDetails(sale.id);
                    }}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/20"
                  >
                    <td className="hidden px-6 py-4 font-mono font-medium text-muted-foreground lg:table-cell">
                      #{sale.id.toString().padStart(4, "0")}
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-4 lg:table-cell">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-3 py-3 font-medium lg:px-6 lg:py-4">
                      {/* Celular e tablet: número e data em cima do cliente, e as
                          formas de pagamento embaixo — as colunas somem
                          (convenção "esconder coluna, nunca rolar"). */}
                      <p className="mb-0.5 font-mono text-xs font-normal text-muted-foreground lg:hidden">
                        #{sale.id.toString().padStart(4, "0")} · {formatDate(sale.createdAt)}
                      </p>
                      {sale.customerName || sale.customer?.name ? (
                        <div className="min-w-0">
                          <p
                            className="break-words lg:max-w-[16rem] lg:truncate"
                            title={sale.customerName || sale.customer?.name || undefined}
                          >
                            {sale.customerName || sale.customer?.name}
                          </p>
                          {sale.customerDocument && (
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {sale.customerDocument}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Consumidor Final</span>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1 lg:hidden">
                        <PaymentBadges sale={sale} paymentMethodById={paymentMethodById} />
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        <PaymentBadges sale={sale} paymentMethodById={paymentMethodById} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-primary lg:px-6 lg:py-4">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-2 py-3 text-right lg:px-6 lg:py-4">
                      <SaleRowActions
                        saleId={sale.id}
                        printing={printingSaleId === sale.id}
                        deleting={deletingSaleId === sale.id}
                        onView={() => onViewDetails(sale.id)}
                        onPrint={() => onPrintReceipt(sale.id)}
                        onDelete={() => setSaleToDelete(sale)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* O "Próxima" era decidido por `data.length < limit`: com o total
            múltiplo exato da página, a última vinha cheia, o botão ficava
            liberado e o operador caía numa página vazia. O rodapé unificado
            decide pelo total. */}
        <TablePagination
          className="border-t border-border/50 p-4"
          page={page}
          pageSize={salesPage?.limit || SALES_PAGE_SIZE}
          total={salesPage?.total ?? 0}
          onPageChange={setPage}
          itemLabel={{ singular: "venda", plural: "vendas" }}
        />

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
