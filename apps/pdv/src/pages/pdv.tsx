import { useState, useEffect, useRef, useCallback, ElementType } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, apiGet, type ProductDto, type BackendPagedResult } from "@workspace/api-client-react";
import { usePdvStore, PaymentMethod } from "@/stores/use-pdv-store";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  ShoppingCart, 
  Tag, 
  CreditCard, 
  Banknote, 
  Smartphone,
  LogOut,
  Loader2,
  Menu as MenuIcon,
  Settings,
  History,
  Lock,
  MoreVertical,
  Sun,
  Moon,
  FileText,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CompletedSale } from "@/stores/use-pdv-store";


export default function Pdv() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Local state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [amountReceived, setAmountReceived] = useState("");
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<{ type: 'global' | 'item', id?: string }>({ type: 'global' });
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');

  // Menu and Modals state
  const [isSandwichMenuOpen, setIsSandwichMenuOpen] = useState(false);
  const [isFecharCaixaOpen, setIsFecharCaixaOpen] = useState(false);
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);
  const [pendingSaleToEdit, setPendingSaleToEdit] = useState<CompletedSale | null>(null);
  
  // Row options menu in Sales History
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

  // Fechar Caixa inputs
  const [fechamentoDinheiro, setFechamentoDinheiro] = useState("");
  const [fechamentoObs, setFechamentoObs] = useState("");
  
  // Store state
  const { 
    status, 
    items, 
    globalDiscount, 
    addItem, 
    removeItem, 
    updateQuantity, 
    applyItemDiscount,
    applyGlobalDiscount,
    setCheckout, 
    backToSelling,
    cancelSale, 
    finishSale, 
    getSubtotal, 
    getTotal,
    salesHistory,
    theme,
    setTheme,
    editingSaleId,
    addCompletedSale,
    updateSaleInHistory,
    cancelSaleFromHistory,
    clearSession
  } = usePdvStore();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Authentication check
  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isLoading, user, setLocation]);

  const addProductToCart = useCallback((product: ProductDto) => {
    addItem({
      productId: String(product.id),
      name: product.name,
      barcode: String(product.id),
      price: product.price,
      quantity: 1,
      discount: 0
    });
    toast({
      title: "Item adicionado",
      description: `${product.name} no carrinho.`,
      duration: 1500,
    });
  }, [addItem, toast]);

  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await apiGet<BackendPagedResult<ProductDto>>("/Products", {
        search: query,
        page: 1,
        size: 10
      });

      const foundItems = result.items || [];
      setSearchResults(foundItems);

      // Regra: se for busca exata por código (considerando query numérica e exatamente 1 resultado)
      const isNumeric = /^\d+$/.test(query);
      if (foundItems.length === 1 && (isNumeric || foundItems[0].id.toString() === query)) {
        addProductToCart(foundItems[0]);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setIsSearching(false);
    }
  }, [addProductToCart, setSearchQuery, setSearchResults, setIsSearching]);

  useEffect(() => {
    // Keep focus on search input for quick barcode scanning
    if (status === "IDLE" || status === "SELLING") {
      searchInputRef.current?.focus();
    }
  }, [status, items]);

  useEffect(() => {
    if (searchQuery.trim().length >= 3) {
      const timer = setTimeout(() => {
        executeSearch(searchQuery);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, executeSearch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;





  const handleApplyDiscount = (type: 'global' | 'item', id?: string) => {
    setDiscountTarget({ type, id });
    if (type === 'global') {
      setDiscountValue(globalDiscount > 0 ? globalDiscount.toFixed(2).replace(".", ",") : "");
      setDiscountType('value');
    } else if (type === 'item' && id) {
      const item = items.find(i => i.id === id);
      setDiscountValue(item && item.discount > 0 ? item.discount.toFixed(2).replace(".", ",") : "");
      setDiscountType('value');
    } else {
      setDiscountValue("");
    }
    setDiscountDialogOpen(true);
  };

  const confirmDiscount = () => {
    const val = parseFloat(discountValue.replace(",", "."));
    if (isNaN(val)) return;

    if (discountTarget.type === 'global') {
      const finalValue = discountType === 'percent' ? (subtotal * val) / 100 : val;
      if (finalValue > subtotal) {
        toast({
          title: "Desconto Inválido",
          description: "O desconto não pode ser maior que o subtotal da venda.",
          variant: "destructive",
        });
        return;
      }
      applyGlobalDiscount(finalValue);
    } else if (discountTarget.id) {
      const item = items.find(i => i.id === discountTarget.id);
      if (item) {
        const finalValue = discountType === 'percent' ? (item.price * val) / 100 : val;
        if (finalValue > item.price) {
          toast({
            title: "Desconto Inválido",
            description: "O desconto não pode ser maior que o preço original do item.",
            variant: "destructive",
          });
          return;
        }
        applyItemDiscount(discountTarget.id, finalValue);
      }
    }
    setDiscountDialogOpen(false);
  };

  const handleUpdateItemUnitPrice = (id: string, originalPrice: number, valueStr: string, inputEl?: HTMLInputElement) => {
    const val = parseFloat(valueStr.replace(",", "."));
    if (isNaN(val) || val < 0) {
      toast({
        title: "Valor Inválido",
        description: "Por favor, digite um preço unitário válido.",
        variant: "destructive",
      });
      if (inputEl) {
        const item = items.find(i => i.id === id);
        if (item) {
          inputEl.value = (item.price - item.discount).toFixed(2).replace(".", ",");
        }
      }
      return;
    }

    if (val > originalPrice) {
      toast({
        title: "Valor Superior ao Original",
        description: `O valor do item não pode ser superior ao preço original de ${formatCurrency(originalPrice)}.`,
        variant: "destructive",
      });
      if (inputEl) {
        const item = items.find(i => i.id === id);
        if (item) {
          inputEl.value = (item.price - item.discount).toFixed(2).replace(".", ",");
        }
      }
    } else {
      const discount = originalPrice - val;
      applyItemDiscount(id, discount);
      if (discount > 0) {
        toast({
          title: "Preço Atualizado",
          description: `Desconto de ${formatCurrency(discount)} aplicado no item.`,
          duration: 2000,
        });
      } else {
        toast({
          title: "Preço Restaurado",
          description: "O preço original do item foi restaurado.",
          duration: 2000,
        });
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };



  const handlePayment = () => {
    if (editingSaleId) {
      updateSaleInHistory(editingSaleId, items, globalDiscount, paymentMethod);
      toast({
        title: "Venda Atualizada!",
        description: `Venda ${editingSaleId} atualizada com sucesso.`,
        duration: 3000,
        className: "bg-emerald-500 text-white border-none",
      });
    } else {
      addCompletedSale({
        items,
        subtotal: getSubtotal(),
        globalDiscount,
        total: getTotal(),
        paymentMethod
      });
      toast({
        title: "Venda Finalizada!",
        description: `Total pago: ${formatCurrency(getTotal())} via ${paymentMethod}`,
        duration: 3000,
        className: "bg-emerald-500 text-white border-none",
      });
    }
    finishSale();
    setPaymentMethod("PIX");
    setAmountReceived("");
  };

  const handleExitClick = () => {
    const activeSales = salesHistory.filter(s => s.status === "FINALIZED");
    if (activeSales.length === 0) {
      clearSession();
      queryClient.clear();
      setLocation("/login");
      toast({
        title: "Caixa Fechado",
        description: "Fechamento automático realizado. Sessão encerrada.",
        duration: 3000,
      });
    } else {
      toast({
        title: "Fechamento Necessário",
        description: "Não é possível sair sem fechar o caixa. Efetue o fechamento primeiro.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const confirmFecharCaixa = () => {
    const cashVal = parseFloat(fechamentoDinheiro.replace(",", "."));
    if (isNaN(cashVal) || cashVal < 0) {
      toast({
        title: "Valor Inválido",
        description: "Por favor, informe um valor em dinheiro válido para a gaveta do caixa.",
        variant: "destructive",
      });
      return;
    }
    
    // Simulating cashier closing save
    console.log("Fechando caixa...", {
      dinheiroEmGaveta: cashVal,
      observacoes: fechamentoObs,
      vendasRealizadas: salesHistory.filter(s => s.status === "FINALIZED").length,
    });

    toast({
      title: "Caixa Fechado com Sucesso!",
      description: "Os dados de fechamento foram salvos. Encerrando sessão...",
      duration: 3000,
      className: "bg-emerald-500 text-white border-none",
    });

    setIsFecharCaixaOpen(false);
    clearSession();
    queryClient.clear();
    setLocation("/login");
  };

  const handleCancelSale = (id: string) => {
    cancelSaleFromHistory(id);
    toast({
      title: "Venda Cancelada",
      description: `A venda ${id} foi cancelada com sucesso.`,
      duration: 3000,
    });
  };

  const handleEditSale = (sale: CompletedSale) => {
    if (items.length > 0) {
      setPendingSaleToEdit(sale);
      setIsConfirmDiscardOpen(true);
    } else {
      loadSaleToCart(sale);
    }
  };

  const loadSaleToCart = (sale: CompletedSale) => {
    usePdvStore.setState({
      items: sale.items,
      globalDiscount: sale.globalDiscount,
      status: "SELLING",
      editingSaleId: sale.id
    });
    setPaymentMethod(sale.paymentMethod);
    setIsSalesHistoryOpen(false);
    
    toast({
      title: "Venda Carregada",
      description: `Editando a venda ${sale.id}. Faça as alterações e finalize.`,
      duration: 3000,
    });
  };

  const confirmDiscardAndEdit = () => {
    if (pendingSaleToEdit) {
      loadSaleToCart(pendingSaleToEdit);
      setPendingSaleToEdit(null);
    }
    setIsConfirmDiscardOpen(false);
  };



  const subtotal = getSubtotal();
  const total = getTotal();
  const change = paymentMethod === "CASH" && amountReceived 
    ? Math.max(0, parseFloat(amountReceived.replace(",", ".")) - total) 
    : 0;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* HEADER */}
      <header className="relative h-20 border-b border-border/50 bg-card/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <img src="/images/logo-icon.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-display font-bold leading-none text-xl tracking-tight">Uaus! Máximo 30</h1>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(var(--primary),0.2)]">
          <span className="font-mono text-lg font-bold tracking-wider">
            {currentTime.toLocaleTimeString("pt-BR")}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-sm font-bold tracking-tight">
              {user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : ((user as { name?: string }).name || "Operador")}
            </span>
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.1)]">
              <User className="w-5 h-5" />
            </div>
          </div>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSandwichMenuOpen(!isSandwichMenuOpen)} 
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
            >
              <MenuIcon className="w-5 h-5" />
            </Button>
            
            <AnimatePresence>
              {isSandwichMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsSandwichMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl z-40"
                  >
                    <button 
                      onClick={() => { setIsSandwichMenuOpen(false); setIsFecharCaixaOpen(true); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-primary" />
                      Fechar Caixa
                    </button>
                    <button 
                      onClick={() => { setIsSandwichMenuOpen(false); setIsSalesHistoryOpen(true); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <History className="w-4 h-4 text-primary" />
                      Histórico de Vendas
                    </button>
                    <button 
                      onClick={() => { setIsSandwichMenuOpen(false); setIsPreferencesOpen(true); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      Preferências
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button 
                      onClick={() => { setIsSandwichMenuOpen(false); handleExitClick(); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-destructive/10 text-destructive transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Search & Results */}
        <div className="flex-1 flex flex-col relative border-r border-border/50 bg-background/50">
          <div className="p-6 border-b border-border/50 bg-card z-20">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Código de barras ou nome do produto..."
                className="pl-12 h-14 text-lg font-medium bg-background border-primary/20 focus-visible:ring-primary shadow-inner"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold hover:scale-105 active:scale-95 transition-transform" disabled={isSearching}>
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "BUSCAR"}
                </Button>
              </div>
            </form>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {searchResults.length > 0 ? (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col p-6"
                >
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Resultados da Busca</h3>
                  <ScrollArea className="flex-1">
                    <div className="grid grid-cols-1 gap-2">
                      {searchResults.map((product) => (
                        <motion.div
                          key={product.id}
                          whileHover={{ scale: 1.01, backgroundColor: "hsl(var(--primary) / 0.05)" }}
                          className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card cursor-pointer group transition-all"
                          onClick={() => {
                            addProductToCart(product);
                            setSearchResults([]);
                            setSearchQuery("");
                          }}
                        >
                          <div>
                            <h4 className="font-bold text-lg">{product.name}</h4>
                            <p className="text-xs text-muted-foreground font-mono">ID: {product.id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-mono font-bold text-primary">{formatCurrency(product.price)}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold group-hover:text-primary transition-colors">Clique para adicionar</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-12"
                >
                  <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Search className="w-16 h-16 text-primary/30" />
                  </div>
                  <h2 className="text-4xl font-display font-bold text-foreground/20 uppercase tracking-widest">Aguardando Busca</h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT COLUMN: Cart (Resumo da Venda) */}
        <div className="w-[500px] flex flex-col bg-card shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-20 relative">
          <div className="p-6 border-b border-border/50 bg-muted/10">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> Resumo da Venda
            </h2>
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-2">
              <AnimatePresence>
                {items.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground italic">
                    Carrinho vazio
                  </div>
                ) : (
                  items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-3 rounded-lg border border-border/40 bg-background/50 group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-sm leading-tight">{item.name}</h4>
                          <span className="text-[10px] text-muted-foreground font-mono">{item.barcode}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground">Quantidade:</span>
                          <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border/30">
                            <Button 
                              variant="ghost" size="icon" className="h-6 w-6" 
                              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            >
                              <Minus className="w-2 h-2" />
                            </Button>
                            <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <Button 
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="w-2 h-2" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground">Valor Unitário:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-semibold">R$</span>
                            <Input
                              type="text"
                              className="w-16 h-7 text-xs font-mono font-bold px-1.5 py-0 text-center bg-background border-border focus-visible:ring-primary shadow-sm"
                              key={`${item.id}-${item.discount}`}
                              defaultValue={(item.price - item.discount).toFixed(2).replace(".", ",")}
                              onBlur={(e) => handleUpdateItemUnitPrice(item.id, item.price, e.target.value, e.target)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateItemUnitPrice(item.id, item.price, (e.target as HTMLInputElement).value, e.target as HTMLInputElement);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </div>
                        </div>
                        
                        <div className="text-right flex flex-col justify-end items-end h-[52px]">
                          <div className="flex flex-col">
                            {item.discount > 0 && (
                              <span className="text-[10px] text-emerald-500 line-through leading-none mb-0.5">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            )}
                            <span className="font-mono font-bold text-primary leading-none">
                              {formatCurrency((item.price - item.discount) * item.quantity)}
                            </span>
                          </div>
                          {item.discount > 0 ? (
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="h-4 p-0 text-[10px] text-emerald-500 hover:text-destructive transition-colors font-semibold"
                              onClick={() => {
                                applyItemDiscount(item.id, 0);
                                toast({
                                  title: "Desconto Removido",
                                  description: "O preço original do item foi restaurado.",
                                  duration: 2000,
                                });
                              }}
                            >
                              Remover Desconto
                            </Button>
                          ) : (
                            // Spacer to maintain same height alignment when no discount link is present
                            <div className="h-4" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
          
          <div className="p-6 bg-muted/5 border-t border-border/50 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              
              {globalDiscount > 0 && (
                <div className="flex justify-between items-center text-emerald-500 font-bold text-sm">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Desconto Total</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">- {formatCurrency(globalDiscount)}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-emerald-500 hover:text-destructive hover:bg-destructive/10 p-0 rounded cursor-pointer"
                      onClick={() => {
                        applyGlobalDiscount(0);
                        toast({
                          title: "Desconto Removido",
                          description: "O desconto total foi removido da venda.",
                          duration: 2000,
                        });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Total Final</p>
              <p className="text-5xl font-mono font-bold text-foreground tracking-tight">{formatCurrency(total)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                variant="outline" 
                className="h-14 font-bold text-xs tracking-widest border-primary/20 hover:bg-primary/5"
                onClick={() => handleApplyDiscount('global')}
                disabled={items.length === 0}
              >
                DESCONTO
              </Button>
              <Button 
                className="h-14 font-bold text-sm tracking-widest bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20"
                disabled={items.length === 0}
                onClick={setCheckout}
              >
                FINALIZAR
              </Button>
            </div>
            
            {items.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] text-muted-foreground hover:text-destructive"
                onClick={cancelSale}
              >
                CANCELAR VENDA
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* CHECKOUT MODAL */}
      <Dialog open={status === "CHECKOUT"} onOpenChange={(open) => !open && backToSelling()}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-card border-border shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-border/50">
            <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
              <Banknote className="w-6 h-6 text-primary" /> Pagamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecione a forma de pagamento para finalizar a venda.
            </DialogDescription>
          </div>
          
          <div className="p-6 grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Forma de Pagamento</Label>
              <div className="grid grid-cols-1 gap-3">
                <PaymentMethodBtn 
                  icon={Smartphone} label="Pix" value="PIX" 
                  current={paymentMethod} onClick={() => setPaymentMethod("PIX")} 
                />
                <PaymentMethodBtn 
                  icon={CreditCard} label="Cartão de Crédito" value="CREDIT_CARD" 
                  current={paymentMethod} onClick={() => setPaymentMethod("CREDIT_CARD")} 
                />
                <PaymentMethodBtn 
                  icon={CreditCard} label="Cartão de Débito" value="DEBIT_CARD" 
                  current={paymentMethod} onClick={() => setPaymentMethod("DEBIT_CARD")} 
                />
                <PaymentMethodBtn 
                  icon={Banknote} label="Dinheiro" value="CASH" 
                  current={paymentMethod} onClick={() => setPaymentMethod("CASH")} 
                />
              </div>
            </div>

            <div className="bg-background rounded-2xl p-6 border border-border/50 flex flex-col">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Total a Pagar</p>
                <p className="text-4xl font-mono font-bold text-primary">{formatCurrency(total)}</p>

                {paymentMethod === "CASH" && (
                  <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="space-y-2">
                      <Label>Valor Recebido</Label>
                      <Input 
                        type="text" 
                        placeholder="R$ 0,00" 
                        className="h-12 text-lg font-mono"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {change > 0 && (
                      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Troco</p>
                        <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(change)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button 
                size="lg" 
                className="w-full h-14 mt-6 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handlePayment}
              >
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* DISCOUNT DIALOG */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-6 bg-card border-border shadow-2xl">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> 
            Conceder Desconto {discountTarget.type === 'item' ? '(Item)' : 'Total'}
          </DialogTitle>
          <div className="mt-6 space-y-6">
            <div className="flex gap-2">
              <Button 
                variant={discountType === 'value' ? 'default' : 'outline'} 
                className="flex-1"
                onClick={() => setDiscountType('value')}
              >
                R$ Valor
              </Button>
              <Button 
                variant={discountType === 'percent' ? 'default' : 'outline'} 
                className="flex-1"
                onClick={() => setDiscountType('percent')}
              >
                % Porcentagem
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Quanto de desconto?</Label>
              <Input 
                type="text" 
                placeholder={discountType === 'value' ? "R$ 0,00" : "0 %"}
                className="h-12 text-lg font-mono"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setDiscountDialogOpen(false)}>
                Cancelar
              </Button>
              {((discountTarget.type === 'global' && globalDiscount > 0) || 
                (discountTarget.type === 'item' && (items.find(i => i.id === discountTarget.id)?.discount ?? 0) > 0)) && (
                <Button 
                  variant="outline" 
                  className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 cursor-pointer" 
                  onClick={() => {
                    if (discountTarget.type === 'global') {
                      applyGlobalDiscount(0);
                      toast({
                        title: "Desconto Removido",
                        description: "O desconto total foi removido.",
                        duration: 2000,
                      });
                    } else if (discountTarget.id) {
                      applyItemDiscount(discountTarget.id, 0);
                      toast({
                        title: "Desconto Removido",
                        description: "O desconto do item foi removido.",
                        duration: 2000,
                      });
                    }
                    setDiscountDialogOpen(false);
                  }}
                >
                  Remover
                </Button>
              )}
              <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={confirmDiscount}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FECHAR CAIXA DIALOG */}
      <Dialog open={isFecharCaixaOpen} onOpenChange={setIsFecharCaixaOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-card border-border shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-border/50">
            <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Fechamento de Caixa
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Confirme os valores da sessão antes de encerrar o caixa.
            </DialogDescription>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Session Stats Summary */}
            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/30">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total de Vendas</p>
                <p className="text-xl font-bold font-mono text-foreground">{salesHistory.filter(s => s.status === "FINALIZED").length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Faturamento Total</p>
                <p className="text-xl font-bold font-mono text-primary">
                  {formatCurrency(salesHistory.filter(s => s.status === "FINALIZED").reduce((acc, s) => acc + s.total, 0))}
                </p>
              </div>
              <div className="col-span-2 h-px bg-border/40 my-1" />
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Dinheiro (Espécie)</p>
                <p className="text-sm font-semibold font-mono">
                  {formatCurrency(salesHistory.filter(s => s.status === "FINALIZED" && s.paymentMethod === "CASH").reduce((acc, s) => acc + s.total, 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Pix / Cartões</p>
                <p className="text-sm font-semibold font-mono">
                  {formatCurrency(salesHistory.filter(s => s.status === "FINALIZED" && s.paymentMethod !== "CASH").reduce((acc, s) => acc + s.total, 0))}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fechamentoDinheiro" className="text-sm font-semibold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-primary" /> Dinheiro em Espécie na Gaveta
                </Label>
                <Input 
                  id="fechamentoDinheiro"
                  type="text"
                  placeholder="R$ 0,00"
                  className="h-12 text-lg font-mono"
                  value={fechamentoDinheiro}
                  onChange={(e) => setFechamentoDinheiro(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Informe o valor físico total presente no caixa.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechamentoObs" className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Observações
                </Label>
                <textarea 
                  id="fechamentoObs"
                  placeholder="Explique qualquer evento ou divergência ocorrida na sessão (opcional)..."
                  className="w-full min-h-[80px] p-3 rounded-lg border border-input bg-background/50 focus-visible:ring-primary/50 text-sm outline-none focus:border-primary transition-colors resize-none"
                  value={fechamentoObs}
                  onChange={(e) => setFechamentoObs(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1 cursor-pointer" onClick={() => setIsFecharCaixaOpen(false)}>
                Voltar
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-primary to-orange-600 font-bold hover:scale-105 active:scale-95 transition-transform cursor-pointer text-white border-none" 
                onClick={confirmFecharCaixa}
              >
                Confirmar Fechamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* HISTÓRICO DE VENDAS DIALOG */}
      <Dialog open={isSalesHistoryOpen} onOpenChange={setIsSalesHistoryOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] p-0 overflow-hidden bg-card border-border shadow-2xl flex flex-col">
          <div className="bg-primary/10 p-6 border-b border-border/50 shrink-0">
            <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-primary" /> Histórico de Vendas da Sessão
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Vendas efetuadas no caixa durante o dia em ordem decrescente de horário.
            </DialogDescription>
          </div>
          
          <ScrollArea className="flex-1 p-6 min-h-[350px]">
            {salesHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic">
                Nenhuma venda realizada nesta sessão.
              </div>
            ) : (
              <div className="space-y-3 pb-20">
                {salesHistory.map((sale) => {
                  const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
                  const isCanceled = sale.status === "CANCELED";
                  
                  return (
                    <div 
                      key={sale.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isCanceled 
                          ? "bg-destructive/5 border-destructive/20 opacity-70" 
                          : "bg-background/50 border-border/40 hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm">{sale.id}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{sale.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {isCanceled ? (
                              <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-bold uppercase">Cancelada</span>
                            ) : (
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Finalizada</span>
                            )}
                            <span className="text-[10px] bg-muted border border-border/30 text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase font-mono">{sale.paymentMethod}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-12">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Itens</p>
                          <p className="font-mono text-sm font-semibold text-foreground">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</p>
                        </div>
                        
                        <div className="text-right min-w-[100px]">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Valor Total</p>
                          <p className={`font-mono text-lg font-bold ${isCanceled ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                            {formatCurrency(sale.total)}
                          </p>
                        </div>

                        {/* Options Menu */}
                        <div className="relative">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => setActiveRowMenuId(activeRowMenuId === sale.id ? null : sale.id)}
                            disabled={isCanceled}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                          
                          {activeRowMenuId === sale.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveRowMenuId(null)} />
                              <div className="absolute right-0 mt-1 w-32 rounded-lg border border-border bg-popover p-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
                                <button
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    handleEditSale(sale);
                                  }}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-semibold hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    handleCancelSale(sale.id);
                                  }}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-semibold hover:bg-destructive/10 text-destructive transition-colors text-left cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t border-border/50 bg-muted/10 flex justify-end shrink-0">
            <Button onClick={() => setIsSalesHistoryOpen(false)} className="cursor-pointer">Fechar Histórico</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PREFERENCIAS DIALOG */}
      <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-card border-border shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-border/50">
            <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Preferências
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Ajuste as configurações gerais do sistema.
            </DialogDescription>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tema do Sistema</Label>
              <div className="flex gap-2">
                <Button 
                  variant={theme === "light" ? "default" : "outline"} 
                  className={`flex-1 gap-2 h-14 font-semibold cursor-pointer ${theme === "light" ? "bg-primary text-primary-foreground border-none" : "border-border/50 text-foreground"}`}
                  onClick={() => setTheme("light")}
                >
                  <Sun className="w-4 h-4" /> Claro
                </Button>
                <Button 
                  variant={theme === "dark" ? "default" : "outline"} 
                  className={`flex-1 gap-2 h-14 font-semibold cursor-pointer ${theme === "dark" ? "bg-primary text-primary-foreground border-none" : "border-border/50 text-foreground"}`}
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="w-4 h-4" /> Escuro
                </Button>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button onClick={() => setIsPreferencesOpen(false)} className="w-full cursor-pointer">
                Salvar e Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE DESCARTE PARA EDIÇÃO DIALOG */}
      <Dialog open={isConfirmDiscardOpen} onOpenChange={setIsConfirmDiscardOpen}>
        <DialogContent className="sm:max-w-[400px] p-6 bg-card border-border shadow-2xl">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
            Confirmar Descarte
          </DialogTitle>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Há itens ativos no carrinho de compras atual. Deseja descartar esta venda em andamento para editar a venda selecionada?
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1 cursor-pointer" onClick={() => setIsConfirmDiscardOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer border-none" onClick={confirmDiscardAndEdit}>
                Descartar e Editar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentMethodBtn({ 
  icon: Icon, label, value, current, onClick 
}: { 
  icon: ElementType, label: string, value: PaymentMethod, current: PaymentMethod, onClick: () => void 
}) {
  const isActive = current === value;
  return (
    <Button
      variant="outline"
      className={`h-14 justify-start gap-3 text-base border-2 transition-all ${
        isActive ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : "border-border/50 hover:border-primary/50 text-foreground"
      }`}
      onClick={onClick}
    >
      <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
      {label}
      {isActive && (
        <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
      )}
    </Button>
  );
}
