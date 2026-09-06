import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  apiGetOrThrow,
  disableStockControl,
  getGetLowStockQueryKey,
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

/**
 * A única confirmação da tela: desligar o controle de estoque do produto.
 *
 * Continua sendo um objeto, e não um booleano, porque o texto do diálogo cita o
 * PRODUTO — "tem certeza?" sozinho obriga a lembrar em qual linha se clicou.
 */
export type LowStockConfirm = { item: LowStockItem };

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
  page: number;
  setPage: (value: number) => void;
  totalPages: number;
  total: number;
  items: LowStockItem[];
  isLoading: boolean;
  isFetching: boolean;
  summary: LowStockSummary | undefined;
  /** Botão "Comprar" da linha: leva ao pedido de compra já preenchido. */
  comprar: (item: LowStockItem) => void;
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
 * Relatório de estoque baixo: lista, giro e as ações da linha.
 *
 * ## A tela não guarda estado (06/09/2026)
 *
 * Não há mais "resolvido" por item. Quem registra que a reposição foi
 * encaminhada é a **compra**; quem registra que ela chegou é a **entrada de
 * estoque**. Uma marca de "já tratei" duplicava os dois registros e podia
 * contradizê-los — e, sendo manual, envelhecia sozinha.
 *
 * O botão da linha é só **Comprar**: leva a Compras com o formulário
 * preenchido (produto, último fornecedor, situação Pendente). Ele aparece
 * enquanto **não** existe compra em aberto do produto; havendo uma, o pedido
 * já está feito e não há nada a fazer daqui.
 *
 * ## O que tira um produto do relatório
 *
 * Uma **entrada de estoque** que leve o saldo acima do mínimo tira sozinha: o
 * critério é avaliado a cada consulta, e nada precisa ser dado baixa na lista.
 * **Remover o controle de estoque** (mínimo zero) também tira, e é a saída para
 * o item que não se quer acompanhar.
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
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<LowStockConfirm | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const listParams = {
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

  /**
   * Invalida o PREFIXO do recurso: lista (todas as páginas e filtros) e
   * contagem de uma vez. Sem isso o relatório atualizaria e o alerta do painel
   * continuaria vermelho até um F5.
   */
  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: getGetLowStockQueryKey() });
  }

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

  /**
   * Leva ao pedido de compra do produto, preenchido.
   *
   * Sem aviso nenhum: o botão se chama "Comprar" e a tela de destino é o
   * formulário de compra — um toast dizendo o que acabou de acontecer só pede
   * para ser dispensado.
   */
  function comprar(item: LowStockItem) {
    navigate(newPurchaseForProductPath(item.productId) + supplierQuery(item));
  }

  function askDisableStockControl(item: LowStockItem) {
    setConfirm({ item });
  }

  function confirmAction() {
    if (!confirm) return;

    disableControlMutation.mutate(confirm.item.productId);
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

  const mutatingProductId = disableControlMutation.isPending
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
    page,
    setPage,
    totalPages: list.data?.totalPages ?? 1,
    total: list.data?.total ?? 0,
    items: list.data?.data ?? [],
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    summary: summary.data,
    comprar,
    askDisableStockControl,
    confirm,
    cancelConfirm: () => setConfirm(null),
    confirmAction,
    isConfirming: disableControlMutation.isPending,
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
