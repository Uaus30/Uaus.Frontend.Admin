import React from "react";
import { BarChart3, Edit2, Folder, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { EnrichedCategory, Department } from "../types";

type CategoryTableProps = {
  /** Loading state flag */
  isLoading: boolean;
  /** Current search input string */
  search: string;
  /** Callback triggered when search input changes */
  setSearch: (val: string) => void;
  /** Current page index */
  page: number;
  /** Callback triggered when page index changes */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Active department filter ID string or "all" */
  departmentFilter: string;
  /** Callback triggered when department filter selection changes */
  setDepartmentFilter: (val: string) => void;
  /** List of all departments for filter dropdown options */
  departments: Department[];
  /** Categories page payload response from backend */
  categoriesPage: any;
  /** Enriched category array to display in table rows */
  categoriesWithDepartment: EnrichedCategory[];
  /** Callback to trigger modal opening for creation (no arguments) or editing */
  onOpenModal: (category?: EnrichedCategory) => void;
  /** Callback to trigger report analytics display modal */
  onOpenReport: (categoryId: number) => void;
  /** Callback to delete category by ID */
  onDelete: (categoryId: number) => void;
};

/**
 * CategoryTable
 * 
 * Renders the search filters, tabular grid of categories, and paginator.
 */
export function CategoryTable({
  isLoading,
  search,
  setSearch,
  page,
  setPage,
  departmentFilter,
  setDepartmentFilter,
  departments,
  categoriesPage,
  categoriesWithDepartment,
  onOpenModal,
  onOpenReport,
  onDelete,
}: CategoryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      {/* Filters bar */}
      <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row">
        <Input
          placeholder="Buscar categoria..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="bg-background sm:max-w-sm"
        />
        <Select
          value={departmentFilter}
          onValueChange={(value) => {
            setDepartmentFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-background sm:w-64">
            <SelectValue placeholder="Todos os departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id.toString()}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">Departamento</th>
              <th className="px-6 py-4">Descrição</th>
              <th className="px-6 py-4">Qtd Produtos</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : categoriesWithDepartment.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            ) : (
              categoriesWithDepartment.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-border/50 transition-colors hover:bg-muted/20"
                >
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Folder className="h-4 w-4" />
                      </div>
                      {category.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {category.department?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {category.description || "-"}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      {category.productCountLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-border/50 hover-elevate"
                        onClick={() => onOpenReport(category.id)}
                      >
                        <BarChart3 className="mr-2 h-4 w-4 text-primary" /> Relatório
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onOpenModal(category)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => {
                          if (confirm("Remover esta categoria?")) {
                            onDelete(category.id);
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

      {/* Paging footer */}
      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <span>
          Mostrando página {categoriesPage?.page || 1} de{" "}
          {Math.ceil((categoriesPage?.total || 0) / (categoriesPage?.limit || 20)) || 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={categoriesPage ? categoriesPage.data.length < categoriesPage.limit : true}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
