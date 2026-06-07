import { useState, useRef, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Plus, Search, Trash2, GripVertical, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Grade, GradeVariant, GradeType } from "../features/products/types";
import { useGetGrades, type GradeDto } from "@workspace/api-client-react";
import { createGrade, updateGrade, deleteGrade } from "@/services/grades.service";
import { getEnumOptions } from "@/services/core";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";

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
      order: opt.displayOrder
    }))
  };
}

export default function Grades() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: gradeTypeOptions = [] } = useQuery({
    queryKey: ["grade-type-options"],
    queryFn: () => getEnumOptions("/Grades/enums/grade-type"),
  });

  const selectableGradeTypeOptions = useMemo(
    () => gradeTypeOptions.filter((opt) => opt.allowSelect),
    [gradeTypeOptions]
  );

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
    gradeTypeOptions.forEach(opt => {
      const name = opt.name as GradeType;
      map[opt.id] = name;
      map[opt.value] = name;
      map[opt.value.toLowerCase()] = name;
    });
    return map;
  }, [gradeTypeOptions]);

  const typeMapToApi = useMemo(() => {
    const map: Record<GradeType, number> = {
      "Tamanho": 1,
      "Cor": 2,
      "Modelo": 3,
      "Estampa": 4,
    };
    gradeTypeOptions.forEach(opt => {
      map[opt.name as GradeType] = opt.id;
    });
    return map;
  }, [gradeTypeOptions]);

  const { data: apiGrades = [], isLoading } = useGetGrades();
  const grades = useMemo(() => apiGrades.map((g) => mapDtoToGrade(g, typeMapFromApi)), [apiGrades, typeMapFromApi]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-grades"],
    queryFn: () => getAllCategories(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all-for-grades"],
    queryFn: () => getAllDepartments(),
  });

  const departmentMap = useMemo(() => {
    return new Map(departments.map(d => [d.id, d.name]));
  }, [departments]);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<GradeDto | null>(null);
  const [gradeType, setGradeType] = useState<GradeType>("Tamanho");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [variants, setVariants] = useState<GradeVariant[]>([]);
  const [saving, setSaving] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Ghost Row state
  const [ghostValue, setGhostValue] = useState("");
  const [ghostColorHex, setGhostColorHex] = useState("#000000");
  const ghostInputRef = useRef<HTMLInputElement>(null);

  const filteredGrades = grades.filter((g: Grade) => g.name.toLowerCase().includes(search.toLowerCase()));

  const openModal = (grade?: Grade) => {
    setCategorySearch("");
    setActiveTab("info");
    if (grade) {
      setEditingId(grade.id);
      setGradeType(grade.type);
      setSelectedCategoryIds(grade.categoryIds || []);
      const sorted = [...grade.variants].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setVariants(JSON.parse(JSON.stringify(sorted)));
      
      const rawDto = apiGrades.find(g => g.id === grade.id) || null;
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
  };

  const removeVariantRow = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof GradeVariant, value: string) => {
    setVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const commitGhostRow = () => {
    const val = ghostValue.trim();
    if (!val) return;
    
    // Duplicate check
    const valueExists = variants.some(v => v.value.toLowerCase() === val.toLowerCase());
    if (valueExists) {
      toast({ title: "Este valor já existe nas opções.", variant: "destructive" });
      return;
    }

    if (gradeType === "Cor") {
      const colorExists = variants.some(v => v.colorHex?.toLowerCase() === ghostColorHex.toLowerCase());
      if (colorExists) {
        toast({ title: "Esta cor (hexadecimal) já está sendo usada.", variant: "destructive" });
        return;
      }
    }
    
    setVariants(prev => [
      ...prev, 
      { 
        id: Date.now() + Math.random(), 
        value: val, 
        colorHex: gradeType === "Cor" ? ghostColorHex : undefined,
        order: prev.length
      }
    ]);
    
    setGhostValue("");
  };

  const handleGhostKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitGhostRow();
      setTimeout(() => ghostInputRef.current?.focus(), 10);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newVariants = [...variants];
    const draggedItem = newVariants[draggedIndex];
    newVariants.splice(draggedIndex, 1);
    newVariants.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setVariants(newVariants);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    commitGhostRow();

    if (selectedCategoryIds.length === 0) {
      toast({ title: "Selecione pelo menos uma categoria.", variant: "destructive" });
      return;
    }
    
    const validVariants = variants.filter(v => v.value.trim() !== "").map((v, i) => ({ ...v, order: i }));
    if (validVariants.length === 0) {
      toast({ title: "Adicione ao menos uma opção (Variante).", variant: "destructive" });
      return;
    }

    // Final duplication validation for standard updates
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
            displayOrder: i
          }))
        });
        toast({ title: "Grade atualizada com sucesso!" });
      } else {
        await createGrade({
          type: typeMapToApi[gradeType],
          categoryIds: selectedCategoryIds,
          options: validVariants.map((v, i) => ({
            value: v.value.trim(),
            colorHex: gradeType === "Cor" ? v.colorHex || null : null,
            displayOrder: i
          }))
        });
        toast({ title: "Grade criada com sucesso!" });
      }
      await queryClient.invalidateQueries({ queryKey: ["grades"] });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar grade",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja remover esta Grade?")) {
      try {
        await deleteGrade(id);
        await queryClient.invalidateQueries({ queryKey: ["grades"] });
        toast({ title: "Grade removida." });
      } catch (error) {
        toast({
          title: "Erro ao remover grade",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  // Categories filtered by search query matching Category Name or Department Name, sorted selected first then alphabetically
  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
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
  }, [categories, categorySearch, departmentMap, selectedCategoryIds]);

  // Validations for save action
  const hasCategories = selectedCategoryIds.length > 0;
  const hasOptions = variants.length > 0 || ghostValue.trim().length > 0;
  const isFormValid = hasCategories && hasOptions;

  const getMissingTooltipText = () => {
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
  };

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Grades e Dimensões</h1>
            <p className="mt-1 text-muted-foreground">Cadastre tamanhos, cores e outros atributos para geração de variações de produtos.</p>
          </div>
          <Button onClick={() => openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Grade
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
          <div className="flex gap-3 border-b border-border/50 p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome da grade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-background pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Nome da Grade</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Opções (Variantes)</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </td>
                  </tr>
                ) : filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      Nenhuma grade encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((grade: Grade) => (
                    <tr key={grade.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">
                        {grade.name}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {grade.type}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {[...grade.variants].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((v: GradeVariant) => (
                            <span key={v.id} className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                              {grade.type === "Cor" && v.colorHex && v.colorHex !== "#000000" && (
                                <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: v.colorHex }} />
                              )}
                              {v.value}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-primary" onClick={() => openModal(grade)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(grade.id)}>
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
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card sm:max-w-[650px] max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="text-xl font-display">
              {editingId ? "Editar Grade" : "Nova Grade"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulário para cadastro e edição de grades. Associe categorias e configure as opções.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden mt-4">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="info">Informações Básicas</TabsTrigger>
              <TabsTrigger value="categories" className="relative">
                Categorias
                {!hasCategories && (
                  <span className="absolute top-1 right-2 flex h-2 w-2 rounded-full bg-orange-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="options" className="relative">
                Opções
                {!hasOptions && (
                  <span className="absolute top-1 right-2 flex h-2 w-2 rounded-full bg-orange-500" />
                )}
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1">
                
                {/* TAB 1: BASIC INFO */}
                <TabsContent value="info" className="space-y-4 outline-none">
                  {editingId && (
                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/50 bg-muted/10 p-4 text-sm mb-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground font-medium block">ID</span>
                        <span className="font-mono text-foreground">{editingId}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground font-medium block">Nome da Grade</span>
                        <span className="font-semibold text-foreground">{editingGrade?.name || "-"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground font-medium block">Criado em</span>
                        <span className="text-foreground">
                          {editingGrade?.createdAt ? new Date(editingGrade.createdAt).toLocaleString("pt-BR") : "-"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground font-medium block">Última alteração</span>
                        <span className="text-foreground">
                          {editingGrade?.updatedAt ? new Date(editingGrade.updatedAt).toLocaleString("pt-BR") : "-"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground font-medium block">Criado por</span>
                        <span className="text-foreground">{(editingGrade as any)?.createdBy || "-"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground font-medium block">Alterado por</span>
                        <span className="text-foreground">{(editingGrade as any)?.updatedBy || "-"}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={gradeType} onValueChange={(val) => setGradeType(val as GradeType)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableGradeTypeOptions.length > 0 ? (
                          selectableGradeTypeOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.name}>
                              {opt.name}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="Tamanho">Tamanho</SelectItem>
                            <SelectItem value="Cor">Cor</SelectItem>
                            <SelectItem value="Modelo">Modelo</SelectItem>
                            <SelectItem value="Estampa">Estampa</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* TAB 2: CATEGORY ASSOCIATION */}
                <TabsContent value="categories" className="space-y-4 outline-none">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar por nome da categoria ou departamento..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="bg-background pl-9"
                    />
                  </div>

                  <div className="border border-border/50 rounded-xl p-2 h-[260px] overflow-y-auto bg-background space-y-1.5 shadow-inner">
                    {filteredCategories.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 text-center">Nenhuma categoria encontrada para a busca.</p>
                    ) : (
                      filteredCategories.map((cat: any) => {
                        const checked = selectedCategoryIds.includes(cat.id);
                        const deptName = departmentMap.get(cat.departmentId);
                        return (
                          <div 
                            key={cat.id} 
                            onClick={() => {
                              if (checked) {
                                setSelectedCategoryIds(prev => prev.filter(id => id !== cat.id));
                              } else {
                                setSelectedCategoryIds(prev => [...prev, cat.id]);
                              }
                            }}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              checked 
                                ? "bg-primary/5 hover:bg-primary/10 border-primary/20 border" 
                                : "hover:bg-muted/40 border border-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}} // Click handled by parent div
                              id={`cat-${cat.id}`}
                              className="h-4 w-4 rounded border-primary text-primary focus:ring-primary accent-primary cursor-pointer"
                            />
                            <label className="text-sm font-medium text-foreground cursor-pointer flex-1 flex items-center justify-between">
                              <span>{cat.name}</span>
                              {deptName && (
                                <span className="text-xs italic text-muted-foreground/70 ml-2">
                                  ({deptName})
                                </span>
                              )}
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/20">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>Selecione uma ou mais categorias para vincular esta grade.</span>
                  </div>
                </TabsContent>

                {/* TAB 3: OPTIONS DEFINITION */}
                <TabsContent value="options" className="outline-none flex flex-col h-full space-y-3">
                  <div className="rounded-xl border border-border/50 overflow-hidden bg-background/50 flex-1 shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/40 text-xs text-muted-foreground uppercase border-b border-border/50">
                        <tr>
                          <th className="w-8 px-2 py-2.5"></th>
                          <th className="px-3 py-2.5 font-medium">Valor (Obrigatório)</th>
                          {gradeType === "Cor" && (
                             <th className="px-3 py-2.5 font-medium w-24">Cor</th>
                          )}
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {variants.map((v, index) => (
                          <tr 
                            key={v.id} 
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`transition-colors group bg-card ${draggedIndex === index ? 'opacity-50' : 'hover:bg-muted/20'}`}
                          >
                            <td className="px-2 py-1 text-center text-muted-foreground/50 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4 inline-block group-hover:text-muted-foreground transition-colors" />
                            </td>
                            <td className="p-1.5">
                              <Input 
                                required 
                                placeholder="Ex: P, Azul" 
                                value={v.value} 
                                onChange={(e) => updateVariant(index, 'value', e.target.value)} 
                                className="h-8 border-transparent hover:border-border focus:bg-background transition-colors"
                              />
                            </td>
                            {gradeType === "Cor" && (
                              <td className="p-1.5">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="color" 
                                    value={v.colorHex || "#000000"} 
                                    onChange={(e) => updateVariant(index, 'colorHex', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                                  />
                                </div>
                              </td>
                            )}
                            <td className="p-1.5 text-right">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeVariantRow(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}

                        {/* GHOST ROW */}
                        <tr className="bg-muted/5 group">
                          <td className="px-2 py-1 text-center text-muted-foreground/30">
                            <Plus className="w-4 h-4 inline-block" />
                          </td>
                          <td className="p-1.5">
                            <Input 
                              ref={ghostInputRef}
                              placeholder="Adicionar nova opção..." 
                              value={ghostValue} 
                              onChange={(e) => setGhostValue(e.target.value)} 
                              onBlur={commitGhostRow}
                              onKeyDown={handleGhostKeyDown}
                              className="h-8 bg-transparent border-transparent placeholder:text-muted-foreground/60 focus:bg-background transition-colors shadow-none"
                            />
                          </td>
                          {gradeType === "Cor" && (
                            <td className="p-1.5">
                              <div className="flex items-center gap-2 opacity-50 focus-within:opacity-100 transition-opacity">
                                <input 
                                  type="color" 
                                  value={ghostColorHex} 
                                  onChange={(e) => setGhostColorHex(e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                />
                              </div>
                            </td>
                          )}
                          <td className="p-1.5 text-right"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Dica: Você pode arrastar as linhas pelo ícone à esquerda para alterar a ordem de exibição.</p>
                </TabsContent>

              </div>

              <DialogFooter className="pt-4 mt-4 border-t border-border/40">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                
                {!isFormValid ? (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block">
                          <Button 
                            type="submit" 
                            disabled={saving || !isFormValid}
                            className="bg-primary text-primary-foreground hover-elevate disabled:pointer-events-none disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Salvar
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getMissingTooltipText()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={saving}
                    className="bg-primary text-primary-foreground hover-elevate"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
