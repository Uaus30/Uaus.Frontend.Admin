import React from "react";
import { Filter, Maximize2, Search, ZoomIn, ZoomOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import type { InventoryReport } from "../types";

type InventoryTableProps = {
  /** Textual search query for product name/code */
  search: string;
  /** Callback triggered when search text changes */
  setSearch: (val: string) => void;
  /** Selected supplier ID filter string or "all" */
  selectedSupplier: string;
  /** Callback triggered when supplier filter changes */
  setSelectedSupplier: (val: string) => void;
  /** Selected category ID filter string or "all" */
  selectedCategory: string;
  /** Callback triggered when category filter changes */
  setSelectedCategory: (val: string) => void;
  /** Selected stock status filter string or "all" */
  stockStatus: string;
  /** Callback triggered when stock status filter changes */
  setStockStatus: (val: string) => void;
  /** Current page index */
  page: number;
  /** Callback to update page index */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Visual zoom scale factor */
  zoomScale: number;
  /** Callback to increase visual scale */
  handleZoomIn: () => void;
  /** Callback to decrease visual scale */
  handleZoomOut: () => void;
  /** Callback to reset visual scale to 100% */
  handleResetZoom: () => void;
  /** List of suppliers options */
  suppliers: any[];
  /** List of categories options */
  categories: any[];
  /** True if data query is loading */
  isLoading: boolean;
  /** True if error occurred on fetch */
  isError: boolean;
  /** Server response containing inventory list and page counters */
  report: any;
  /** Callback to format numeric value as currency (BRL) */
  formatCurrency: (val: number) => string;
  /** Callback to format numeric value as percentage */
  formatPercent: (val: number) => string;
};

/**
 * InventoryTable
 * 
 * Component rendering the tabular product stock list, filters, and scale zoom controls.
 */
export function InventoryTable({
  search,
  setSearch,
  selectedSupplier,
  setSelectedSupplier,
  selectedCategory,
  setSelectedCategory,
  stockStatus,
  setStockStatus,
  page,
  setPage,
  zoomScale,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  suppliers,
  categories,
  isLoading,
  isError,
  report,
  formatCurrency,
  formatPercent,
}: InventoryTableProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Listagem Geral</CardTitle>
            <CardDescription>Produtos cadastrados com estoque ativo.</CardDescription>
          </div>

          <div className="flex items-center gap-1 bg-muted/20 border border-border/40 p-1 rounded-lg self-end lg:self-center">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Diminuir zoom">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-2xs font-semibold px-2 font-mono">{Math.round(zoomScale * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetZoom} title="Restaurar zoom">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Aumentar zoom">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou código..."
              className="pl-8 h-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={selectedSupplier}
            onValueChange={(val) => {
              setSelectedSupplier(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Fornecedor: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Fornecedores: Todos</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedCategory}
            onValueChange={(val) => {
              setSelectedCategory(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Categoria: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Categorias: Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={stockStatus}
            onValueChange={(val) => {
              setStockStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Estoque: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Filtro de Estoque: Todos</SelectItem>
              <SelectItem value="ok">Normal / Suficiente</SelectItem>
              <SelectItem value="low">Alerta / Estoque Baixo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading || isError ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : !report?.items?.data || report.items.data.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum produto em estoque corresponde aos filtros aplicados.</p>
          </div>
        ) : (
          <div
            className="overflow-x-auto border border-border/40 rounded-xl transition-all duration-200"
            style={{ transform: `scale(${zoomScale})`, transformOrigin: "top left", width: `${100 / zoomScale}%` }}
          >
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-4 py-3">Produto</TableHead>
                  <TableHead className="px-4 py-3">Cód. Barras</TableHead>
                  <TableHead className="px-4 py-3">Fornecedor</TableHead>
                  <TableHead className="px-4 py-3">Categoria</TableHead>
                  <TableHead className="px-4 py-3 text-center w-24">Estoque</TableHead>
                  <TableHead className="px-4 py-3 text-right">Custo Unit.</TableHead>
                  <TableHead className="px-4 py-3 text-right">Venda Unit.</TableHead>
                  <TableHead className="px-4 py-3 text-right">Custo Total</TableHead>
                  <TableHead className="px-4 py-3 text-right">Mercadoria</TableHead>
                  <TableHead className="px-4 py-3 text-right">Lucro Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.data.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="px-4 py-3 font-semibold text-sm truncate max-w-[200px]" title={item.productName}>
                      {item.productName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs font-mono">{item.barcode || "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">{item.supplierName}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{item.categoryName}</TableCell>
                    <TableCell className="px-4 py-3 text-sm font-bold text-center">
                      {item.stock} UN
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.unitCost)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-medium text-emerald-500">{formatCurrency(item.unitSale)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-semibold text-amber-500">{formatCurrency(item.totalCost)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-bold text-emerald-500">{formatCurrency(item.mercadoria)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right">
                      <span className="flex flex-col items-end">
                        <span className="font-bold text-emerald-500">{formatCurrency(item.estimatedProfit)}</span>
                        <span className="text-2xs text-muted-foreground font-semibold">{formatPercent(item.marginPercentage)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {report && report.items && report.items.totalPages > 1 && (
          <div
            className="flex items-center justify-end gap-2 mt-4"
            style={{ marginTop: `${zoomScale > 1 ? (zoomScale - 1) * 300 + 16 : 16}px` }}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              Página {page} de {report.items.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === report.items.totalPages}
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


