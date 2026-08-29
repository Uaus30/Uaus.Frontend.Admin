import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Search, RotateCcw } from "lucide-react";
import {
  PRODUCT_STATUS,
  type CategoryDto,
  type DepartmentDto,
  type EnumOptionDto,
} from "@workspace/api-client-react";

export interface ProductTableFiltersProps {
  search: string;
  setSearch: (value: string) => void;
  departmentId?: number;
  setDepartmentId: (value?: number) => void;
  departments: DepartmentDto[];
  categoryId?: number;
  setCategoryId: (value?: number) => void;
  categories: CategoryDto[];
  status?: number;
  setStatus: (value?: number) => void;
  statusOptions: EnumOptionDto[];
  onResetFilters: () => void;
}

/**
 * Filtros da tabela de produtos.
 *
 * Contém a caixa de pesquisa textual e os selects para Departamento, Categoria
 * e Status (todos em ordem alfabética).
 */
export function ProductTableFilters({
  search,
  setSearch,
  departmentId,
  setDepartmentId,
  departments,
  categoryId,
  setCategoryId,
  categories,
  status,
  setStatus,
  statusOptions,
  onResetFilters,
}: ProductTableFiltersProps) {
  const isFiltered =
    Boolean(search.trim()) ||
    departmentId !== undefined ||
    categoryId !== undefined ||
    status !== PRODUCT_STATUS.Active;

  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/50">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-background pl-9 h-9 text-sm"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={departmentId !== undefined ? String(departmentId) : "todos"}
            onValueChange={(val) => {
              setDepartmentId(val === "todos" ? undefined : Number(val));
            }}
          >
            <SelectTrigger className="bg-background h-9 text-sm">
              <SelectValue placeholder="Todos os departamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os departamentos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={categoryId !== undefined ? String(categoryId) : "todos"}
            onValueChange={(val) => {
              setCategoryId(val === "todos" ? undefined : Number(val));
            }}
          >
            <SelectTrigger className="bg-background h-9 text-sm">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-40">
          <Select
            value={status !== undefined ? String(status) : "todos"}
            onValueChange={(val) => {
              setStatus(val === "todos" ? undefined : Number(val));
            }}
          >
            <SelectTrigger className="bg-background h-9 text-sm">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.id} value={String(opt.id)}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground self-start lg:self-auto"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
