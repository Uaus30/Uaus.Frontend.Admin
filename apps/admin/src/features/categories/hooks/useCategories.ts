import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  createCategory, 
  deleteCategory, 
  getAllDepartments, 
  getCategoriesPage, 
  updateCategory 
} from "@/services/categories.service";
import { buildMockCategoryReport } from "@/lib/mock-data";
import { getGetCategoriesQueryKey } from "@workspace/api-client-react";
import type { CategoryForm, EnrichedCategory, Department, CategoryReport } from "../types";

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
 * - Fetching mock category analytics reports.
 */
export function useCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Search, Pagination, and Filters states
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

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
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments-all-for-categories"],
    queryFn: () => getAllDepartments(),
  });

  // Query: Paginated and filtered categories
  const { data: categoriesPage, isLoading, isError, error } = useQuery({
    queryKey: [...getGetCategoriesQueryKey(), { search, departmentFilter, page }],
    queryFn: () =>
      getCategoriesPage({
        search,
        departmentId: departmentFilter === "all" ? undefined : Number(departmentFilter),
        page,
        limit: 20,
      }),
  });

  // Side Effect: Server error toast notification
  useEffect(() => {
    if (isError && error) {
      const apiError = error as any;
      if (apiError.status >= 500) {
        toast({
          title: "Servidor indisponível",
          description: "O servidor está indisponível no momento. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    }
  }, [isError, error, toast]);

  // Derived: Enriched category list with department objects
  const categoriesWithDepartment = useMemo<EnrichedCategory[]>(() => {
    const departmentsById = new Map(departments.map((d) => [d.id, d]));

    return (categoriesPage?.data ?? []).map((category: any) => ({
      ...category,
      department: departmentsById.get(category.departmentId) ?? null,
      productCountLabel: "Mockado",
    }));
  }, [categoriesPage?.data, departments]);

  // Derived: Active category sales report summary
  const selectedReport = useMemo<CategoryReport | null>(() => {
    if (!selectedCatId) return null;
    const category = categoriesWithDepartment.find((item) => item.id === selectedCatId);
    if (!category) return null;
    return buildMockCategoryReport(category.name);
  }, [categoriesWithDepartment, selectedCatId]);

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
   * Opens the mock category sales report dialog.
   * @param categoryId Category ID to load report analytics for.
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
        description: error instanceof Error ? error.message : "Tente novamente.",
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
        description: error instanceof Error ? error.message : "Tente novamente.",
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
    openModal,
    openReport,
    handleSubmit,
    handleDelete,
  };
}
