import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { useDebounce } from "@workspace/ui";
import {
  getGetGradesQueryKey,
  useCreateGrade,
  useDeleteGrade,
  useGetGradeTypeOptions,
  useGetGrades,
  useUpdateGrade,
  type GradeDto,
  type SaveGradeOptionPayload,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";

import type { Grade, GradeType } from "../types";
import { buildTypeMapFromApi, buildTypeMapToApi, mapDtoToGrade } from "../grade-type-map";
import { useGradeVariants } from "./useGradeVariants";
import { useAllDepartments, useAllCategories } from "@/hooks/use-catalog";

/**
 * useGrades
 *
 * Regras, consultas e operações da tela de Grades e Dimensões.
 *
 * Leitura, enum de tipo e as três mutações vêm do api-client; a tabela de
 * opções da grade vive em `useGradeVariants`. O que resta aqui é a costura:
 * qual grade está aberta, quais categorias foram marcadas e o que vai no
 * payload.
 */
export function useGrades() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Busca opções de tipo de grade dinamicamente
  const { data: gradeTypeOptions = [] } = useGetGradeTypeOptions();

  const selectableGradeTypeOptions = useMemo(
    () => gradeTypeOptions.filter((option) => option.allowSelect),
    [gradeTypeOptions],
  );

  const typeMapFromApi = useMemo(() => buildTypeMapFromApi(gradeTypeOptions), [gradeTypeOptions]);
  const typeMapToApi = useMemo(() => buildTypeMapToApi(gradeTypeOptions), [gradeTypeOptions]);

  // Busca todas as grades cadastradas
  const { data: apiGrades = [], isLoading } = useGetGrades();
  const grades = useMemo(
    () => apiGrades.map((g) => mapDtoToGrade(g, typeMapFromApi)),
    [apiGrades, typeMapFromApi],
  );

  // Busca categorias e departamentos para vinculação
  const { data: categories = [] } = useAllCategories();
  const { data: departments = [] } = useAllDepartments();

  const departmentMap = useMemo(() => {
    return new Map(departments.map((d) => [d.id, d.name]));
  }, [departments]);

  // Estados locais do editor de grade (Modal)
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<GradeDto | null>(null);
  const [gradeType, setGradeType] = useState<GradeType>("Tamanho");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const debouncedCategorySearch = useDebounce(categorySearch, 300);

  const {
    variants,
    setVariants,
    resetVariants,
    draggedIndex,
    ghostValue,
    setGhostValue,
    ghostColorHex,
    setGhostColorHex,
    removeVariantRow,
    updateVariant,
    commitGhostRow,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useGradeVariants(gradeType);

  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();

  const saving = createGrade.isPending || updateGrade.isPending;

  // Filtra as grades pela busca textual
  const filteredGrades = useMemo(() => {
    if (!debouncedSearch.trim()) return grades;
    return grades.filter((g: Grade) => g.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [grades, debouncedSearch]);

  /**
   * Abre o modal de cadastro ou edição de grade.
   * @param grade Grade a ser editada (opcional).
   */
  function openModal(grade?: Grade) {
    setCategorySearch("");
    setActiveTab("info");
    if (grade) {
      setEditingId(grade.id);
      setGradeType(grade.type);
      setSelectedCategoryIds(grade.categoryIds || []);
      const sorted = [...grade.variants].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      resetVariants(JSON.parse(JSON.stringify(sorted)));

      const rawDto = apiGrades.find((g) => g.id === grade.id) || null;
      setEditingGrade(rawDto);
    } else {
      setEditingId(null);
      setEditingGrade(null);
      setGradeType("Tamanho");
      setSelectedCategoryIds([]);
      resetVariants([]);
    }
    setModalOpen(true);
  }

  /**
   * Submete o formulário e salva a grade na API (Criação/Edição).
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // A lista devolvida já inclui a linha fantasma; ler `variants` aqui pegaria
    // o estado do render anterior e perderia a última opção digitada.
    const pendingVariants = commitGhostRow();

    if (selectedCategoryIds.length === 0) {
      toast({ title: "Selecione pelo menos uma categoria.", variant: "destructive" });
      return;
    }

    const validVariants = pendingVariants
      .filter((v) => v.value.trim() !== "")
      .map((v, i) => ({ ...v, order: i }));
    if (validVariants.length === 0) {
      toast({ title: "Adicione ao menos uma opção (Variante).", variant: "destructive" });
      return;
    }

    // Validação final de duplicidade
    const values = new Set();
    const colors = new Set();
    for (const v of validVariants) {
      const val = v.value.toLowerCase();
      if (values.has(val)) {
        toast({ title: `O valor '${v.value}' está duplicado.`, variant: "destructive" });
        return;
      }
      values.add(val);

      if (gradeType === "Cor" && v.colorHex) {
        const col = v.colorHex.toLowerCase();
        if (colors.has(col)) {
          toast({ title: `A cor '${v.colorHex}' está duplicada.`, variant: "destructive" });
          return;
        }
        colors.add(col);
      }
    }

    try {
      if (editingId) {
        // Só reenvia o id da opção que JÁ existia na grade. As criadas na sessão
        // carregam um id local (`Date.now()`), e mandá-lo faria o servidor tentar
        // atualizar uma linha que não é dele.
        const originalGrade = grades.find((g) => g.id === editingId);
        const options: SaveGradeOptionPayload[] = validVariants.map((v, i) => ({
          id: originalGrade?.variants.some((orig) => orig.id === v.id) ? v.id : undefined,
          value: v.value.trim(),
          colorHex: gradeType === "Cor" ? v.colorHex || null : null,
          displayOrder: i,
        }));

        await updateGrade.mutateAsync({
          data: { id: editingId, type: typeMapToApi[gradeType], categoryIds: selectedCategoryIds, options },
        });
        toast({ title: "Grade atualizada com sucesso!" });
      } else {
        const options: SaveGradeOptionPayload[] = validVariants.map((v, i) => ({
          value: v.value.trim(),
          colorHex: gradeType === "Cor" ? v.colorHex || null : null,
          displayOrder: i,
        }));

        await createGrade.mutateAsync({
          data: { type: typeMapToApi[gradeType], categoryIds: selectedCategoryIds, options },
        });
        toast({ title: "Grade criada com sucesso!" });
      }
      await queryClient.invalidateQueries({ queryKey: getGetGradesQueryKey() });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar grade",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  /**
   * Remove a grade. A confirmação é do `ConfirmDialog` da tabela — o
   * `window.confirm` que ficava aqui travava a thread e não era testável.
   */
  async function handleDelete(id: number) {
    try {
      await deleteGrade.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: getGetGradesQueryKey() });
      toast({ title: "Grade removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover grade",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  // Filtra as categorias associadas pelo termo de busca local (nome ou departamento)
  const filteredCategories = useMemo(() => {
    if (!debouncedCategorySearch.trim()) return [...categories];
    const query = debouncedCategorySearch.toLowerCase().trim();
    const matched = categories.filter((cat) => {
      const catName = cat.name.toLowerCase();
      const deptName = (departmentMap.get(cat.departmentId) || "").toLowerCase();
      return catName.includes(query) || deptName.includes(query);
    });

    // Marcadas primeiro: numa lista de dezenas de categorias, a que o operador
    // acabou de marcar sumia para o fim e ele marcava a mesma duas vezes.
    return matched.sort((a, b) => {
      const aChecked = selectedCategoryIds.includes(a.id);
      const bChecked = selectedCategoryIds.includes(b.id);
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [categories, debouncedCategorySearch, departmentMap, selectedCategoryIds]);

  const hasCategories = selectedCategoryIds.length > 0;
  const hasOptions = variants.length > 0 || ghostValue.trim().length > 0;
  const isFormValid = hasCategories && hasOptions;

  function getMissingTooltipText() {
    if (!hasCategories && !hasOptions) {
      return "Falta selecionar categorias e adicionar opções da grade.";
    }
    if (!hasCategories) {
      return "Selecione pelo menos uma categoria associada.";
    }
    if (!hasOptions) {
      return "Adicione pelo menos uma opção para a grade.";
    }
    return "";
  }

  return {
    search,
    setSearch,
    selectableGradeTypeOptions,
    isLoading,
    grades,
    filteredGrades,
    categories,
    departments,
    departmentMap,
    modalOpen,
    setModalOpen,
    activeTab,
    setActiveTab,
    editingId,
    editingGrade,
    gradeType,
    setGradeType,
    selectedCategoryIds,
    setSelectedCategoryIds,
    variants,
    setVariants,
    saving,
    categorySearch,
    setCategorySearch,
    draggedIndex,
    ghostValue,
    setGhostValue,
    ghostColorHex,
    setGhostColorHex,
    openModal,
    removeVariantRow,
    updateVariant,
    commitGhostRow,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleSubmit,
    handleDelete,
    filteredCategories,
    hasCategories,
    hasOptions,
    isFormValid,
    getMissingTooltipText,
  };
}
