import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@workspace/ui";
import { useToast } from "@workspace/ui";
import { createCategory, deleteCategory, getCategoriesPage, updateCategory } from "@/services/categories.service";
import { getCategoryReport } from "@/services/reports.service";
import { STALE_TIME, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import type { CategoryForm, EnrichedCategory, CategoryReport } from "../types";
import { useAllDepartments } from "@/hooks/use-catalog";
import { describeApiError } from "@workspace/core";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/**
 * useCategories
 * 
 * Custom React hook managing the state, validation, and TanStack Queries/Mutations
 * for the Categories administration view.
 * 
 * Core responsibilities:
 * - Local states for search, filters, pagination, and modal toggles.
 * - Loading list of departments.
 * - Pagination categories querying with search/department filters.
 * - Mapping categories with their departments.
 * - Creating, updating, and deleting categories with query validation.
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
  const [saving, setSaving] = useState(false);
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

  // Query: Paginated and filtered categories
  const { data: categoriesPage, isLoading, isError, error } = useQuery({
    queryKey: [...getGetCategoriesQueryKey(), { search: debouncedSearch, departmentFilter, page }],
    queryFn: () =>
      getCategoriesPage({
        search: debouncedSearch,
        departmentId: departmentFilter === "all" ? undefined : Number(departmentFilter),
        page,
        limit: 20,
      }),
  });

  // O aviso de servidor fora do ar é o mesmo em toda tela — mora num hook só.
  useApiErrorToast(isError, error);

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

    setSaving(true);
    try {
      const payload = {
        departmentId: Number(formData.departmentId),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      };

      if (editingId) {
        await updateCategory({ id: editingId, ...payload });
        toast({ title: "Categoria atualizada." });
      } else {
        await createCategory(payload);
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
    } finally {
      setSaving(false);
    }
  }

  /**
   * Deletes a Category by database ID.
   */
  async function handleDelete(categoryId: number) {
    try {
      await deleteCategory(categoryId);
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
