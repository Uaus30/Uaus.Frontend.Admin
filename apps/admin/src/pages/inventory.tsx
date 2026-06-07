import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  useGetInventoryReport, 
  apiGet 
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getAllSuppliers } from "@/services/suppliers.service";
import { getAllCategories } from "@/services/categories.service";
import { 
  Search, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertTriangle, 
  Filter, 
  Loader2, 
  ZoomIn, 
  ZoomOut,
  Maximize2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";

export default function Inventory() {
  const { toast } = useToast();
  
  // Filters state
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockStatus, setStockStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  // Table zoom scale state (Premium visual feature matching sample HTML zoom buttons)
  const [zoomScale, setZoomScale] = useState(1.0);

  // Fetch report
  const { data: report, isLoading, isFetching, isError, error } = useGetInventoryReport({
    search: search || undefined,
    supplierId: selectedSupplier !== "all" ? Number(selectedSupplier) : undefined,
    categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
    stockStatus: stockStatus !== "all" ? stockStatus : undefined,
    page,
    limit
  });

  useEffect(() => {
    if (isError && error) {
      const apiError = error as any;
      if (apiError.status >= 500) {
        toast({
          title: "Servidor indisponível",
          description: "O servidor está indisponível no momento. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    }
  }, [isError, error, toast]);

  // Fetch all suppliers and categories for the dropdown filters
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-all-for-inventory"],
    queryFn: () => getAllSuppliers()
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-inventory"],
    queryFn: () => getAllCategories()
  });

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(1.3, prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => Math.max(0.7, prev - 0.1));
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val / 100);
  };

  // Export to CSV/Excel format (semicolon delimited with UTF-8 BOM)
  const handleExportExcel = async () => {
    try {
      toast({ title: "Preparando exportação", description: "Buscando todos os registros filtrados..." });
      
      // Fetch all pages (limit = 100000 to get everything under the current filter)
      const result = await apiGet<any>("/Inventory", {
        search: search || undefined,
        supplierId: selectedSupplier !== "all" ? Number(selectedSupplier) : undefined,
        categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
        stockStatus: stockStatus !== "all" ? stockStatus : undefined,
        page: 1,
        size: 100000
      });

      const items = result.items || result.Items?.items || [];
      if (items.length === 0) {
        toast({ title: "Erro na exportação", description: "Não há registros correspondentes aos filtros selecionados para exportar.", variant: "warning" as any });
        return;
      }

      // Generate CSV string with semicolon delimiter and headers
      let csvContent = "\ufeff"; // UTF-8 BOM
      csvContent += "Produto;Cód. Barras;Fornecedor;Categoria;Estoque;Custo Unit.;Venda Unit.;Custo Total;Mercadoria;Lucro Est.;Margem Est.\r\n";

      items.forEach((item: any) => {
        // Resolve supplier
        const supName = item.supplierName || "Não informado";
        const catName = item.categoryName || "";
        const name = item.productName || "";
        const barcode = item.barcode || "";
        const stock = item.stock || 0;
        const unitCost = item.unitCost || 0;
        const unitSale = item.unitSale || 0;
        const totalCost = stock * unitCost;
        const mercadoria = stock * unitSale;
        const estProfit = mercadoria - totalCost;
        const margin = unitSale > 0 ? (estProfit / mercadoria) * 100 : 0;

        csvContent += `"${name.replace(/"/g, '""')}";` +
                     `"${barcode}";` +
                     `"${supName.replace(/"/g, '""')}";` +
                     `"${catName.replace(/"/g, '""')}";` +
                     `${stock};` +
                     `${unitCost.toString().replace(".", ",")};` +
                     `${unitSale.toString().replace(".", ",")};` +
                     `${totalCost.toString().replace(".", ",")};` +
                     `${mercadoria.toString().replace(".", ",")};` +
                     `${estProfit.toString().replace(".", ",")};` +
                     `${margin.toFixed(1).replace(".", ",")}%` +
                     "\r\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Inventario_Produtos_${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Exportado", description: "Planilha gerada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err?.message || "Erro desconhecido.", variant: "destructive" });
    }
  };

  // Helper date function
  const format = (date: Date, pattern: string) => {
    return date.toISOString().slice(0, 10);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Inventário de Produtos</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-4xl">
              <strong className="text-primary">Sobre este relatório:</strong> Mostra apenas produtos com controle de estoque ativado e pelo menos 1 unidade em estoque. Produtos sem controle, serviços e itens zerados não aparecem aqui. Os valores de mercadoria (preço de venda), custo e lucro estimado são calculados sobre o estoque atual.
            </p>
          </div>
          <Button 
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white hover-elevate gap-2 shrink-0 self-start sm:self-center"
            disabled={isLoading}
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar Planilha
          </Button>
        </div>

        {/* Global metrics cards */}
        {isLoading && !report ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse bg-muted/20 border-border/40 h-28" />
            ))}
          </div>
        ) : report ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-start border-primary border-3 bg-card/60 hover-elevate">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Produtos em Estoque</span>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mt-2">{report.metrics.totalProductsWithControl}</h3>
                  <p className="text-2xs text-muted-foreground mt-1">com controle ativo</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-start border-info border-3 bg-card/60 hover-elevate">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Unidades em Estoque</span>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mt-2">{report.metrics.totalUnits.toLocaleString("pt-BR")}</h3>
                  <p className="text-2xs text-muted-foreground mt-1">unidades físicas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-start border-success border-3 bg-card/60 hover-elevate">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Valor em Mercadoria</span>
                <div>
                  <h3 className="text-2xl font-bold text-emerald-500 mt-2">{formatCurrency(report.metrics.totalValueMerchandise)}</h3>
                  <p className="text-2xs text-muted-foreground mt-1">preço de venda</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-start border-warning border-3 bg-card/60 hover-elevate">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Valor em Custo</span>
                <div>
                  <h3 className="text-2xl font-bold text-amber-500 mt-2">{formatCurrency(report.metrics.totalValueCost)}</h3>
                  <p className="text-2xs text-muted-foreground mt-1">capital investido</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-start border-success border-3 bg-card/60 hover-elevate">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Lucro Estimado</span>
                <div>
                  <h3 className="text-2xl font-bold text-emerald-500 mt-2">{formatCurrency(report.metrics.totalEstimatedProfit)}</h3>
                  <p className="text-2xs text-emerald-500/80 font-medium mt-1">Margem: {formatPercent(report.metrics.marginPercentage)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Categories summary & Alert Boxes */}
        {report && report.categorySummaries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Report Card */}
            <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Resumo por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="max-h-60 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {report.categorySummaries.slice(0, 10).map((cat, i) => (
                    <div key={i} className="flex flex-col gap-1 p-3 rounded-lg border border-border/30 bg-muted/10">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold truncate max-w-[150px]">{cat.categoryName}</span>
                        <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {formatPercent(cat.percentageOfTotalValue)} do total
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-2xs text-muted-foreground mt-2 border-t border-border/20 pt-2">
                        <div>Produtos: <strong className="text-foreground">{cat.productsCount}</strong></div>
                        <div>Unidades: <strong className="text-foreground">{cat.unitsCount}</strong></div>
                        <div>Venda: <strong className="text-emerald-500">{formatCurrency(cat.merchandiseValue)}</strong></div>
                        <div>Lucro est.: <strong className="text-emerald-500">{formatCurrency(cat.estimatedProfit)}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Alert Box Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Alertas do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-500">Produtos sem Estoque</h4>
                    <p className="text-lg font-bold text-red-600 mt-1">{report ? report.metrics.alertsNoStock : 0}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-500">Estoque Baixo (Alerta)</h4>
                    <p className="text-lg font-bold text-amber-600 mt-1">{report ? report.metrics.alertsLowStock : 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Table */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Listagem Geral</CardTitle>
                <CardDescription>Produtos cadastrados com estoque ativo.</CardDescription>
              </div>

              {/* Zoom buttons & info */}
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

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar nome ou código..." 
                  className="pl-8 h-9"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <Select value={selectedSupplier} onValueChange={(val) => { setSelectedSupplier(val); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Fornecedor: Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Fornecedores: Todos</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Categoria: Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Categorias: Todas</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockStatus} onValueChange={(val) => { setStockStatus(val); setPage(1); }}>
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
            {isLoading || (isError && (error as any)?.status >= 500) ? (
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
                    {report.items.data.map((item) => {
                      const isLow = item.stock <= 0; // Check alert status
                      return (
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Controls */}
            {report && report.items && report.items.totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-4" style={{ marginTop: `${zoomScale > 1 ? (zoomScale - 1) * 300 + 16 : 16}px` }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">Página {page} de {report.items.totalPages}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === report.items.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
