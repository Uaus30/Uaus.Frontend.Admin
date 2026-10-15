import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useDebounce } from "@workspace/ui";
import { useGetLowStock, type LowStockParams, type SupplierDto } from "@workspace/api-client-react";
import { useAllSuppliers } from "@/hooks/use-catalog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { newPurchaseForProductPath } from "@/features/purchases/purchases-route";
import { positiveIntegerFilter, quantityQuery, supplierQuery } from "../lib/low-stock-params";
import { supplierCityOptions, type CityOption } from "../lib/shopping-list";
import type { LowStockItem } from "../types";
import { useLowStockExport } from "./useLowStockExport";

/** Linhas por página da Lista de Compras. */
export const SHOPPING_LIST_PAGE_SIZE = 20;

/** Valor dos seletores de fornecedor e de cidade que não filtra nada. Sublinhado para não colidir com chave de cidade. */
export const ALL_OPTION = "__all";

/** Lista vazia estável: um `[]` novo a cada render derrubaria o `useMemo` das cidades. */
const NO_SUPPLIERS: SupplierDto[] = [];

export interface ShoppingListState {
  /** Id do fornecedor escolhido, como texto, ou {@link ALL_OPTION}. */
  supplierId: string;
  setSupplierId: (value: string) => void;
  /** Todos os fornecedores, com a Shopee primeiro e o resto em ordem alfabética. */
  supplierOptions: SupplierDto[];
  /** Chave da cidade escolhida (sem acento e sem caixa), ou {@link ALL_OPTION}. */
  city: string;
  setCity: (value: string) => void;
  /** As cidades cadastradas nos fornecedores, uma vez cada. */
  cityOptions: CityOption[];
  search: string;
  setSearch: (value: string) => void;
  /** Mínimo de vendas em 30 dias, como texto — vazio é "sem filtro". */
  minRecentSales: string;
  setMinRecentSales: (value: string) => void;
  /** A caixa "Incluir os com compra a caminho". Desmarcada por padrão. */
  includePurchasesInTransit: boolean;
  setIncludePurchasesInTransit: (value: boolean) => void;
  page: number;
  setPage: (value: number) => void;
  totalPages: number;
  total: number;
  items: LowStockItem[];
  isLoading: boolean;
  isFetching: boolean;
  /** Botão "Comprar": o pedido de compra do produto, já preenchido. */
  comprar: (item: LowStockItem) => void;
  exportToXlsx: () => void;
  isExporting: boolean;
}

/**
 * A Lista de Compras (14/10/2026): o que vale comprar na próxima viagem ou no
 * próximo pedido.
 *
 * É o `GET /LowStock` com `scope=ShoppingList` — o backend decide quem entra:
 * produtos com boa saída que esgotaram, duram menos de 30 dias ou chegaram ao
 * mínimo, tanto os controlados quanto os que ficaram fora do controle com o
 * motivo "Planejar viagem" (compra pequena de atacado ou varejo). Mora na
 * feature do estoque baixo porque é o mesmo recurso da API, e uma feature nova
 * teria de importar desta — o que o repositório proíbe.
 *
 * Os filtros que a tela acrescenta são os da viagem: **fornecedor** e **cidade**
 * do fornecedor do lote mais recente. A cidade vai como o seletor a mostra; o
 * backend compara sem acento e sem caixa. Os dois combinam (E), e todo filtro
 * volta à página 1 no próprio setter.
 */
export function useShoppingList(): ShoppingListState {
  const [, navigate] = useLocation();

  const [supplierId, setSupplierIdState] = useState(ALL_OPTION);
  const [city, setCityState] = useState(ALL_OPTION);
  const [search, setSearchState] = useState("");
  const [minRecentSales, setMinRecentSalesState] = useState("");
  const [includePurchasesInTransit, setIncludePurchasesInTransitState] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);
  const debouncedMinRecentSales = useDebounce(minRecentSales, 400);
  const exporter = useLowStockExport();

  const { data: suppliers = NO_SUPPLIERS } = useAllSuppliers();
  const cityOptions = useMemo(() => supplierCityOptions(suppliers), [suppliers]);

  const listParams: LowStockParams = {
    scope: "ShoppingList",
    search: debouncedSearch || undefined,
    minRecentSales: positiveIntegerFilter(debouncedMinRecentSales),
    supplierId: supplierId === ALL_OPTION ? undefined : Number(supplierId),
    // O RÓTULO, não a chave: a chave é só a identidade da opção no seletor.
    city: cityOptions.find((option) => option.value === city)?.label,
    // Falso é o padrão do backend: só vai marcado.
    includePurchasesInTransit: includePurchasesInTransit || undefined,
  };

  const list = useGetLowStock({ ...listParams, page, limit: SHOPPING_LIST_PAGE_SIZE });
  useApiErrorToast(list.isError, list.error);

  /** Cada filtro volta à página 1 aqui, e não num efeito: a página 3 do recorte anterior pode não existir. */
  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return {
    supplierId,
    setSupplierId: resetPage(setSupplierIdState),
    supplierOptions: suppliers,
    city,
    setCity: resetPage(setCityState),
    cityOptions,
    search,
    setSearch: resetPage(setSearchState),
    minRecentSales,
    setMinRecentSales: resetPage(setMinRecentSalesState),
    includePurchasesInTransit,
    setIncludePurchasesInTransit: resetPage(setIncludePurchasesInTransitState),
    page,
    setPage,
    totalPages: list.data?.totalPages ?? 1,
    total: list.data?.total ?? 0,
    items: list.data?.data ?? [],
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    // A mesma navegação do relatório de estoque baixo: produto e último fornecedor na URL.
    comprar: (item) =>
      navigate(newPurchaseForProductPath(item.productId) + supplierQuery(item) + quantityQuery(item)),
    exportToXlsx: () => void exporter.exportToXlsx(listParams, "lista-de-compras", "Lista de Compras"),
    isExporting: exporter.isExporting,
  };
}
