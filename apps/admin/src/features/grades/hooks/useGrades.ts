import { useState, useMemo, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useGetGrades, type GradeDto } from "@workspace/api-client-react";
import { createGrade, updateGrade, deleteGrade } from "@/services/grades.service";
import { getEnumOptions } from "@/services/core";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import type { Grade, GradeVariant, GradeType } from "../types";

/**
 * Converte um GradeDto retornado da API para o modelo Grade da aplicação.
 */
function mapDtoToGrade(dto: GradeDto, typeMap: Record<number | string, GradeType>): Grade {
  return {
    id: dto.id,
    name: dto.name,
    type: typeMap[dto.type] || "Tamanho",
    categoryIds: dto.categoryIds || [],
    variants: dto.options.map((opt: any) => ({
      id: opt.id,
      value: opt.value,
      colorHex: opt.colorHex || undefined,
      order: opt.displayOrder,
    })),
  };
}

/**
 * useGrades
 * 
 * Hook customizado para gerenciar regras de negócios, consultas e operações
 * da visualização administrativa de Grades e Dimensões.
 */
export function useGrades() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Busca opções de tipo de grade dinamicamente
  const { data: gradeTypeOptions = [] } = useQuery({
    queryKey: ["grade-type-options"],
    queryFn: () => getEnumOptions("/Grades/enums/grade-type"),
  });

  const selectableGradeTypeOptions = useMemo(
    () => gradeTypeOptions.filter((opt) => opt.allowSelect),
    [gradeTypeOptions]
  );

  // Mapeadores entre a API (Numérico/Enum de API) e a UI (Texto em Português)
  const typeMapFromApi = useMemo(() => {
    const map: Record<number | string, GradeType> = {
      1: "Tamanho",
      2: "Cor",
      3: "Modelo",
      4: "Estampa",
      "Size": "Tamanho",
      "Color": "Cor",
      "Model": "Modelo",
      "Print": "Estampa",
      "size": "Tamanho",
      "color": "Cor",
      "model": "Modelo",
      "print": "Estampa",
    };
    gradeTypeOptions.forEach((opt) => {
      const name = opt.name as GradeType;
      map[opt.id] = name;
      map[opt.value] = name;
      map[opt.value.toLowerCase()] = name;
    });
    return map;
  }, [gradeTypeOptions]);

  const typeMapToApi = useMemo(() => {
    const map: Record<GradeType, number> = {
      Tamanho: 1,
      Cor: 2,
      Modelo: 3,
      Estampa: 4,
    };
    gradeTypeOptions.forEach((opt) => {
      map[opt.name as GradeType] = opt.id;
    });
    return map;
  }, [gradeTypeOptions]);

  // Busca todas as grades cadastradas
  const { data: apiGrades = [], isLoading } = useGetGrades();
  const grades = useMemo(() => apiGrades.map((g) => mapDtoToGrade(g, typeMapFromApi)), [apiGrades, typeMapFromApi]);

  // Busca categorias e departamentos para vinculação
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-grades"],
    queryFn: () => getAllCategories(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all-for-grades"],
    queryFn: () => getAllDepartments(),
  });

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
  const [variants, setVariants] = useState<GradeVariant[]>([]);
  const [saving, setSaving] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const debouncedCategorySearch = useDebounce(categorySearch, 300);

  // Estado para drag & drop de variantes
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Estado para a linha fantasma (ghost row) de adição rápida
  const [ghostValue, setGhostValue] = useState("");
  const [ghostColorHex, setGhostColorHex] = useState("#000000");

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
      setVariants(JSON.parse(JSON.stringify(sorted)));

      const rawDto = apiGrades.find((g) => g.id === grade.id) || null;
      setEditingGrade(rawDto);
    } else {
      setEditingId(null);
      setEditingGrade(null);
      setGradeType("Tamanho");
      setSelectedCategoryIds([]);
      setVariants([]);
    }
    setGhostValue("");
    setGhostColorHex("#000000");
    setModalOpen(true);
  }

  /**
   * Remove uma linha de variante pelo índice local.
   */
  function removeVariantRow(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Atualiza o valor ou cor de uma variante existente na lista local.
   */
  function updateVariant(index: number, field: keyof GradeVariant, value: string) {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  /**
   * Consolda a linha fantasma (ghost row) transformando-a em uma variante efetiva.
   */
  function commitGhostRow() {
    const val = ghostValue.trim();
    if (!val) return;

    const valueExists = variants.some((v) => v.value.toLowerCase() === val.toLowerCase());
    if (valueExists) {
      toast({ title: "Este valor já existe nas opções.", variant: "destructive" });
      return;
    }

    if (gradeType === "Cor") {
      const colorExists = variants.some((v) => v.colorHex?.toLowerCase() === ghostColorHex.toLowerCase());
      if (colorExists) {
        toast({ title: "Esta cor (hexadecimal) já está sendo usada.", variant: "destructive" });
        return;
      }
    }

    setVariants((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        value: val,
        colorHex: gradeType === "Cor" ? ghostColorHex : undefined,
        order: prev.length,
      },
    ]);

    setGhostValue("");
  }

  // Drag and Drop de Variantes
  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newVariants = [...variants];
    const draggedItem = newVariants[draggedIndex];
    newVariants.splice(draggedIndex, 1);
    newVariants.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setVariants(newVariants);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  /**
   * Submete o formulário e salva a grade na API (Criação/Edição).
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    commitGhostRow();

    if (selectedCategoryIds.length === 0) {
      toast({ title: "Selecione pelo menos uma categoria.", variant: "destructive" });
      return;
    }

    const validVariants = variants.filter((v) => v.value.trim() !== "").map((v, i) => ({ ...v, order: i }));
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

    setSaving(true);
    try {
      if (editingId) {
        const originalGrade = grades.find((g) => g.id === editingId);
        await updateGrade({
          id: editingId,
          type: typeMapToApi[gradeType],
          categoryIds: selectedCategoryIds,
          options: validVariants.map((v, i) => ({
            id: originalGrade?.variants.some((orig) => orig.id === v.id) ? v.id : undefined,
            value: v.value.trim(),
            colorHex: gradeType === "Cor" ? v.colorHex || null : null,
            displayOrder: i,
          })),
        });
        toast({ title: "Grade atualizada com sucesso!" });
      } else {
        await createGrade({
          type: typeMapToApi[gradeType],
          categoryIds: selectedCategoryIds,
          options: validVariants.map((v, i) => ({
            value: v.value.trim(),
            colorHex: gradeType === "Cor" ? v.colorHex || null : null,
            displayOrder: i,
          })),
        });
        toast({ title: "Grade criada com sucesso!" });
      }
      await queryClient.invalidateQueries({ queryKey: ["grades"] });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar grade",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Deleta uma grade após confirmação.
   */
  async function handleDelete(id: number) {
    if (confirm("Tem certeza que deseja remover esta Grade?")) {
      try {
        await deleteGrade(id);
        await queryClient.invalidateQueries({ queryKey: ["grades"] });
        toast({ title: "Grade removida." });
      } catch (error) {
        toast({
          title: "Erro ao remover grade",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      }
    }
  }

  // Filtra as categorias associadas pelo termo de busca local (nome ou departamento)
  const filteredCategories = useMemo(() => {
    const baseList = [...categories];
    if (!debouncedCategorySearch.trim()) return baseList;
    const q = debouncedCategorySearch.toLowerCase().trim();
    const matched = q
      ? categories.filter((cat: any) => {
          const catName = cat.name.toLowerCase();
          const deptId = cat.departmentId;
          const deptName = (departmentMap.get(deptId) || "").toLowerCase();
          return catName.includes(q) || deptName.includes(q);
        })
      : [...categories];

    return matched.sort((a: any, b: any) => {
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
