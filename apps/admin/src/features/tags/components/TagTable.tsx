import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Edit2, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EnrichedTag } from "../types";
import type { SortBy, SortDir } from "../hooks/useTags";

type SortIconProps = {
  active: boolean;
  direction: SortDir;
};

/**
 * SortIcon
 * 
 * Renders the sorting direction indicator next to table headers.
 */
function SortIcon({ active, direction }: SortIconProps) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3 text-primary" />
  );
}

type TagTableProps = {
  /** Textual search query */
  search: string;
  /** Callback triggered when search input changes */
  setSearch: (val: string) => void;
  /** Active sort column */
  sortBy: SortBy;
  /** Active sort direction */
  sortDir: SortDir;
  /** Callback to trigger or toggle sorting on a column */
  toggleSort: (col: SortBy) => void;
  /** Current page index */
  page: number;
  /** Callback triggered when page changes */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Number of items displayed per page */
  limit: number;
  /** Callback triggered when page size limit changes */
  setLimit: (limit: number) => void;
  /** List of enriched tags to display */
  tagsWithCount: EnrichedTag[];
  /** Pagination payload response from the API */
  tagPage: any;
  /** Loading state indicator */
  isLoading: boolean;
  /** Callback to open creation (no args) or edit modal */
  onOpenModal: (tag?: EnrichedTag) => void;
  /** Callback to open tag analytics report dialog */
  onOpenReport: (tagId: number) => void;
  /** Callback to delete tag by ID */
  onDelete: (tagId: number) => void;
};

/**
 * TagTable
 * 
 * Component for listing tags in a tabular form, supporting sorting, searching, and pagination.
 */
export function TagTable({
  search,
  setSearch,
  sortBy,
  sortDir,
  toggleSort,
  page,
  setPage,
  limit,
  setLimit,
  tagsWithCount,
  tagPage,
  isLoading,
  onOpenModal,
  onOpenReport,
  onDelete,
}: TagTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="flex gap-3 border-b border-border/50 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="bg-background pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="cursor-pointer px-6 py-4 hover:text-foreground" onClick={() => toggleSort("name")}>
                Etiqueta <SortIcon active={sortBy === "name"} direction={sortDir} />
              </th>
              <th className="cursor-pointer px-6 py-4 hover:text-foreground" onClick={() => toggleSort("productCount")}>
                Qtd Produtos <SortIcon active={sortBy === "productCount"} direction={sortDir} />
              </th>
              <th className="cursor-pointer px-6 py-4 hover:text-foreground" onClick={() => toggleSort("createdAt")}>
                Data Cadastro <SortIcon active={sortBy === "createdAt"} direction={sortDir} />
              </th>
              <th className="px-6 py-4">Exibir no site</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : tagsWithCount.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  Nenhuma etiqueta encontrada.
                </td>
              </tr>
            ) : (
              tagsWithCount.map((tag) => (
                <tr key={tag.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: tag.color }} />
                      <span style={{ color: tag.color }} className="font-semibold">
                        {tag.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Mockado
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(tag.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        tag.isPublic
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tag.isPublic ? "Ligado" : "Desligado"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-border/50 hover-elevate"
                        onClick={() => onOpenReport(tag.id)}
                      >
                        <BarChart3 className="mr-2 h-4 w-4 text-primary" /> Relatório
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onOpenModal(tag)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => {
                          if (confirm("Remover esta etiqueta?")) {
                            void onDelete(tag.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Itens por página:</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              setLimit(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">Total: {tagPage?.total || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <span className="px-2 text-xs">
            {page} / {Math.max(1, Math.ceil((tagPage?.total || 0) / limit))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.max(1, Math.ceil((tagPage?.total || 0) / limit))}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
