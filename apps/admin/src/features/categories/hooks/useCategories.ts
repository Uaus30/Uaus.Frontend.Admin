import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@workspace/ui";
import { useToast } from "@workspace/ui";
import { getCategoryReport } from "@/services/reports.service";
import {
  STALE_TIME,
  getGetCategoriesQueryKey,
  useCreateCategory,
  useDeleteCategory,
  useGetCategories,
  useUpdateCategory,
} from "@workspace/api-client-react";
import type { CategoryForm, EnrichedCategory, CategoryReport } from "../types";
import { useAllDepartments } from "@/hooks/use-catalog";
import { describeApiError } from "@workspace/core";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/**
 * useCategories
 *
 * Estado, validação e consultas da tela de categorias.
 *
 * A leitura e as três mutações vêm do api-client (`useGetCategories`,
 * `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`): nenhum caminho
 * HTTP é montado aqui. O que sobra para o hook é o que de fato é da tela —
 * busca com debounce, paginação, formulário, enriquecimento com o departamento
 * e a decisão de quando invalidar o cache.
 *
 * Responsabilidades:
 * - Estados de busca, filtro por departamento, paginação e modais.
 * - Listagem paginada filtrada no SERVIDOR.
 * - Casamento de cada categoria com o departamento dela.
 * - Criação, edição e remoção, com invalidação dirigida ao prefixo do recurso.
 * - Carregamento sob demanda do relatório de vendas da categoria selecionada.
 */
export function useCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Search, Pagination, and Filters states
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [departmentFilter, setDepartmentFilter] = useState("all");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Modal Dialog states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CategoryForm>({
    departmentId: "",
    name: "",
    description: "",
  });

  // Report Modal states
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  // Query: Fetch all departments
  const { data: departments = [] } = useAllDepartments();

  // Query: Paginated and filtered categories.
  //
  // A chave de cache é do api-client — o hook registra
  // `[...getGetCategoriesQueryKey(), params]`. É o que faz a invalidação por
  // prefixo, lá embaixo, alcançar TODAS as páginas e buscas, e não só a
  // combinação que estava na tela na hora de salvar.
  const {
    data: categoriesPage,
    isLoading,
    isError,
    error,
  } = useGetCategories({
    search: debouncedSearch,
    departmentId: departmentFilter === "all" ? undefined : Number(departmentFilter),
    page,
    limit: 20,
  });

  // O aviso de servidor fora do ar é o mesmo em toda tela — mora num hook só.
  useApiErrorToast(isError, error);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Salvando é o estado das mutações, não uma cópia dele: manter um `useState`
  // em paralelo dava divergência sempre que um `catch` esquecia o `finally`.
  const saving = createCategory.isPending || updateCategory.isPending;

  // Derived: Enriched category list with department objects
  const categoriesWithDepartment = useMemo<EnrichedCategory[]>(() => {
    const departmentsById = new Map(departments.map((d) => [d.id, d]));

    return (categoriesPage?.data ?? []).map((category) => ({
      ...category,
      department: departmentsById.get(category.departmentId) ?? null,
      productCount: category.productCount ?? 0,
    }));
  }, [categoriesPage?.data, departments]);

  // Query: relatório da categoria selecionada.
  //
  // Só dispara quando o modal é aberto: é uma agregação sobre os itens de venda
  // do período, e carregá-la para todas as categorias da página seria pagar por
  // um dado que o usuário pediu de uma.
  const { data: selectedReport = null, isLoading: isReportLoading } = useQuery<CategoryReport>({
    queryKey: ["category-report", selectedCatId],
    queryFn: () => getCategoryReport(selectedCatId as number),
    enabled: !!selectedCatId && reportOpen,
    staleTime: STALE_TIME.catalogo,
  });

  /**
   * Opens the Category editor dialog in Create or Edit mode.
   * @param category If provided, populates the fields for editing; otherwise resets for a new category.
   */
  function openModal(category?: EnrichedCategory) {
    if (category) {
      setEditingId(category.id);
      setFormData({
        departmentId: String(category.departmentId),
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        departmentId: departmentFilter !== "all" ? departmentFilter : (departments[0]?.id.toString() ?? ""),
        name: "",
        description: "",
      });
    }
    setModalOpen(true);
  }

  /**
   * Abre o relatório de vendas da categoria, disparando a consulta.
   * @param categoryId ID da categoria analisada.
   */
  function openReport(categoryId: number) {
    setSelectedCatId(categoryId);
    setReportOpen(true);
  }

  /**
   * Validates and submits the Category editor form.
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.departmentId || !formData.name.trim()) return;

    try {
      const data = {
        departmentId: Number(formData.departmentId),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      };

      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, data });
        toast({ title: "Categoria atualizada." });
      } else {
        await createCategory.mutateAsync({ data });
        toast({ title: "Categoria criada." });
      }

      await queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar categoria",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  /**
   * Deletes a Category by database ID.
   */
  async function handleDelete(categoryId: number) {
    try {
      await deleteCategory.mutateAsync({ id: categoryId });
      await queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      toast({ title: "Categoria removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover categoria",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  return {
    page,
    setPage,
    search,
    setSearch,
    departmentFilter,
    setDepartmentFilter,
    modalOpen,
    setModalOpen,
    editingId,
    formData,
    setFormData,
    reportOpen,
    setReportOpen,
    saving,
    departments,
    isLoading,
    isError,
    categoriesPage,
    categoriesWithDepartment,
    selectedReport,
    isReportLoading,
    openModal,
    openReport,
    handleSubmit,
    handleDelete,
  };
}
