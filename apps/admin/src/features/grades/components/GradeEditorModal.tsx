import React, { useRef } from "react";
import { GripVertical, Info, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GradeType, GradeVariant } from "../types";

type GradeEditorModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback to trigger when visibility state changes */
  onOpenChange: (open: boolean) => void;
  /** Active tab ID ("info" | "categories" | "options") */
  activeTab: string;
  /** Callback to switch active tab */
  setActiveTab: (tab: string) => void;
  /** ID of the grade being edited (null for creation mode) */
  editingId: number | null;
  /** DTO payload of the grade being edited (null for creation mode) */
  editingGrade: any;
  /** Selected type of the grade (Tamanho, Cor, etc) */
  gradeType: GradeType;
  /** Callback to change selected grade type */
  setGradeType: (type: GradeType) => void;
  /** Grade type options fetched from API enums */
  selectableGradeTypeOptions: any[];
  /** Selected category IDs linked to this grade */
  selectedCategoryIds: number[];
  /** Callback to update selected category IDs */
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<number[]>>;
  /** Category filtering search query string */
  categorySearch: string;
  /** Callback triggered when category search query changes */
  setCategorySearch: (search: string) => void;
  /** Categories filtered by search query */
  filteredCategories: any[];
  /** Map of department ID to department name */
  departmentMap: Map<number, string>;
  /** List of variants added to the grade */
  variants: GradeVariant[];
  /** Index of the item currently being dragged, or null */
  draggedIndex: number | null;
  /** Value of the ghost variant row input */
  ghostValue: string;
  /** Callback to update value of ghost variant row input */
  setGhostValue: (val: string) => void;
  /** Color hex of the ghost variant row picker */
  ghostColorHex: string;
  /** Callback to update color hex of ghost variant row picker */
  setGhostColorHex: (val: string) => void;
  /** Indicates if a request is actively being saved to the API */
  saving: boolean;
  /** True if form validation checks pass successfully */
  isFormValid: boolean;
  /** True if at least one category is selected */
  hasCategories: boolean;
  /** True if at least one option variant is defined */
  hasOptions: boolean;
  /** Returns validation helper tooltip string */
  getMissingTooltipText: () => string;
  /** Callback to update field value of a variant at a specific index */
  updateVariant: (index: number, field: keyof GradeVariant, value: string) => void;
  /** Callback to remove a variant at a specific index */
  removeVariantRow: (index: number) => void;
  /** Callback to add the ghost row content as an option variant */
  commitGhostRow: () => void;
  /** Drag & Drop: Triggered when dragging starts */
  handleDragStart: (index: number) => void;
  /** Drag & Drop: Triggered when dragging over an item */
  handleDragOver: (e: React.DragEvent, index: number) => void;
  /** Drag & Drop: Triggered when dragging finishes */
  handleDragEnd: () => void;
  /** Callback triggered on form submission */
  onSubmit: (e: React.FormEvent) => void;
};

/**
 * GradeEditorModal
 * 
 * Tabbed dialog form component for creating and editing product dimension grades.
 */
export function GradeEditorModal({
  open,
  onOpenChange,
  activeTab,
  setActiveTab,
  editingId,
  editingGrade,
  gradeType,
  setGradeType,
  selectableGradeTypeOptions,
  selectedCategoryIds,
  setSelectedCategoryIds,
  categorySearch,
  setCategorySearch,
  filteredCategories,
  departmentMap,
  variants,
  draggedIndex,
  ghostValue,
  setGhostValue,
  ghostColorHex,
  setGhostColorHex,
  saving,
  isFormValid,
  hasCategories,
  hasOptions,
  getMissingTooltipText,
  updateVariant,
  removeVariantRow,
  commitGhostRow,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  onSubmit,
}: GradeEditorModalProps) {
  const ghostInputRef = useRef<HTMLInputElement>(null);

  const handleGhostKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitGhostRow();
      setTimeout(() => ghostInputRef.current?.focus(), 10);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
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
                              setSelectedCategoryIds((prev) => prev.filter((id) => id !== cat.id));
                            } else {
                              setSelectedCategoryIds((prev) => [...prev, cat.id]);
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
                          className={`transition-colors group bg-card ${draggedIndex === index ? "opacity-50" : "hover:bg-muted/20"}`}
                        >
                          <td className="px-2 py-1 text-center text-muted-foreground/50 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4 inline-block group-hover:text-muted-foreground transition-colors" />
                          </td>
                          <td className="p-1.5">
                            <Input
                              required
                              placeholder="Ex: P, Azul"
                              value={v.value}
                              onChange={(e) => updateVariant(index, "value", e.target.value)}
                              className="h-8 border-transparent hover:border-border focus:bg-background transition-colors"
                            />
                          </td>
                          {gradeType === "Cor" && (
                            <td className="p-1.5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={v.colorHex || "#000000"}
                                  onChange={(e) => updateVariant(index, "colorHex", e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                                />
                              </div>
                            </td>
                          )}
                          <td className="p-1.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeVariantRow(index)}
                            >
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

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
  );
}
