import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { useDebounce } from "@/hooks/use-debounce";
import {
  createDepartment,
  deleteDepartment,
  getAllCategories,
  getDepartmentsPage,
  updateDepartment,
} from "@/services/categories.service";
import type { DepartmentForm, EnrichedDepartment, Category } from "../types";

/**
 * useDepartments
 * 
 * Custom React hook encapsulating state management, TanStack query caching,
 * and database updates for the Departments panel.
 * 
 * Core responsibilities:
 * - Pagination index, search text, editor dialog states.
 * - Loading paginated departments page and mapping categories count reactively.
 * - Form validation and mutations for creating, updating and deleting departments.
 */
export function useDepartments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Pagination and search filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Modal editor dialog states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<DepartmentForm>({
    name: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  // Query: Paginated departments page list
  const { data: departmentsPage, isLoading } = useQuery({
    queryKey: ["departments-page", { search: debouncedSearch, page }],
    queryFn: () =>
      getDepartmentsPage({
        search: debouncedSearch,
        page,
        limit: 20,
      }),
  });

  // Query: Fetch all categories to compute stats
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories-all-for-departments"],
    queryFn: () => getAllCategories(),
  });

  // Derived: Department list mapped with dynamic category counts
  const departmentsWithStats = useMemo<EnrichedDepartment[]>(() => {
    return (departmentsPage?.data ?? []).map((department) => ({
      ...department,
      categoriesCount: categories.filter((c) => c.departmentId === department.id).length,
    }));
  }, [categories, departmentsPage?.data]);

  /**
   * Opens the Department modal dialog in Create or Edit mode.
   * @param department Optional department object. If provided, launches Edit mode; otherwise launches Create mode.
   */
  function openModal(department?: EnrichedDepartment) {
    if (department) {
      setEditingId(department.id);
      setFormData({
        name: department.name,
        description: department.description || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
      });
    }
    setModalOpen(true);
  }

  /**
   * Submits the Department editor form.
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      };

      if (editingId) {
        await updateDepartment({ id: editingId, ...payload });
        toast({ title: "Departamento atualizado." });
      } else {
        await createDepartment(payload);
        toast({ title: "Departamento criado." });
      }

      // Invalidate queries to trigger UI refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["departments-page"] }),
        queryClient.invalidateQueries({ queryKey: ["departments-all-for-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["categories-all-for-departments"] }),
      ]);
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar departamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Deletes a department by ID.
   */
  async function handleDelete(departmentId: number) {
    try {
      await deleteDepartment(departmentId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["departments-page"] }),
        queryClient.invalidateQueries({ queryKey: ["departments-all-for-categories"] }),
      ]);
      toast({ title: "Departamento removido." });
    } catch (error) {
      toast({
        title: "Erro ao remover departamento",
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
    modalOpen,
    setModalOpen,
    editingId,
    formData,
    setFormData,
    saving,
    departmentsPage,
    isLoading,
    departmentsWithStats,
    openModal,
    handleSubmit,
    handleDelete,
  };
}
