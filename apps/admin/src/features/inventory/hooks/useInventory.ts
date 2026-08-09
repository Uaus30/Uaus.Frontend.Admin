import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useGetInventoryReport, apiGet } from "@workspace/api-client-react";
import { getAllSuppliers } from "@/services/suppliers.service";
import { getAllCategories } from "@/services/categories.service";
import type { InventoryReport } from "../types";

/**
 * useInventory
 * 
 * Hook customizado para gerenciar estados de busca, filtros, paginação,
 * escala de visualização (zoom) e exportações de relatórios do inventário.
 */
export function useInventory() {
  const { toast } = useToast();

  // Estados dos filtros e paginação
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockStatus, setStockStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Escala de zoom visual da tabela
  const [zoomScale, setZoomScale] = useState(1.0);

  // Query: Busca o relatório de inventário paginado e filtrado
  const { data: report, isLoading, isFetching, isError, error } = useGetInventoryReport({
    search: debouncedSearch || undefined,
    supplierId: selectedSupplier !== "all" ? Number(selectedSupplier) : undefined,
    categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
    stockStatus: stockStatus !== "all" ? stockStatus : undefined,
    page,
    limit,
  });

  // Tratamento de erros de indisponibilidade do servidor
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

  // Query: Carrega lista completa de fornecedores para filtros
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-all-for-inventory"],
    queryFn: () => getAllSuppliers(),
  });

  // Query: Carrega lista completa de categorias para filtros
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-inventory"],
    queryFn: () => getAllCategories(),
  });

  // Funções de manipulação do zoom da tabela
  function handleZoomIn() {
    setZoomScale((prev) => Math.min(1.3, prev + 0.1));
  }

  function handleZoomOut() {
    setZoomScale((prev) => Math.max(0.7, prev - 0.1));
  }

  function handleResetZoom() {
    setZoomScale(1.0);
  }

  // Formatadores de valores
  function formatCurrency(val: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  }

  function formatPercent(val: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(val / 100);
  }

  const formatShortDate = (date: Date) => {
    return date.toISOString().slice(0, 10);
  };

  /**
   * Executa a exportação do inventário atual para um arquivo CSV estruturado compatível com Excel.
   */
  async function handleExportExcel() {
    try {
      toast({ title: "Preparando exportação", description: "Buscando todos os registros filtrados..." });

      // Busca todos os registros sem limite de paginação (tamanho estendido)
      const result = await apiGet<any>("/Inventory", {
        search: search || undefined,
        supplierId: selectedSupplier !== "all" ? Number(selectedSupplier) : undefined,
        categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
        stockStatus: stockStatus !== "all" ? stockStatus : undefined,
        page: 1,
        size: 100000,
      });

      // GET /Inventory devolve InventoryReportDto: o campo `items` é um
      // PagedResult ({ items: [...], pagination: {...} }), não um array.
      const items = Array.isArray(result.items) ? result.items : result.items?.items ?? [];
      if (items.length === 0) {
        toast({
          title: "Erro na exportação",
          description: "Não há registros correspondentes aos filtros selecionados para exportar.",
          variant: "warning" as any,
        });
        return;
      }

      // Constrói CSV estruturado com separador e BOM UTF-8
      let csvContent = "\ufeff";
      csvContent += "Produto;Cód. Barras;Fornecedor;Categoria;Estoque;Custo Unit.;Venda Unit.;Custo Total;Mercadoria;Lucro Est.;Margem Est.\r\n";

      items.forEach((item: any) => {
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
        // A margem divide por mercadoria; com mercadoria 0 o resultado seria NaN.
        const margin = mercadoria > 0 ? (estProfit / mercadoria) * 100 : 0;

        csvContent +=
          `"${name.replace(/"/g, '""')}";` +
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
      link.setAttribute("download", `Inventario_Produtos_${formatShortDate(new Date())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Exportado", description: "Planilha gerada com sucesso!" });
    } catch (err: any) {
      toast({
        title: "Erro na exportação",
        description: err?.message || "Erro desconhecido.",
        variant: "destructive",
      });
    }
  }

  return {
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
    limit,
    setLimit,
    zoomScale,
    report,
    isLoading,
    isFetching,
    suppliers,
    categories,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    formatCurrency,
    formatPercent,
    handleExportExcel,
  };
}
