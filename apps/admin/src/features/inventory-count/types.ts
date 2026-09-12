import type { InventoryCountDto, InventoryCountItemDto } from "@workspace/api-client-react";

/** Filtro de situação da lista. O padrão da tela é `pending`. */
export type InventoryCountStatusFilter = "pending" | "reviewed" | "all";

/**
 * Quanto da foto do cadastro está faltando.
 *
 * São três estados e não dois porque grupo com variações pode estar pela
 * metade — e "metade das variações sem foto" é atenção, não defeito resolvido
 * nem cadastro inteiro no escuro. Segue o vocabulário de cores do
 * `Uaus.Docs/dominio/convencoes-de-interface.md`: âmbar é parcial, vermelho é
 * negativo.
 */
export type PhotoCoverage = "complete" | "missing";

/** Estado que a aba de conferência expõe para os componentes. */
export interface InventoryCountState {
  /** Conferência em andamento, ou `null` quando não há nenhuma. */
  count: InventoryCountDto | null;
  isLoadingCount: boolean;

  items: InventoryCountItemDto[];
  total: number;
  isLoadingItems: boolean;
  isFetchingItems: boolean;

  search: string;
  setSearch: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  statusFilter: InventoryCountStatusFilter;
  setStatusFilter: (value: InventoryCountStatusFilter) => void;
  onlyWithoutImage: boolean;
  setOnlyWithoutImage: (value: boolean) => void;

  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;

  categories: { id: number; name: string }[];

  /** Abre a conferência e tira o snapshot do catálogo. */
  start: () => void;
  isStarting: boolean;

  /** Encerra antes de conferir tudo. Passa pela confirmação da tela. */
  askFinish: () => void;
  finishAsked: boolean;
  cancelFinish: () => void;
  confirmFinish: () => void;
  isFinishing: boolean;

  /** Marca ou desmarca um cadastro. */
  review: (productGroupId: number, reviewed: boolean) => void;
  /** Grupo cuja marcação está em voo, para a linha mostrar o estado. */
  reviewingGroupId: number | null;

  /** Leva à tela de detalhe do produto, de onde a correção é feita. */
  openProduct: (productGroupId: number) => void;
}
