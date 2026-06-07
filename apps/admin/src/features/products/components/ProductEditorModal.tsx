import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagMultiSelect } from "@/components/tag-multi-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { Loader2, Plus, Save, Trash2, Upload, X, Grid3X3, AlertTriangle, HelpCircle, Printer } from "lucide-react";
import React, { useState, useEffect } from "react";
import Barcode from "react-barcode";
import type { useProductEditor } from "../hooks/useProductEditor";
import type { Grade, GradeVariant } from "../types";

function CurrencyInput({ id, value, onChange, className }: { id?: string, value: number, onChange: (val: number) => void, className?: string }) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString().replace('.', ','));

  useEffect(() => {
    if (!focused) {
      setLocalValue(value.toString().replace('.', ','));
    }
  }, [value, focused]);

  if (!focused) {
    return (
      <Input
        id={id}
        type="text"
        value={formatCurrency(value)}
        onFocus={() => {
          setFocused(true);
          if (value === 0) setLocalValue('');
        }}
        readOnly
        className={className}
      />
    );
  }

  return (
    <Input
      id={id}
      autoFocus
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => {
        let val = e.target.value;
        val = val.replace(/\./g, ',');
        val = val.replace(/[^\d,]/g, '');
        const parts = val.split(',');
        if (parts.length > 2) {
          val = parts[0] + ',' + parts.slice(1).join('');
        }
        setLocalValue(val);
      }}
      onBlur={() => {
        setFocused(false);
        const numericValue = Number(localValue.replace(',', '.'));
        onChange(isNaN(numericValue) ? 0 : numericValue);
      }}
      className={`${className} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}

type ProductEditorModalProps = {
  editor: ReturnType<typeof useProductEditor>;
};

export function ProductEditorModal({ editor }: ProductEditorModalProps) {
  const {
    modalOpen,
    setModalOpen,
    resetForm,
    form,
    setForm,
    departments,
    filteredCategories,
    productEditor,
    setProductEditor,
    selectableStatusOptions,
    tags,
    registerTag,
    images,
    setImages,
    moveProductImage,
    handleSimpleFileSelection,
    isFetchingGroupProducts,
    addVariationDraft,
    variationDrafts,
    statusOptions,
    handleDeleteVariation,
    updateVariationDraft,
    saving,
    handleSubmit,
    activeGrades,
    generateVariationsMatrix,
    gradesList,
    categoryGrades
  } = editor;

  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [selectedGradesInModal, setSelectedGradesInModal] = useState<number[]>([]);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [variationToDelete, setVariationToDelete] = useState<typeof variationDrafts[0] | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Reset modal selection when opening
  useEffect(() => {
    if (gridModalOpen) {
      setSelectedGradesInModal(activeGrades.map(g => g.id));
    }
  }, [gridModalOpen, activeGrades]);

  // Clear validation errors when modal opens or closes
  useEffect(() => {
    setValidationErrors({});
  }, [modalOpen]);

  const toggleGradeInModal = (gradeId: number) => {
    setSelectedGradesInModal(prev => 
      prev.includes(gradeId) ? prev.filter(id => id !== gradeId) : [...prev, gradeId]
    );
  };

  const handleGenerateMatrix = () => {
    if (variationDrafts.length > 0) {
      const confirm = window.confirm("Atenção! Gerar uma nova matriz de grades irá APAGAR TODAS as variações atuais que você configurou. Tem certeza de que deseja continuar?");
      if (!confirm) return;
    }
    
    generateVariationsMatrix(selectedGradesInModal);
    setGridModalOpen(false);

    setTimeout(() => {
      const el = document.getElementById("variations-table-container");
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, boolean> = {};
    let firstErrorElementId: string | null = null;

    if (!form.productGroupName.trim()) {
      errors.name = true;
      firstErrorElementId = "input-name";
    }
    if (!form.departmentId) {
      errors.department = true;
      if (!firstErrorElementId) firstErrorElementId = "select-department";
    }
    if (!form.categoryId) {
      errors.category = true;
      if (!firstErrorElementId) firstErrorElementId = "select-category";
    }

    if (!form.hasVariations) {
      if (!productEditor.price || productEditor.price <= 0) {
        errors.price = true;
        if (!firstErrorElementId) firstErrorElementId = "input-price";
      }
      if (!productEditor.status) {
        errors.status = true;
        if (!firstErrorElementId) firstErrorElementId = "select-status";
      }
    } else {
      variationDrafts.forEach((draft) => {
        if (!draft.name.trim()) {
          errors[`name-${draft.key}`] = true;
          if (!firstErrorElementId) firstErrorElementId = `input-name-${draft.key}`;
        }
        if (!draft.price || draft.price <= 0) {
          errors[`price-${draft.key}`] = true;
          if (!firstErrorElementId) firstErrorElementId = `input-price-${draft.key}`;
        }
        if (!draft.status) {
          errors[`status-${draft.key}`] = true;
          if (!firstErrorElementId) firstErrorElementId = `select-status-${draft.key}`;
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      if (firstErrorElementId) {
        const id = firstErrorElementId;
        setTimeout(() => document.getElementById(id)?.focus(), 50);
      }
      return;
    }

    setValidationErrors({});
    await handleSubmit(e);
  };

  const isEanValid = (code: string) => /^\d{8}$|^\d{13}$/.test(code);

  const handlePrintBarcode = (barcodeValue: string, customName?: string, customPrice?: number) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'printCompleted') {
        window.removeEventListener('message', handleMessage);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 100);
      }
    };
    window.addEventListener('message', handleMessage);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Etiqueta</title>
        <style>
          @page { margin: 0; size: 80mm 40mm; }
          body { 
            margin: 0; 
            padding: 8px; 
            width: 80mm; 
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .name { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 4px; max-height: 32px; overflow: hidden; text-overflow: ellipsis; }
          .price { font-size: 18px; font-weight: bold; margin-top: 4px; }
          svg { max-width: 100%; height: auto; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <div class="name">${(customName || form.productGroupName || 'Produto').toUpperCase().substring(0, 30)}</div>
        <svg id="barcode"></svg>
        <div class="price">${formatCurrency(customPrice !== undefined ? customPrice : (productEditor.price || 0))}</div>
        <script>
          window.onload = () => {
            JsBarcode("#barcode", "${barcodeValue}", {
              format: "${barcodeValue.length === 8 ? 'EAN8' : (barcodeValue.length === 13 ? 'EAN13' : 'CODE128')}",
              width: 2,
              height: 40,
              displayValue: true,
              fontSize: 14,
              margin: 0
            });
            setTimeout(() => {
              window.focus();
              window.print();
              window.parent.postMessage('printCompleted', '*');
            }, 100);
          };
        </script>
      </body>
      </html>
    `;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
  };

  const currentBarcode = productEditor.barcode || "";
  const isValidEnteredEan = isEanValid(currentBarcode);
  const isFactoryEan = isValidEnteredEan && currentBarcode.length === 13 && !currentBarcode.startsWith("2");
  
  useEffect(() => {
    if (isFactoryEan) {
      setFlashSuccess(true);
      const timer = setTimeout(() => setFlashSuccess(false), 800);
      return () => clearTimeout(timer);
    } else {
      setFlashSuccess(false);
      return;
    }
  }, [isFactoryEan]);

  const calculateEan13CheckDigit = (code: string) => {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
  };

  const isNumeric = /^\d+$/.test(currentBarcode);
  let suffix = String(productEditor.id || 1);
  if (isNumeric && currentBarcode.length > 0 && currentBarcode.length <= 11) {
    suffix = currentBarcode;
  }
  
  // Generated placeholder internally for presentation if nothing is valid
  let displayBarcode = currentBarcode;
  if (!isValidEnteredEan) {
    const prefix12 = "2" + suffix.padStart(11, "0");
    const checkDigit = calculateEan13CheckDigit(prefix12);
    displayBarcode = prefix12 + checkDigit.toString();
  }


  return (
    <>
    <Dialog
      open={modalOpen}
      onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) resetForm();
      }}
    >
      <DialogContent aria-describedby={undefined} className="flex max-h-[90vh] flex-col border-border/50 bg-card sm:max-w-[900px] lg:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {form.productGroupName ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleLocalSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto py-4 pr-2">
            <div className="space-y-6 rounded-2xl border border-border/50 bg-background/40 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium">Código de barras</label>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger type="button" tabIndex={-1}>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Deixe vazio para geração automática do código de barras caso deseje.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-4">
                    <Input 
                      value={productEditor.barcode || ""} 
                      onChange={(event) => setProductEditor((current) => ({ ...current, barcode: event.target.value }))} 
                      className={`bg-background flex-1 font-mono transition-all duration-300 ${flashSuccess ? "animate-border-flash" : ""}`} 
                      placeholder="Ex: 7891234567890" 
                    />
                    <div className={`flex items-center bg-white px-2 py-1 rounded border transition-all duration-300 ${currentBarcode.length === 0 ? "opacity-40 grayscale" : "opacity-100"}`}>
                      <Barcode 
                        value={displayBarcode} 
                        format={displayBarcode.length === 8 ? "EAN8" : "EAN13"} 
                        height={30} width={1.5} fontSize={12} margin={0} background="transparent" 
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handlePrintBarcode(displayBarcode)}
                      title="Imprimir etiqueta (80mm)"
                      disabled={currentBarcode.length === 0}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Nome <span className="text-red-500">*</span></label>
                  <Input 
                    id="input-name"
                    value={form.productGroupName} 
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase();
                      setForm((current) => ({ ...current, productGroupName: value }));
                      setProductEditor((current) => ({ ...current, name: value }));
                      if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: false }));
                    }} 
                    className={`bg-background uppercase ${validationErrors.name ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500" : ""}`} 
                    placeholder="EX: COPO TÉRMICO 500ML" 
                  />
                  {validationErrors.name && <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>}
                </div>
                
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="bg-background" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Departamento <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <Select
                      value={form.departmentId}
                      onValueChange={(value) => {
                        setForm((current) => ({ ...current, departmentId: value, categoryId: "" }));
                        if (validationErrors.department) setValidationErrors(prev => ({ ...prev, department: false }));
                      }}
                    >
                      <SelectTrigger id="select-department" className={`bg-background flex-1 ${validationErrors.department ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id.toString()}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => window.open('/departamentos', '_blank')}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationErrors.department && <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <Select value={form.categoryId} onValueChange={(value) => {
                      setForm((current) => ({ ...current, categoryId: value }));
                      if (validationErrors.category) setValidationErrors(prev => ({ ...prev, category: false }));
                    }}>
                      <SelectTrigger id="select-category" className={`bg-background flex-1 ${validationErrors.category ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => window.open('/categorias', '_blank')}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationErrors.category && <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>}
                </div>

                {!form.hasVariations && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Preço de venda (R$) <span className="text-red-500">*</span></label>
                      <CurrencyInput 
                        id="input-price"
                        value={productEditor.price} 
                        onChange={(val) => {
                          setProductEditor((current) => ({ ...current, price: val }));
                          if (validationErrors.price) setValidationErrors(prev => ({ ...prev, price: false }));
                        }} 
                        className={`bg-background w-full ${validationErrors.price ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`} 
                      />
                      {validationErrors.price && <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status <span className="text-red-500">*</span></label>
                      <Select 
                        value={productEditor.status} 
                        onValueChange={(value) => {
                          setProductEditor((current) => ({ ...current, status: value }));
                          if (validationErrors.status) setValidationErrors(prev => ({ ...prev, status: false }));
                        }}
                      >
                        <SelectTrigger id="select-status" className={`bg-background w-full ${validationErrors.status ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableStatusOptions.map((status) => (
                            <SelectItem key={status.id} value={status.id.toString()}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.status && <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <label className="text-sm font-medium">Estoque mínimo</label>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger type="button" tabIndex={-1}>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Defina um valor maior que zero para controlar o estoque deste produto.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input type="number" min="0" value={productEditor.minStock} onChange={(event) => setProductEditor((current) => ({ ...current, minStock: Number(event.target.value) }))} className="bg-background" required />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <label className="text-sm font-medium">Estoque atual</label>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger type="button" tabIndex={-1}>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Calculado automaticamente com base nas entradas de estoque.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input type="number" value={productEditor.stock} readOnly className="bg-muted/30 text-muted-foreground cursor-not-allowed" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visibilidade</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer border border-border/50 rounded-md px-3 h-10 bg-card hover:bg-muted/50 transition-colors w-full justify-between">
                      <span className="font-medium shrink-0">Exibir no site</span>
                      <Switch checked={form.isPublic} onCheckedChange={(checked) => setForm(current => ({ ...current, isPublic: checked === true }))} />
                    </label>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Etiquetas</label>
                  <TagMultiSelect
                    allTags={tags}
                    selectedIds={productEditor.tagIds}
                    onChange={(tagIds) => setProductEditor((current) => ({ ...current, tagIds }))}
                    onTagCreated={registerTag}
                    placeholder="Selecione ou crie uma nova etiqueta"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border/30 pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium">Imagens do produto</label>
                    {images.length > 1 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger type="button" tabIndex={-1}>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Arraste as imagens para definir a ordenação.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>

                {images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {images.map((image, index) => (
                      <div 
                        key={`${image.name}-${index}`} 
                        className="relative overflow-hidden rounded-xl border border-border/50 bg-background/50 cursor-grab active:cursor-grabbing hover:ring-2 ring-primary/50 transition-all"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", index.toString());
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const oldIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          if (!isNaN(oldIndex) && oldIndex !== index) {
                            editor.reorderProductImage(oldIndex, index);
                          }
                        }}
                      >
                        <img src={image.url} alt={image.name} className="aspect-square w-full object-cover pointer-events-none" />
                        <div className="p-2 pointer-events-none">
                          <p className="truncate text-xs font-medium">{image.name}</p>
                          {index === 0 && <p className="mt-1 text-[10px] text-primary">Imagem principal</p>}
                        </div>
                        <div className="absolute right-2 top-2 flex gap-1">
                          <button
                            type="button"
                            className="rounded bg-card/90 p-1 text-destructive hover:bg-destructive/10"
                            onClick={() => setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <label className="relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border/40 bg-background/20 hover:bg-muted/30 hover:border-primary/40 transition-colors cursor-pointer aspect-square min-h-[140px]">
                      <Plus className="h-10 w-10 text-muted-foreground/50" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleSimpleFileSelection} />
                    </label>
                  </div>
                ) : (
                  <label className="block rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-muted/20 p-8 text-center text-muted-foreground text-sm cursor-pointer transition-colors">
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-medium">Nenhuma imagem selecionada</p>
                    <p className="text-xs mt-1">Clique para adicionar fotos.</p>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleSimpleFileSelection} />
                  </label>
                )}
              </div>
            </div>

            {variationDrafts.length > 0 && (
              <div id="variations-table-container" className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-5 mt-6 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">VARIAÇÕES DO PRODUTO</h2>
                  {isFetchingGroupProducts ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                </div>

                <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/80">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="px-4 py-3 font-medium w-48 text-center">CÓDIGO</th>
                        <th className="px-4 pl-7 py-3 font-medium">Nome</th>
                        {activeGrades.map(g => (
                          <th key={g.id} className="px-3 py-3 font-medium w-32 border-l border-border/30 bg-muted/20 text-foreground">{g.name}</th>
                        ))}
                        <th className="px-4 py-3 font-medium w-32 text-center">PREÇO <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 font-medium w-32 text-center">Status <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 font-medium text-right w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {variationDrafts.map((variation) => (
                        <tr key={variation.key} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <Input 
                                value={variation.barcode || ""} 
                                onChange={(e) => updateVariationDraft(variation.key, draft => ({ ...draft, barcode: e.target.value }))}
                                placeholder="Auto"
                                className="h-8 bg-transparent border-transparent hover:border-border focus:bg-background font-mono text-xs text-center"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                                onClick={() => handlePrintBarcode(variation.barcode || "", variation.name, variation.price)}
                                disabled={!(variation.barcode && variation.barcode.trim().length > 0)}
                                title="Imprimir etiqueta"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <Input 
                              id={`input-name-${variation.key}`}
                              value={variation.name} 
                              onChange={(e) => {
                                updateVariationDraft(variation.key, draft => ({ ...draft, name: e.target.value }));
                                if (validationErrors[`name-${variation.key}`]) setValidationErrors(prev => ({ ...prev, [`name-${variation.key}`]: false }));
                              }}
                              className={`h-8 bg-transparent border-transparent hover:border-border focus:bg-background uppercase ${validationErrors[`name-${variation.key}`] ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}
                            />
                            {validationErrors[`name-${variation.key}`] && <p className="text-[10px] text-red-500 font-medium leading-tight mt-0.5">Preenchimento obrigatório</p>}
                          </td>
                          {activeGrades.map(g => {
                            const variantId = variation.variantMap?.[g.id];
                            return (
                              <td key={g.id} className="px-2 py-2 border-l border-border/30 bg-muted/5">
                                <Select 
                                  value={variantId?.toString() || ""} 
                                  onValueChange={(val) => {
                                    const newVariantMap = { ...variation.variantMap, [g.id]: Number(val) };
                                    updateVariationDraft(variation.key, draft => ({ ...draft, variantMap: newVariantMap }));
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-transparent border-transparent hover:border-border">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {g.variants.map(v => (
                                      <SelectItem key={v.id} value={v.id.toString()}>{v.value}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 text-center">
                            <CurrencyInput 
                              id={`input-price-${variation.key}`}
                              value={variation.price} 
                              onChange={(val) => {
                                updateVariationDraft(variation.key, draft => ({ ...draft, price: val }));
                                if (validationErrors[`price-${variation.key}`]) setValidationErrors(prev => ({ ...prev, [`price-${variation.key}`]: false }));
                              }}
                              className={`h-8 bg-transparent border-transparent hover:border-border focus:bg-background cursor-pointer focus:cursor-text text-center ${validationErrors[`price-${variation.key}`] ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}
                            />
                            {validationErrors[`price-${variation.key}`] && <p className="text-[10px] text-red-500 font-medium leading-tight mt-0.5">Preenchimento obrigatório</p>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Select 
                              value={variation.status} 
                              onValueChange={(value) => {
                                updateVariationDraft(variation.key, draft => ({ ...draft, status: value }));
                                if (validationErrors[`status-${variation.key}`]) setValidationErrors(prev => ({ ...prev, [`status-${variation.key}`]: false }));
                              }}
                            >
                              <SelectTrigger id={`select-status-${variation.key}`} className={`h-8 bg-transparent border-transparent hover:border-border focus:bg-background justify-center text-center ${validationErrors[`status-${variation.key}`] ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {selectableStatusOptions.map(status => (
                                  <SelectItem key={status.id} value={status.id.toString()}>{status.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {validationErrors[`status-${variation.key}`] && <p className="text-[10px] text-red-500 font-medium leading-tight mt-0.5">Preenchimento obrigatório</p>}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={variation.id != null && variation.canDelete === false}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (variation.id != null) {
                                  setVariationToDelete(variation);
                                } else {
                                  handleDeleteVariation(variation);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      
                      {/* Ghost Row */}
                      <tr className="hover:bg-muted/10 transition-colors border-t border-dashed border-primary/20 bg-primary/5 group">
                        <td className="px-4 py-2 text-center">
                          <Input 
                            placeholder="0000000000000"
                            className="h-8 bg-transparent border-transparent group-hover:border-primary/30 focus:bg-background font-mono text-xs focus:border-primary text-center"
                            onBlur={(e) => { if(e.target.value.trim()) { addVariationDraft({ barcode: e.target.value.trim() }); e.target.value = ''; } }}
                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input 
                            placeholder="ADICIONAR VARIAÇÃO..."
                            className="h-8 bg-transparent border-transparent group-hover:border-primary/30 focus:bg-background uppercase focus:border-primary text-xs"
                            onBlur={(e) => { if(e.target.value.trim()) { addVariationDraft({ name: e.target.value.trim().toUpperCase() }); e.target.value = ''; } }}
                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                          />
                        </td>
                        <td colSpan={2 + activeGrades.length} className="px-4 py-2"></td>
                        <td className="px-4 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 flex sm:justify-between items-center border-t border-border/40 mt-4">
              {!form.hasVariations && variationDrafts.length === 0 ? (
                <Button 
                  type="button" 
                  className="bg-orange-500 hover:bg-orange-600 text-white" 
                  onClick={() => {
                    if (categoryGrades && categoryGrades.length > 0) {
                      generateVariationsMatrix(categoryGrades.map(g => g.id));
                    } else {
                      setGridModalOpen(true);
                    }
                  }}
                >
                  Cadastrar Variações
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2 mt-4 sm:mt-0">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover-elevate">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Salvar</>}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    
    <AlertDialog open={variationToDelete !== null} onOpenChange={(open) => !open && setVariationToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Variação</AlertDialogTitle>
          <AlertDialogDescription>A exclusão de uma variação é irreversível, deseja continuar?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            type="button" 
            className="bg-destructive hover:bg-destructive/90 text-white" 
            onClick={() => {
              if (variationToDelete) {
                handleDeleteVariation(variationToDelete);
                setVariationToDelete(null);
              }
            }}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    
    {/* GRID SELECTION MODAL (MOCK) */}
    <Dialog open={gridModalOpen} onOpenChange={setGridModalOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-primary" />
            Configurar Grades
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-start gap-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 p-3 rounded-xl border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm leading-tight">
              Aviso: Gerar a matriz cruzará as opções das grades selecionadas. Combinações repetidas serão bloqueadas.
            </p>
          </div>
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
            {gradesList.map((grade: Grade) => (
              <label key={grade.id} className="flex items-start gap-3 p-3 border rounded-xl bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox 
                  checked={selectedGradesInModal.includes(grade.id)}
                  onCheckedChange={() => toggleGradeInModal(grade.id)}
                />
                <div>
                  <p className="font-medium text-sm text-foreground">{grade.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {grade.variants.map((v: GradeVariant) => v.value).join(", ")}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setGridModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleGenerateMatrix}>Gerar Variações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
