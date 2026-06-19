import React from "react";
import { Calendar, Eye, Receipt, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";

type StockEntriesTableProps = {
  /** The paginated entries data returned from API */
  entriesData: any;
  /** True if list query is loading */
  isLoadingEntries: boolean;
  /** List of suppliers options */
  suppliers: any[];
  /** Selected supplier filter ID string or "all" */
  selectedSupplierFilter: string;
  /** Callback triggered when supplier filter changes */
  setSelectedSupplierFilter: (val: string) => void;
  /** Current page index */
  page: number;
  /** Callback to update page index */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Callback to view specific entry detail by ID */
  onViewDetails: (id: number) => void;
  /** Callback to format numeric values as currency (BRL) */
  formatCurrency: (val: number) => string;
  /** Callback to format date string to pt-BR format */
  formatShortDate: (dateStr: string) => string;
};

/**
 * StockEntriesTable
 * 
 * Component rendering the list of stock entries with filtering.
 */
export function StockEntriesTable({
  entriesData,
  isLoadingEntries,
  suppliers,
  selectedSupplierFilter,
  setSelectedSupplierFilter,
  page,
  setPage,
  onViewDetails,
  formatCurrency,
  formatShortDate,
}: StockEntriesTableProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">Histórico de Entradas</CardTitle>
            <CardDescription>Visualize todas as notas e registros de estoque.</CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedSupplierFilter} onValueChange={setSelectedSupplierFilter}>
              <SelectTrigger className="w-full md:w-[200px] h-9">
                <SelectValue placeholder="Filtrar por Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingEntries ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : !entriesData?.data || entriesData.data.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma entrada de estoque encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border/40 rounded-xl">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-4 py-3">Código/ID</TableHead>
                  <TableHead className="px-4 py-3">Data de Entrada</TableHead>
                  <TableHead className="px-4 py-3">Fornecedor</TableHead>
                  <TableHead className="px-4 py-3">Nº da Nota</TableHead>
                  <TableHead className="px-4 py-3 text-right">Valor Total</TableHead>
                  <TableHead className="px-4 py-3 text-right w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesData.data.map((entry: any) => {
                  const sup = suppliers.find((s) => s.id === entry.supplierId);
                  return (
                    <TableRow key={entry.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="px-4 py-3 font-medium font-mono text-xs">#{entry.id}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatShortDate(entry.entryDate)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-medium">
                        {sup?.name || "Não informado"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-mono">{entry.invoiceNumber || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-sm font-semibold text-right text-emerald-500">
                        {formatCurrency(entry.total)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onViewDetails(entry.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {entriesData && entriesData.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {entriesData.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === entriesData.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
