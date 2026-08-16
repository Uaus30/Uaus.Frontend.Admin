import React from "react";
import { Building2, Edit2, FolderTree, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Loader2 } from "lucide-react";
import type { EnrichedDepartment } from "../types";

type DepartmentTableProps = {
  /** Loading state indicator flag */
  isLoading: boolean;
  /** Current search input string */
  search: string;
  /** Callback triggered when search input value changes */
  setSearch: (val: string) => void;
  /** Current page index */
  page: number;
  /** Callback triggered when page index changes */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Paginated departments page response from backend API */
  departmentsPage: any;
  /** Enriched departments list array containing category stats */
  departmentsWithStats: EnrichedDepartment[];
  /** Callback to trigger modal opening for creation (no arguments) or editing */
  onOpenModal: (department?: EnrichedDepartment) => void;
  /** Callback to delete department by ID */
  onDelete: (departmentId: number) => void;
};

/**
 * DepartmentTable
 *
 * Renders the search, tabular list of departments, and paginator footer.
 */
export function DepartmentTable({
  isLoading,
  search,
  setSearch,
  page,
  setPage,
  departmentsPage,
  departmentsWithStats,
  onOpenModal,
  onDelete,
}: DepartmentTableProps) {
  // A confirmação guarda o departamento inteiro, não só o id: o diálogo precisa
  // do nome e da contagem de categorias para dizer o que exatamente se perde.
  const [departmentToDelete, setDepartmentToDelete] = React.useState<EnrichedDepartment | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      {/* Search Input bar */}
      <div className="border-b border-border/50 p-4">
        <Input
          placeholder="Buscar departamento..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="bg-background sm:max-w-sm"
        />
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">Descrição</th>
              <th className="px-6 py-4">Qtd Categorias</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : departmentsWithStats.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-muted-foreground">
                  Nenhum departamento cadastrado.
                </td>
              </tr>
            ) : (
              departmentsWithStats.map((department) => (
                <tr
                  key={department.id}
                  className="border-b border-border/50 transition-colors hover:bg-muted/20"
                >
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      {department.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{department.description || "-"}</td>
                  <td className="px-6 py-4 font-medium">
                    <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                      <FolderTree className="h-3.5 w-3.5" />
                      {department.categoriesCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onOpenModal(department)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => setDepartmentToDelete(department)}
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
          Mostrando página {departmentsPage?.page || 1} de{" "}
          {Math.ceil((departmentsPage?.total || 0) / (departmentsPage?.limit || 20)) || 1}
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
            disabled={departmentsPage ? departmentsPage.data.length < departmentsPage.limit : true}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={departmentToDelete !== null}
        onOpenChange={(open) => !open && setDepartmentToDelete(null)}
        title="Remover este departamento?"
        itemName={departmentToDelete?.name}
        description={
          departmentToDelete && departmentToDelete.categoriesCount > 0
            ? `O departamento sai do cadastro e ${departmentToDelete.categoriesCount === 1 ? "1 categoria ligada a ele fica" : `${departmentToDelete.categoriesCount} categorias ligadas a ele ficam`} sem departamento, sumindo dos filtros e relatórios por departamento até serem reclassificadas. A ação não pode ser desfeita.`
            : "O departamento sai do cadastro. A ação não pode ser desfeita."
        }
        confirmLabel="Sim, remover"
        destructive
        onConfirm={() => {
          if (departmentToDelete) onDelete(departmentToDelete.id);
        }}
      />
    </div>
  );
}
