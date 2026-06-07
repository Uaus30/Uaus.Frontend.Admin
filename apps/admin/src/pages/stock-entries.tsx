import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Plus, 
  Trash2, 
  Search, 
  Calendar, 
  Truck, 
  Receipt, 
  FileText, 
  Eye, 
  X, 
  PlusCircle, 
  ArrowLeft,
  CalendarDays,
  Loader2
} from "lucide-react";
import { 
  useGetPurchaseEntries, 
  useGetPurchaseEntryDetails, 
  useReceivePurchaseEntry, 
  useDeletePurchaseEntry,
  apiGet
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getAllSuppliers } from "@/services/suppliers.service";
import { getAllProducts } from "@/services/products.service";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NewEntryItem {
  productId: string;
  quantity: number;
  unitCost: number;
  price: number;
}

export default function StockEntries() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [newEntryModalOpen, setNewEntryModalOpen] = useState(false);

  // Filters state
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("all");

  // New Entry Form State
  const [supplierId, setSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<NewEntryItem[]>([]);

  // Fetch entries
  const { data: entriesData, isLoading: isLoadingEntries, refetch: refetchEntries, isError, error } = useGetPurchaseEntries({
    page,
    limit: 10,
    supplierId: selectedSupplierFilter !== "all" ? Number(selectedSupplierFilter) : undefined
  });

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

  // Fetch entry details
  const { data: entryDetails, isLoading: isLoadingDetails } = useGetPurchaseEntryDetails(selectedEntryId ?? 0, {
    query: {
      enabled: !!selectedEntryId
    }
  });

  // Fetch suppliers and products for the form
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-all-for-entries"],
    queryFn: () => getAllSuppliers()
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-all-for-entries"],
    queryFn: () => getAllProducts()
  });

  // Mutations
  const { mutate: receiveEntry, isPending: isSavingEntry } = useReceivePurchaseEntry({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Entrada de estoque registrada com sucesso!" });
        setNewEntryModalOpen(false);
        resetNewEntryForm();
        refetchEntries();
      },
      onError: (err: any) => {
        toast({ 
          title: "Erro ao registrar entrada", 
          description: err?.message || "Ocorreu um erro no processamento.", 
          variant: "destructive" 
        });
      }
    }
  });

  const { mutate: deleteEntry } = useDeletePurchaseEntry({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Entrada removida e estoque recalculado!" });
        setDetailsModalOpen(false);
        setSelectedEntryId(null);
        refetchEntries();
      },
      onError: (err: any) => {
        toast({ 
          title: "Erro ao excluir entrada", 
          description: err?.message || "O estoque desta entrada já pode ter sido consumido.", 
          variant: "destructive" 
        });
      }
    }
  });

  const resetNewEntryForm = () => {
    setSupplierId("");
    setInvoiceNumber("");
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
    setItems([]);
  };

  const handleAddEmptyItem = () => {
    setItems(prev => [...prev, { productId: "", quantity: 1, unitCost: 0, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof NewEntryItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto fill selling price if product changes to help user
      if (field === "productId") {
        const prod = products.find(p => p.id === Number(value));
        if (prod) {
          updated.price = prod.price;
          updated.unitCost = prod.costPrice;
        }
      }

      return updated;
    }));
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast({ title: "Atenção", description: "Selecione um fornecedor.", variant: "warning" as any });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Atenção", description: "Adicione pelo menos um produto.", variant: "warning" as any });
      return;
    }

    // Validation
    const invalidItem = items.some(item => !item.productId || item.quantity <= 0 || item.unitCost < 0 || item.price < 0);
    if (invalidItem) {
      toast({ 
        title: "Atenção", 
        description: "Verifique se todos os produtos foram selecionados e se os valores são válidos.", 
        variant: "warning" as any 
      });
      return;
    }

    receiveEntry({
      data: {
        supplierId: Number(supplierId),
        entryDate: new Date(entryDate).toISOString(),
        invoiceNumber: invoiceNumber || null,
        notes: notes || null,
        items: items.map(i => ({
          productId: Number(i.productId),
          quantity: i.quantity,
          unitCost: i.unitCost,
          price: i.price
        }))
      }
    });
  };

  const handleViewDetails = (id: number) => {
    setSelectedEntryId(id);
    setDetailsModalOpen(true);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const formatShortDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Entradas de Estoque</h1>
            <p className="text-sm text-muted-foreground">Registre recebimentos de mercadorias para atualizar o estoque e preços dos produtos.</p>
          </div>
          <Button 
            onClick={() => {
              resetNewEntryForm();
              setNewEntryModalOpen(true);
            }} 
            className="bg-primary text-primary-foreground hover-elevate gap-2"
          >
            <Plus className="h-4 w-4" /> Registrar Entrada
          </Button>
        </div>

        {/* Filters and List */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">Histórico de Entradas</CardTitle>
                <CardDescription>Visualize todas as notas e registros de estoque.</CardDescription>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={selectedSupplierFilter} onValueChange={setSelectedSupplierFilter}>
                  <SelectTrigger className="w-full md:w-[200px] h-9">
                    <SelectValue placeholder="Filtrar por Fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os fornecedores</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntries || (isError && (error as any)?.status >= 500) ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : !entriesData?.data || entriesData.data.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma entrada de estoque encontrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-border/40 rounded-xl">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-4 py-3">Código/ID</TableHead>
                      <TableHead className="px-4 py-3">Data de Entrada</TableHead>
                      <TableHead className="px-4 py-3">Fornecedor</TableHead>
                      <TableHead className="px-4 py-3">Nº da Nota</TableHead>
                      <TableHead className="px-4 py-3 text-right">Valor Total</TableHead>
                      <TableHead className="px-4 py-3 text-right w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesData.data.map((entry) => {
                      const sup = suppliers.find(s => s.id === entry.supplierId);
                      return (
                        <TableRow key={entry.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="px-4 py-3 font-medium font-mono text-xs">#{entry.id}</TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <span className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatShortDate(entry.entryDate)}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm font-medium">
                            {sup?.name || "Não informado"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm font-mono">
                            {entry.invoiceNumber || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm font-semibold text-right text-emerald-500">
                            {formatCurrency(entry.total)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleViewDetails(entry.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {entriesData && entriesData.totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">Página {page} de {entriesData.totalPages}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === entriesData.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal: View Details */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Detalhes da Entrada #{selectedEntryId}
              </DialogTitle>
              <DialogDescription>Dados da entrada de mercadoria e lista de itens recebidos.</DialogDescription>
            </DialogHeader>

            {isLoadingDetails || !entryDetails ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <div className="flex flex-col gap-6 mt-4">
                {/* Meta details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Fornecedor</span>
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      {entryDetails.supplierName}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Data</span>
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatShortDate(entryDetails.entryDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Nota Fiscal</span>
                    <span className="text-sm font-semibold font-mono">
                      {entryDetails.invoiceNumber || "Não informada"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Valor Total</span>
                    <span className="text-sm font-bold text-emerald-500">
                      {formatCurrency(entryDetails.total)}
                    </span>
                  </div>
                </div>

                {entryDetails.notes && (
                  <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                    <span className="text-xs text-muted-foreground block mb-1">Observações</span>
                    <p className="text-sm text-foreground/80">{entryDetails.notes}</p>
                  </div>
                )}

                {/* Items Table */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Itens Recebidos</h4>
                  <div className="border border-border/40 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="px-4 py-2">Produto</TableHead>
                          <TableHead className="px-4 py-2">Cód. Barras</TableHead>
                          <TableHead className="px-4 py-2 text-right">Qtd.</TableHead>
                          <TableHead className="px-4 py-2 text-right">Custo Unit.</TableHead>
                          <TableHead className="px-4 py-2 text-right">Preço de Venda</TableHead>
                          <TableHead className="px-4 py-2 text-right">Custo Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entryDetails.items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/5">
                            <TableCell className="px-4 py-2 text-sm font-medium">{item.productName}</TableCell>
                            <TableCell className="px-4 py-2 text-sm font-mono text-xs">{item.barcode}</TableCell>
                            <TableCell className="px-4 py-2 text-sm font-semibold text-right">{item.quantity}</TableCell>
                            <TableCell className="px-4 py-2 text-sm text-right">{formatCurrency(item.unitCost)}</TableCell>
                            <TableCell className="px-4 py-2 text-sm text-right text-emerald-500 font-semibold">{formatCurrency(item.productPrice)}</TableCell>
                            <TableCell className="px-4 py-2 text-sm text-right font-semibold">{formatCurrency(item.totalCost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <DialogFooter className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
                  {entryDetails.canDelete && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      className="gap-2 mr-auto"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja cancelar esta entrada? Isto removerá os lotes de estoque associados e recalculará o estoque atual dos produtos.")) {
                          deleteEntry({ id: entryDetails.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Cancelar Entrada
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setDetailsModalOpen(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal: New Entry Registration */}
        <Dialog open={newEntryModalOpen} onOpenChange={setNewEntryModalOpen}>
          <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Registrar Entrada de Estoque
              </DialogTitle>
              <DialogDescription>Preencha os dados do fornecedor e lance as mercadorias recebidas.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEntry} className="flex flex-col gap-5 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Fornecedor <span className="text-red-500">*</span></label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Selecione um fornecedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Nº da Nota Fiscal / Identificador</label>
                  <Input 
                    placeholder="Ex: NF-1234" 
                    value={invoiceNumber} 
                    onChange={e => setInvoiceNumber(e.target.value)} 
                    className="h-10 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Data da Entrada <span className="text-red-500">*</span></label>
                  <Input 
                    type="date"
                    value={entryDate} 
                    onChange={e => setEntryDate(e.target.value)} 
                    className="h-10 bg-background"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Observações internas</label>
                <Textarea 
                  placeholder="Informações adicionais como frete, observações físicas..."
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  className="min-h-16"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    Produtos da Entrada
                  </h4>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddEmptyItem}
                    className="gap-1.5 h-8 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                  >
                    <PlusCircle className="h-4 w-4" /> Adicionar Produto
                  </Button>
                </div>

                <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/5">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="px-3 py-2">Produto <span className="text-red-500">*</span></TableHead>
                        <TableHead className="px-3 py-2 w-28 text-center">Quantidade <span className="text-red-500">*</span></TableHead>
                        <TableHead className="px-3 py-2 w-32 text-center">Custo Unit. <span className="text-red-500">*</span></TableHead>
                        <TableHead className="px-3 py-2 w-32 text-center">Preço Venda <span className="text-red-500">*</span></TableHead>
                        <TableHead className="px-3 py-2 text-right w-16">Remover</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                            Nenhum produto adicionado. Clique em "Adicionar Produto".
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item, index) => (
                          <TableRow key={index} className="hover:bg-muted/5">
                            <TableCell className="px-3 py-2">
                              <Select 
                                value={item.productId} 
                                onValueChange={val => handleItemChange(index, "productId", val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-background">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                                      {p.name} {p.barcode ? `(${p.barcode})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <Input 
                                type="number" 
                                min="1" 
                                value={item.quantity} 
                                onChange={e => handleItemChange(index, "quantity", Math.max(1, Number(e.target.value)))}
                                className="h-8 text-center text-xs bg-background"
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={item.unitCost} 
                                onChange={e => handleItemChange(index, "unitCost", Math.max(0, Number(e.target.value)))}
                                className="h-8 text-center text-xs bg-background"
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={item.price} 
                                onChange={e => handleItemChange(index, "price", Math.max(0, Number(e.target.value)))}
                                className="h-8 text-center text-xs bg-background"
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleRemoveItem(index)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
                <span className="text-xs text-muted-foreground">(*) Campos obrigatórios</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setNewEntryModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-primary text-primary-foreground" 
                    disabled={isSavingEntry}
                  >
                    {isSavingEntry ? "Salvando..." : "Salvar Entrada"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
