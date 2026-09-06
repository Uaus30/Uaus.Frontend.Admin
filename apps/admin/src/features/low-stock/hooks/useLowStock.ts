import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  apiGetOrThrow,
  disableStockControl,
  getGetLowStockQueryKey,
  reopenLowStock,
  resolveLowStock,
  useGetLowStock,
  useGetLowStockSummary,
  type LowStockSort,
} from "@workspace/api-client-react";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { newPurchaseForProductPath } from "@/features/purchases/purchases-route";
import { salesFilterFromUrl } from "../low-stock-route";
import { exportLowStockToXlsx } from "../lib/export-low-stock";
import type { LowStockItem, LowStockSummary } from "../types";

/** Linhas por página do relatório. */
export const PAGE_SIZE = 20;

/** Teto de linhas que a exportação baixa de uma vez. */
const EXPORT_PAGE_SIZE = 1000;

/** Confirmação aberta na tela: resolver mesmo, ou desligar o controle. */
export type LowStockConfirm =
  { kind: "resolve"; item: LowStockItem } | { kind: "disable-control"; item: LowStockItem };

export interface LowStockState {
  search: string;
  setSearch: (value: string) => void;
  /**
   * Teto de saldo digitado, como texto — campo vazio é "sem filtro", e guardar
   * número obrigaria a decidir o que fazer com o vazio a cada tecla.
   */
  maxStock: string;
  setMaxStock: (value: string) => void;
  /**
   * Mínimo de vendas em 30 dias, como texto — mesmo motivo do teto de saldo:
   * campo vazio é "sem filtro".
   */
  minRecentSales: string;
  setMinRecentSales: (value: string) => void;
  /** Ordem da lista. `Default` é o mais crítico primeiro. */
  sort: LowStockSort;
  /** Clique no cabeçalho de "Vendas 30d": mais vendido → menos vendido → padrão. */
  toggleSalesSort: () => void;
  includeResolved: boolean;
  setIncludeResolved: (value: boolean) => void;
  page: number;
  setPage: (value: number) => void;
  totalPages: number;
  total: number;
  items: LowStockItem[];
  isLoading: boolean;
  isFetching: boolean;
  summary: LowStockSummary | undefined;
  /** Botão "Resolver" da linha: leva à compra, ou pede confirmação. Ver o JSDoc do hook. */
  resolve: (item: LowStockItem) => void;
  reopen: (productId: number) => void;
  /** Pede confirmação antes de desligar o controle de estoque do produto. */
  askDisableStockControl: (item: LowStockItem) => void;
  /** Confirmação aberta, ou `null`. */
  confirm: LowStockConfirm | null;
  cancelConfirm: () => void;
  confirmAction: () => void;
  isConfirming: boolean;
  /** Produto cuja marca está sendo gravada agora — a linha mostra o spinner. */
  mutatingProductId: number | null;
  exportToXlsx: () => void;
  isExporting: boolean;
}

/**
 * Relatório de estoque baixo: lista, giro, contagem e as ações da linha.
 *
 * ## Resolver é registrar a compra
 *
 * Desde 06/09/2026 o botão "Resolver" não marca nada sozinho. A reposição é um
 * fluxo com dependência: um alerta só está tratado quando existe um **pedido de
 * compra** para o produto.
 *
 * - **Sem compra em aberto** (`hasOpenPurchase === false`): a tela navega para
 *   Compras com o formulário já preenchido (produto, último fornecedor,
 *   situação Pendente) e avisa em laranja que o pedido precisa ser registrado.
 *   Nada é marcado como resolvido — marcar aqui esconderia o vermelho sem que
 *   ninguém tivesse comprado nada.
 * - **Com compra em aberto**: pergunta antes e, confirmando, marca como
 *   resolvido. A compra já encaminha a reposição; o alerta cumpriu o papel.
 *
 * ## O que tira um produto do relatório
 *
 * Uma **entrada de estoque** que leve o saldo acima do mínimo tira sozinha: o
 * critério é avaliado a cada consulta, e a mesma entrada ainda derruba a marca
 * de resolvido no backend. **Remover o controle de estoque** (mínimo zero)
 * também tira, e é a saída para o item que não se quer acompanhar.
 */
export function useLowStock(): LowStockState {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search, setSearchState] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [maxStock, setMaxStockState] = useState("");
  const debouncedMaxStock = useDebounce(maxStock, 400);
  // Quem chega pelo alerta ja abre filtrado por saida: o alerta fala de "boa
  // saida e pouco estoque", e cair numa lista de outro criterio obrigaria a
  // reconstruir na mao o que o alerta ja sabia. Lido UMA vez — o campo continua
  // editavel, e apagar nao pode fazer o filtro voltar.
  const [minRecentSales, setMinRecentSalesState] = useState(salesFilterFromUrl);
  const debouncedMinRecentSales = useDebounce(minRecentSales, 400);
  const [sort, setSortState] = useState<LowStockSort>("Default");
  const [includeResolved, setIncludeResolvedState] = useState(false);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<LowStockConfirm | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const listParams = {
    includeResolved,
    search: debouncedSearch || undefined,
    maxStock: filtroInteiro(debouncedMaxStock),
    minRecentSales: filtroInteiro(debouncedMinRecentSales),
    sort: sort === "Default" ? undefined : sort,
  };

  const list = useGetLowStock({ ...listParams, page, limit: PAGE_SIZE });
  useApiErrorToast(list.isError, list.error);

  const summary = useGetLowStockSummary();

  function setSearch(value: string) {
    setSearchState(value);
    setPage(1);
  }

  function setMaxStock(value: string) {
    setMaxStockState(value);
    setPage(1);
  }

  function setMinRecentSales(value: string) {
    setMinRecentSalesState(value);
    setPage(1);
  }

  /**
   * Três estados no mesmo cabeçalho: mais vendido, menos vendido e de volta ao
   * padrão.
   *
   * O terceiro clique existe porque a ordem padrão (o mais crítico primeiro) é
   * a razão de ser do relatório — sem ele, quem ordenasse por venda uma vez
   * perderia o padrão até recarregar a tela.
   */
  function toggleSalesSort() {
    setSortState((atual) =>
      atual === "RecentSalesDesc"
        ? "RecentSalesAsc"
        : atual === "RecentSalesAsc"
          ? "Default"
          : "RecentSalesDesc",
    );
    setPage(1);
  }

  function setIncludeResolved(value: boolean) {
    setIncludeResolvedState(value);
    setPage(1);
  }

  /**
   * Invalida o PREFIXO do recurso: lista (todas as páginas e filtros) e
   * contagem de uma vez. Sem isso o relatório atualizaria e o alerta do painel
   * continuaria vermelho até um F5.
   */
  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: getGetLowStockQueryKey() });
  }

  const resolveMutation = useMutation({
    mutationFn: (productId: number) => resolveLowStock(productId),
    onSuccess: async () => {
      await invalidate();
      setConfirm(null);
      toast({
        title: "Alerta resolvido",
        description: "O produto sai do alerta até a próxima entrada de estoque.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao resolver o alerta",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (productId: number) => reopenLowStock(productId),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Alerta reaberto", description: "O produto voltou a contar como pendente." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao reabrir o alerta",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const disableControlMutation = useMutation({
    mutationFn: (productId: number) => disableStockControl(productId),
    onSuccess: async () => {
      await invalidate();
      setConfirm(null);
      toast({
        title: "Controle de estoque removido",
        description: "O produto sai do relatório e do alerta, e continua no catálogo.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao remover o controle de estoque",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });

  /** Ver o JSDoc do hook: sem compra em aberto, resolver é registrar o pedido. */
  function resolve(item: LowStockItem) {
    if (item.hasOpenPurchase) {
      setConfirm({ kind: "resolve", item });
      return;
    }

    toast({
      title: "Registre o pedido de compra",
      description: `${item.productName} ainda não tem compra em aberto. Resolver o alerta é encaminhar a reposição.`,
      variant: "warning",
    });
    navigate(newPurchaseForProductPath(item.productId) + supplierQuery(item));
  }

  function askDisableStockControl(item: LowStockItem) {
    setConfirm({ kind: "disable-control", item });
  }

  function confirmAction() {
    if (!confirm) return;

    if (confirm.kind === "resolve") resolveMutation.mutate(confirm.item.productId);
    else disableControlMutation.mutate(confirm.item.productId);
  }

  /**
   * Baixa o relatório inteiro (com os filtros da tela) e gera o XLSX.
   *
   * A exportação refaz a consulta em vez de usar a página em memória: a tela
   * mostra vinte linhas, e ninguém exporta um relatório para receber a página
   * corrente.
   */
  async function exportToXlsx() {
    setIsExporting(true);
    try {
      const result = await apiGetOrThrow<{ items?: LowStockItem[] }>("/LowStock", {
        includeResolved: listParams.includeResolved,
        search: listParams.search,
        maxStock: listParams.maxStock,
        minRecentSales: listParams.minRecentSales,
        sort: listParams.sort,
        page: 1,
        size: EXPORT_PAGE_SIZE,
      });

      const items = result.items ?? [];
      if (items.length === 0) {
        toast({
          title: "Nada para exportar",
          description: "Nenhum produto corresponde aos filtros desta tela.",
          variant: "warning",
        });
        return;
      }

      const hoje = new Date().toISOString().slice(0, 10);
      await exportLowStockToXlsx(items, `estoque-baixo-${hoje}.xlsx`);
      toast({ title: "Planilha gerada", description: `${items.length} produto(s) exportado(s).` });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const mutatingProductId = resolveMutation.isPending
    ? (resolveMutation.variables ?? null)
    : reopenMutation.isPending
      ? (reopenMutation.variables ?? null)
      : disableControlMutation.isPending
        ? (disableControlMutation.variables ?? null)
        : null;

  return {
    search,
    setSearch,
    maxStock,
    setMaxStock,
    minRecentSales,
    setMinRecentSales,
    sort,
    toggleSalesSort,
    includeResolved,
    setIncludeResolved,
    page,
    setPage,
    totalPages: list.data?.totalPages ?? 1,
    total: list.data?.total ?? 0,
    items: list.data?.data ?? [],
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    summary: summary.data,
    resolve,
    reopen: (productId) => reopenMutation.mutate(productId),
    askDisableStockControl,
    confirm,
    cancelConfirm: () => setConfirm(null),
    confirmAction,
    isConfirming: resolveMutation.isPending || disableControlMutation.isPending,
    mutatingProductId,
    exportToXlsx: () => void exportToXlsx(),
    isExporting,
  };
}

/**
 * O texto digitado vira filtro só se for inteiro positivo.
 *
 * Campo vazio, zero e lixo digitado voltam ao padrão do relatório: "menos de
 * zero unidades" e "vendeu ao menos zero" não são perguntas, e um dígito errado
 * não pode esvaziar a tela.
 */
function filtroInteiro(texto: string): number | undefined {
  const numero = Number(texto);
  return texto.trim() && Number.isInteger(numero) && numero > 0 ? numero : undefined;
}

/** Fornecedor do último lote na URL da compra, quando o produto tem um. */
function supplierQuery(item: LowStockItem): string {
  return item.supplierId ? `&fornecedor=${item.supplierId}` : "";
}
