import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { useDebounce } from "@workspace/ui";
import {
  createDepartment,
  deleteDepartment,
  getDepartmentsPage,
  updateDepartment,
} from "@/services/categories.service";
import type { DepartmentForm, EnrichedDepartment } from "../types";
import { RESOURCE_KEYS, useAllCategories } from "@/hooks/use-catalog";
import { describeApiError } from "@workspace/core";

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
    queryKey: [...RESOURCE_KEYS.departments, "page", { search: debouncedSearch, page }],
    queryFn: () =>
      getDepartmentsPage({
        search: debouncedSearch,
        page,
        limit: 20,
      }),
  });

  // Query: Fetch all categories to compute stats
  const { data: categories = [] } = useAllCategories();

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

      // Invalida os RECURSOS, não chaves específicas: a listagem desta tela, o
      // catálogo que as outras features leem e qualquer busca ficam sob o mesmo
      // prefixo. Antes a lista de `-for-products` ficava de fora, e criar um
      // departamento não o fazia aparecer no editor de produtos.
      //
      // Categorias entram junto porque exibem o nome do departamento.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.departments }),
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.categories }),
      ]);
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar departamento",
        description: describeApiError(error, "Tente novamente."),
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
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.departments }),
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.categories }),
      ]);
      toast({ title: "Departamento removido." });
    } catch (error) {
      toast({
        title: "Erro ao remover departamento",
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
