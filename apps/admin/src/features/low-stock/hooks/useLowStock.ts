import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError, toDateKey } from "@workspace/core";
import {
  apiGetOrThrow,
  disableStockControl,
  enableStockControl,
  getGetLowStockQueryKey,
  inactivateProduct,
  useGetLowStock,
  type LowStockScope,
  type LowStockSort,
  type StockControlDisabledReason,
} from "@workspace/api-client-react";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { newPurchaseForProductPath } from "@/features/purchases/purchases-route";
import { exportLowStockToXlsx } from "../lib/export-low-stock";
import type { LowStockItem } from "../types";

/** Linhas por página do relatório. */
export const PAGE_SIZE = 20;

/** Teto de linhas que a exportação baixa de uma vez. */
const EXPORT_PAGE_SIZE = 1000;

/**
 * As ações do menu que mexem no cadastro. Desligar e inativar perguntam antes;
 * religar não — ele só devolve o produto ao controle, e o mesmo menu desfaz.
 */
export type LowStockAction = "disable-control" | "inactivate" | "enable-control";

/**
 * A confirmação pendente da tela.
 *
 * Guarda o ITEM, e não só um booleano, porque o texto do diálogo cita o produto
 * — "tem certeza?" sozinho obriga a lembrar em qual linha se clicou —, a AÇÃO e,
 * ao desligar o controle, o MOTIVO escolhido no diálogo (29/09/2026).
 */
export type LowStockConfirm = {
  item: LowStockItem;
  action: LowStockAction;
  reason?: StockControlDisabledReason | null;
};

export interface LowStockState {
  /** Qual lista: o que precisa de reposição ou o que está fora do controle. */
  scope: LowStockScope;
  setScope: (value: LowStockScope) => void;
  search: string;
  setSearch: (value: string) => void;
  /**
   * Teto de saldo digitado, como texto — campo vazio é "sem filtro", e guardar
   * número obrigaria a decidir o que fazer com o vazio a cada tecla.
   */
  maxStock: string;
  setMaxStock: (value: string) => void;
  /** Mínimo de vendas em 30 dias, como texto — mesmo motivo do teto de saldo. */
  minRecentSales: string;
  setMinRecentSales: (value: string) => void;
  /** Ordem da lista. `Default` é por duração, com os esgotados primeiro. */
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
  /** Botão "Comprar" da linha: leva ao pedido de compra já preenchido. */
  comprar: (item: LowStockItem) => void;
  /** Pede confirmação (e o motivo) antes de desligar o controle de estoque. */
  askDisableStockControl: (item: LowStockItem) => void;
  /** O motivo escolhido no diálogo de desligar. */
  setConfirmReason: (reason: StockControlDisabledReason | null) => void;
  /** Religa o controle de estoque — a ação da aba "Fora do controle". */
  enableStockControl: (item: LowStockItem) => void;
  /** Pede confirmação antes de inativar o produto. */
  askInactivate: (item: LowStockItem) => void;
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
 * Quem registra que a reposição foi encaminhada é a **compra**; quem registra
 * que ela chegou é a **entrada de estoque**. O botão da linha é só **Comprar**,
 * e some enquanto houver compra em aberto do produto.
 *
 * ## O que tira um produto do relatório (29/09/2026)
 *
 * Uma **entrada de estoque** que leve o saldo a durar mais de trinta dias tira
 * sozinha; o **giro baixo** (menos de 1 por mês, pela mediana) também — é a
 * rotina diária do backend. Do menu saem as outras duas portas: **desligar o
 * controle de estoque**, com motivo, que manda o produto para a aba "Fora do
 * controle", de onde se religa; e **inativar o produto**, que o tira também da
 * venda.
 *
 * ## A tela abre no critério do relatório, sem filtro semeado (12/09/2026)
 *
 * Os dois campos chegam vazios: o critério do backend já responde à pergunta
 * sozinho, e semear filtro esconderia justamente o que ele alcança.
 */
export function useLowStock(): LowStockState {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [scope, setScopeState] = useState<LowStockScope>("Restock");
  const [search, setSearchState] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [maxStock, setMaxStockState] = useState("");
  const [minRecentSales, setMinRecentSalesState] = useState("");
  const debouncedMaxStock = useDebounce(maxStock, 400);
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
    scope: scope === "Restock" ? undefined : scope,
  };

  const list = useGetLowStock({ ...listParams, page, limit: PAGE_SIZE });
  useApiErrorToast(list.isError, list.error);

  /** Troca de aba volta à primeira página; os filtros continuam valendo. */
  function setScope(value: LowStockScope) {
    setScopeState(value);
    setPage(1);
  }

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
   * padrão — sem o terceiro, quem ordenasse por venda uma vez perderia a ordem
   * por duração até recarregar a tela.
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
   * Invalida o PREFIXO do recurso: as duas abas, todas as páginas e a contagem
   * de uma vez. Sem isso o relatório atualizaria e o alerta do painel
   * continuaria vermelho até um F5.
   */
  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: getGetLowStockQueryKey() });
  }

  /**
   * As ações do menu numa mutação só: o ciclo é o mesmo — grava, invalida o
   * prefixo, avisa — e mutações separadas duplicariam o `onSuccess`, o
   * `onError` e a conta do `mutatingProductId`, que é onde a divergência nasce.
   */
  const confirmMutation = useMutation({
    mutationFn: ({ item, action, reason }: LowStockConfirm) =>
      action === "inactivate"
        ? inactivateProduct(item.productId)
        : action === "enable-control"
          ? enableStockControl(item.productId)
          : disableStockControl(item.productId, reason),
    onSuccess: async (_data, { action }) => {
      await invalidate();
      setConfirm(null);
      toast(TOAST_DE_SUCESSO[action]);
    },
    onError: (error: unknown, { action }) => {
      toast({
        title: TITULO_DE_ERRO[action],
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    },
  });

  /**
   * Leva ao pedido de compra do produto, preenchido — a quantidade sugerida sai
   * da demanda prevista (`suggestedRestockQuantity`, na tela de Compras).
   */
  function comprar(item: LowStockItem) {
    navigate(newPurchaseForProductPath(item.productId) + supplierQuery(item));
  }

  function confirmAction() {
    if (!confirm) return;

    confirmMutation.mutate(confirm);
  }

  /**
   * Baixa a aba inteira (com os filtros da tela) e gera o XLSX. Refaz a consulta
   * em vez de usar a página em memória: ninguém exporta um relatório para
   * receber as vinte linhas da página corrente.
   */
  async function exportToXlsx() {
    setIsExporting(true);
    try {
      const result = await apiGetOrThrow<{ items?: LowStockItem[] }>("/LowStock", {
        search: listParams.search,
        maxStock: listParams.maxStock,
        minRecentSales: listParams.minRecentSales,
        sort: listParams.sort,
        scope: listParams.scope,
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

      const nome = scope === "OutOfControl" ? "fora-do-controle" : "estoque-baixo";
      await exportLowStockToXlsx(items, `${nome}-${toDateKey(new Date())}.xlsx`);
      toast({ title: "Planilha gerada", description: `${items.length} produto(s) exportado(s).` });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const mutatingProductId = confirmMutation.isPending
    ? (confirmMutation.variables?.item.productId ?? null)
    : null;

  return {
    scope,
    setScope,
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
    comprar,
    askDisableStockControl: (item) => setConfirm({ item, action: "disable-control", reason: null }),
    setConfirmReason: (reason) => setConfirm((atual) => (atual ? { ...atual, reason } : atual)),
    enableStockControl: (item) => confirmMutation.mutate({ item, action: "enable-control" }),
    askInactivate: (item) => setConfirm({ item, action: "inactivate" }),
    confirm,
    cancelConfirm: () => setConfirm(null),
    confirmAction,
    isConfirming: confirmMutation.isPending,
    mutatingProductId,
    exportToXlsx: () => void exportToXlsx(),
    isExporting,
  };
}

/** O aviso de cada ação que deu certo. */
const TOAST_DE_SUCESSO: Record<LowStockAction, { title: string; description: string }> = {
  inactivate: {
    title: "Produto inativado",
    description: "Ele sai do relatório e da venda, e continua no catálogo com o saldo que tem.",
  },
  "disable-control": {
    title: "Controle de estoque desligado",
    description:
      'O produto sai do relatório e do alerta, e fica na aba "Fora do controle", de onde se religa.',
  },
  "enable-control": {
    title: "Controle de estoque religado",
    description: "O produto volta a ser acompanhado e aparece aqui quando precisar de compra.",
  },
};

const TITULO_DE_ERRO: Record<LowStockAction, string> = {
  inactivate: "Erro ao inativar o produto",
  "disable-control": "Erro ao desligar o controle de estoque",
  "enable-control": "Erro ao religar o controle de estoque",
};

/**
 * O texto digitado vira filtro só se for inteiro positivo: campo vazio, zero e
 * lixo digitado voltam ao relatório inteiro, e um dígito errado não pode
 * esvaziar a tela.
 */
function filtroInteiro(texto: string): number | undefined {
  const numero = Number(texto);
  return texto.trim() && Number.isInteger(numero) && numero > 0 ? numero : undefined;
}

/** Fornecedor do último lote na URL da compra, quando o produto tem um. */
function supplierQuery(item: LowStockItem): string {
  return item.supplierId ? `&fornecedor=${item.supplierId}` : "";
}
