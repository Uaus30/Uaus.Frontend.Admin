import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  apiGet,
  clearAuthSession,
  useGetPaymentMethods,
  PAYMENT_STATUS,
  enumCode,
  type ProductDto,
  type ProductPdvSearchDto,
  type PaymentMethodDto,
  type SaleDto,
} from "@workspace/api-client-react";
import {
  buildReceiptFromSale,
  printReceipt,
  printSalesReport,
  resolveStoreInfo,
  type ReceiptData,
} from "@workspace/receipt";
import { usePdvStore, type HeldSale, type PdvItem } from "@/stores/use-pdv-store";
import { useShallow } from "zustand/react/shallow";
import { useCheckout, type CheckoutPayment } from "@/hooks/use-checkout";
import { useCalculatorStore } from "@/stores/use-calculator-store";
import { useOfflineStore } from "@/stores/use-offline-store";
import { Calculator } from "@/components/calculator";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { DiscountDialog } from "@/components/discount-dialog";
import { SalesHistoryDialog } from "@/components/sales-history-dialog";
import { FontSizeControl } from "@/components/font-size-control";
import { HeldSalesDialog } from "@/components/held-sales-dialog";
import { OfflineStatus } from "@/components/offline-status";
import { Clock } from "@/components/clock";
import { StockWriteOffDialog } from "@/components/stock-write-off-dialog";
import { useCashRegister } from "@/hooks/use-cash-register";
import { OpenCashRegisterDialog, CloseCashRegisterDialog } from "@/components/cash-register-dialogs";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useOfflinePdv } from "@/hooks/use-offline-pdv";
import { clearLocalCatalog, closeLocalDatabase, listLocalPaymentMethods } from "@/offline";
import {
  cancelSale as cancelSaleRequest,
  getSaleItems,
  newClientReference,
  registerSale,
  restoreCancelledSaleStock,
  updateSale,
  LocalStockError,
} from "@/services/sales.service";
import { formatCurrency } from "@/lib/formatters";
import { searchProducts } from "@/lib/product-search";
import { parseAmount, round2 } from "@/lib/checkout";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  User,
  ShoppingCart,
  Tag,
  LogOut,
  Loader2,
  Menu as MenuIcon,
  Settings,
  History,
  Lock,
  Sun,
  Moon,
  FileText,
  Printer,
  PauseCircle,
  PackageMinus,
  Calculator as CalculatorIcon,
  FileBarChart,
  DollarSign,
  Unlock,
  } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/** Uma das formas de pagamento escolhidas no checkout. */

/** Arredonda para duas casas evitando o erro de ponto flutuante do JavaScript. */

/**
 * Tela do PDV: busca de produtos, carrinho, checkout com N formas de pagamento,
 * histórico da sessão e abertura/fechamento de caixa.
 *
 * Toda venda é gravada na API e vinculada à sessão de caixa aberta — sem caixa
 * aberto a tela fica bloqueada pelo diálogo de abertura.
 */
export default function Pdv() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();


  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductPdvSearchDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);




  const [savingSale, setSavingSale] = useState(false);

  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<{ type: "global" | "item"; id?: string }>({ type: "global" });

  const [isSandwichMenuOpen, setIsSandwichMenuOpen] = useState(false);
  const [isStockWriteOffOpen, setIsStockWriteOffOpen] = useState(false);
    const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);
  const [isHeldSalesOpen, setIsHeldSalesOpen] = useState(false);
  const [printingReport, setPrintingReport] = useState(false);
  const [isFecharCaixaOpen, setIsFecharCaixaOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);
  const [pendingSaleToEdit, setPendingSaleToEdit] = useState<SaleDto | null>(null);
  const [busySaleId, setBusySaleId] = useState<number | null>(null);

  const [aberturaValor, setAberturaValor] = useState("");
  const [aberturaObs, setAberturaObs] = useState("");
  const [abrindoCaixa, setAbrindoCaixa] = useState(false);

  // const [fechamentoDinheiro, setFechamentoDinheiro] = useState("");
  // const [fechamentoObs, setFechamentoObs] = useState("");
  
  /**
   * O que as configurações da empresa mudam aqui.
   *
   * `mode` responde as perguntas que a tela faz sobre controle de caixa. Hoje
   * ele sempre exige sessão — o backend recusa venda sem `cashRegisterSessionId`
   * —, mas todos os pontos que assumiam sessão obrigatória já passam por ele.
   * Ver o bloqueio documentado em `lib/cash-register-mode.ts`.
   *
   * `settings` também carrega a identidade da loja que sai impressa nos cupons
   * — resolvida com fallback por `resolveStoreInfo` em cada ponto de impressão,
   * porque a cópia local pode ser de uma versão sem os campos.
   */
  const { settings: companySettings, mode } = useCompanySettings();

  const {
    session,
    sessionId,
    isSessionFromCache,
    summary,
    sales,
    loadingSession,
    loadingSales,
    open: openCashRegister,
    close: closeCashRegister,
    refreshSales,
  } = useCashRegister({ enabled: mode.requiresOpenSession });

  const {
    online,
    queuedCount,
    queuedSalesCount,
    hasLocalDatabase,
    // sync: syncPendingQueuesNow,
  } = useOfflinePdv(sessionId);

  const { data: dbPaymentMethodsData } = useGetPaymentMethods(
    { isActive: true, size: 100 },
    // Sem conexão a requisição só falharia; as formas vêm da base local.
    { query: { enabled: online } },
  );

  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethodDto[]>([]);

  /**
   * Formas de pagamento do checkout: a API quando ela responde, a base local
   * quando não. O formato é o mesmo, então o resto da tela não precisa saber de
   * onde veio — só o parcelamento com taxa importa, e ele vem nos dois casos.
   */
  const paymentMethods: PaymentMethodDto[] = useMemo(() => {
    const fromApi = (dbPaymentMethodsData?.data ?? []).filter((pm) => pm.isActive);
    return fromApi.length > 0 ? fromApi : localPaymentMethods;
  }, [dbPaymentMethodsData, localPaymentMethods]);

  // As formas locais são carregadas sempre, não só quando cai a conexão: a queda
  // pode acontecer com o checkout já aberto, e buscar na hora deixaria o operador
  // sem forma de pagamento na tela.
  useEffect(() => {
    let active = true;

    void listLocalPaymentMethods()
      .then((methods) => {
        if (!active) return;
        setLocalPaymentMethods(
          methods.map<PaymentMethodDto>((method) => ({
            id: method.id,
            // O snapshot só traz o que o checkout usa; as datas de auditoria não
            // fazem parte dele e nada na tela as consulta.
            createdAt: "",
            updatedAt: null,
            name: method.name,
            isActive: true,
            installments: method.installments.map((installment) => ({
              id: installment.id,
              paymentMethodId: method.id,
              installmentNumber: installment.installmentNumber,
              feePercentage: installment.feePercentage,
              isActive: true,
            })),
          })),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [hasLocalDatabase]);

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
    ensureSaleClientReference,
    getSubtotal,
    getTotal,
    theme,
    setTheme,
    autoPrintReceipt,
    setAutoPrintReceipt,
    consumer,
    setConsumer,
    heldSales,
    holdSale,
    editingSaleId,
    loadSaleForEditing,
    clearSession,
  } = usePdvStore(useShallow((state) => state));

  const toggleCalculator = useCalculatorStore((state) => state.toggleOpen);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading } = useGetMe({
    query: { retry: false, staleTime: 5 * 60 * 1000 },
  });

  const operatorName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : ((user as { name?: string } | undefined)?.name || "Operador");

  /** Nome de cada forma de pagamento por ID, para o cupom de vendas antigas. */
  const paymentMethodNameById = useMemo(
    () => Object.fromEntries(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods],
  );

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [isLoading, user, setLocation]);

  const subtotal = getSubtotal();
  const total = getTotal();

  const checkout = useCheckout(subtotal, paymentMethods);

  /**
   * Adiciona o produto ao carrinho recusando produto zerado ou quantidade
   * acima do estoque disponível.
   */
  const addProductToCart = useCallback(
    (product: ProductPdvSearchDto) => {
      if (product.stock <= 0) {
        toast({
          title: "Produto sem estoque",
          description: `${product.name} está zerado no estoque e não pode ser vendido.`,
          variant: "destructive",
        });
        return;
      }

      const inCart = usePdvStore.getState().items.find((i) => i.productId === product.id);
      if (inCart && inCart.quantity + 1 > product.stock) {
        toast({
          title: "Estoque insuficiente",
          description: `Só há ${product.stock} unidade(s) de ${product.name}.`,
          variant: "destructive",
        });
        return;
      }

      addItem({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        quantity: 1,
        discount: 0,
        availableStock: product.stock,
      });

      toast({ title: "Item adicionado", description: `${product.name} no carrinho.`, duration: 1500 });
    },
    [addItem, toast],
  );

  /**
   * Busca produtos por nome ou código de barras. Quando o termo casa exatamente
   * com um único código de barras, o item entra direto no carrinho (leitor).
   *
   * A busca em si — e o fallback para a base local quando a API não responde —
   * vive em `lib/product-search.ts`, compartilhada com o diálogo de baixa de
   * estoque. O que fica aqui é o que é do balcão: carrinho e aviso na tela.
   */
  const executeSearch = useCallback(
    async (query: string) => {
      const term = query.trim();
      if (!term) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const found = await searchProducts(term, { online });
        setSearchResults(found);

        // Leitura de código de barras: match exato e único cai direto no carrinho.
        const exact = found.filter((product) => product.barcode === term || (product.barcode ?? "").trim() === term);
        if (exact.length === 1) {
          addProductToCart(exact[0]);
          setSearchQuery("");
          setSearchResults([]);
        } else if (found.length === 0) {
          toast({
            title: "Produto não encontrado",
            description: online
              ? `Nenhum produto encontrado para "${term}".`
              : `Nenhum produto com "${term}" na base local. Verifique no badge OFFLINE se o catálogo foi baixado.`,
            variant: "destructive",
            duration: 4000,
          });
        }
      } catch (error) {
        toast({
          title: "Erro na busca",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    },
    [addProductToCart, online, toast],
  );

  /** Devolve o cursor para a busca de produtos, onde o leitor de código digita. */
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);

  /**
   * Foco no campo de busca só ao abrir o PDV — e, mais abaixo, ao encerrar uma
   * venda. Refocar a cada mudança de carrinho roubava o cursor de quem estava
   * editando a quantidade ou o preço de um item.
   */
  useEffect(() => {
    if (!sessionId) return;
    focusSearch();
  }, [sessionId, focusSearch]);

  useEffect(() => {
    if (searchQuery.trim().length < 3) return;
    const timer = setTimeout(() => executeSearch(searchQuery), 600);
    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  // O pagamento só é inicializado UMA vez por checkout. Sem o guard, qualquer
  // refetch de /PaymentMethods em segundo plano (foco na janela, reconexão
  // invalidando o cache) trocava a identidade do array `paymentMethods`, o
  // efeito rodava de novo e a seleção do operador (cartão, parcelas, divisão,
  // valor recebido) era silenciosamente trocada pela primeira forma da lista.
  const checkoutInitializedRef = useRef(false);

  // Setters de useState têm identidade estável, então declará-los nas deps
  // satisfaz o exhaustive-deps sem reintroduzir o disparo extra que o objeto
  // `checkout` inteiro causaria (ele é recriado a cada render).
  const { setPayments, setSplitPayment, setAmountReceived } = checkout;

  useEffect(() => {
    if (status !== "CHECKOUT") {
      // Saiu do checkout: o próximo abre zerado de novo.
      checkoutInitializedRef.current = false;
      return;
    }

    if (checkoutInitializedRef.current || paymentMethods.length === 0) return;
    checkoutInitializedRef.current = true;

    setPayments([{ paymentMethodId: paymentMethods[0].id, amount: round2(total), installmentNumber: 1 }]);
    setSplitPayment(false);
    setAmountReceived("");
  }, [status, paymentMethods, total, setPayments, setSplitPayment, setAmountReceived]);


  /** Abre o diálogo de desconto já preenchido com o valor atual do alvo. */
  const handleApplyDiscount = (type: "global" | "item", id?: string) => {
    setDiscountTarget({ type, id });
    setDiscountDialogOpen(true);
  };



  /**
   * Permite digitar o preço unitário direto na linha do carrinho. A diferença
   * para o preço de tabela vira desconto do item; valores acima são recusados.
   */
  const handleUpdateItemUnitPrice = (
    id: string,
    originalPrice: number,
    valueStr: string,
    inputEl?: HTMLInputElement,
  ) => {
    // Devolve ao campo o preço atual do item quando o valor digitado é recusado.
    const restore = () => {
      const item = items.find((i) => i.id === id);
      if (inputEl && item) inputEl.value = (item.price - item.discount).toFixed(2).replace(".", ",");
    };

    const val = parseAmount(valueStr);
    if (isNaN(val) || val < 0) {
      toast({
        title: "Valor Inválido",
        description: "Por favor, digite um preço unitário válido.",
        variant: "destructive",
      });
      restore();
      return;
    }

    if (val > originalPrice) {
      toast({
        title: "Valor Superior ao Original",
        description: `O valor do item não pode ser superior ao preço original de ${formatCurrency(originalPrice)}.`,
        variant: "destructive",
      });
      restore();
      return;
    }

    const discount = round2(originalPrice - val);
    applyItemDiscount(id, discount);
    toast({
      title: discount > 0 ? "Preço Atualizado" : "Preço Restaurado",
      description:
        discount > 0
          ? `Desconto de ${formatCurrency(discount)} aplicado no item.`
          : "O preço original do item foi restaurado.",
      duration: 2000,
    });
  };

  /** Dispara a busca ao enviar o formulário (Enter ou botão BUSCAR). */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  /**
   * Manda o cupom para a impressora sem derrubar o fluxo da venda: a venda já
   * está gravada, então falha de impressão vira aviso, não erro de venda.
   */
  const sendReceiptToPrinter = async (receipt: ReceiptData) => {
    try {
      await printReceipt(receipt);
    } catch {
      toast({
        title: "Não foi possível abrir a impressão",
        description: `A venda #${receipt.saleId} foi gravada. Reimprima o cupom pelo histórico.`,
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  /**
   * Grava a venda: valida o caixa e a distribuição do pagamento, monta as formas
   * com parcelamento e taxa, e grava. Numa reedição, regrava a mesma venda.
   *
   * Com conexão, a venda vai inteira para a API em uma requisição atômica. Sem
   * conexão, ela entra na fila local e o cupom sai com número provisório. Os dois
   * caminhos debitam o estoque local, então a próxima venda já vê o saldo certo.
   */
  const handleConfirmPayment = async () => {
    const { payments, receivedAmount, change } = checkout;
    if (mode.saleRequiresSession && !sessionId) {
      toast({ title: "Caixa fechado", description: "Abra o caixa para registrar vendas.", variant: "destructive" });
      return;
    }
    if (editingSaleId && !online) {
      toast({ title: "Sem conexão para editar", variant: "destructive" });
      return;
    }
    if (!online && !hasLocalDatabase) {
      toast({ title: "Base local indisponível", variant: "destructive" });
      return;
    }

    const payload = {
      cashRegisterSessionId: sessionId,
      customerId: consumer.customerId,
      customerDocument: consumer.document,
      discount: globalDiscount,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: round2(item.price - item.discount),
        // O nome vai junto para a fila offline: o cupom e a lista de pendências
        // precisam dele, e a base local pode ter mudado quando a venda subir.
        productName: item.name,
      })),
      payments: payments.map((payment: CheckoutPayment) => {
        const method = paymentMethods.find((pm) => pm.id === payment.paymentMethodId);
        const installment = method?.installments.find(
          (i) => i.installmentNumber === payment.installmentNumber && i.isActive,
        );
        return {
          paymentMethodId: payment.paymentMethodId,
          paymentMethodInstallmentId: installment?.id ?? null,
          amount: round2(payment.amount),
          installments: payment.installmentNumber,
          transactionFee: round2((payment.amount * (installment?.feePercentage ?? 0)) / 100),
          paymentMethodName: method?.name ?? paymentMethodNameById[payment.paymentMethodId],
        };
      }),
    };

    setSavingSale(true);
    try {
      // Os dois caminhos são normalizados no mesmo formato para que o cupom e o
      // aviso não precisem se ramificar: a reedição devolve o `SaleDto` da API, o
      // registro devolve o resultado do PDV (que pode ter ficado na fila).
      const saved = editingSaleId
        ? await updateSale(editingSaleId, payload).then((sale) => ({
            receiptNumber: sale.id as number | string,
            createdAt: sale.createdAt,
            total: sale.total,
            notes: sale.notes,
            customerDocument: sale.customerDocument,
            offline: false,
          }))
        : await registerSale(payload, {
            offline: !online,
            // A chave é do CHECKOUT, não da tentativa: gerada no primeiro
            // clique e reutilizada nas retentativas, para que um reenvio após
            // um 502/504 (com a venda já gravada no servidor) seja reconhecido
            // como duplicado em vez de virar uma segunda venda. `finishSale`
            // e o descarte da venda é que a liberam.
            clientReference: ensureSaleClientReference(newClientReference),
          }).then((sale) => ({
            receiptNumber: sale.receiptNumber,
            createdAt: sale.occurredAt,
            total: sale.total,
            notes: sale.notes,
            // O consumidor vem do carrinho no registro; a API não devolve nada
            // que o balcão já não tenha em mãos.
            customerDocument: null as string | null,
            offline: sale.offline,
          }));

      // Uma venda que ficou na fila não mudou nada no servidor; recarregar o
      // histórico ali só geraria requisição condenada a falhar.
      if (!saved.offline) {
        await refreshSales();
        await queryClient.invalidateQueries({ queryKey: ["pdv-products"] });
      }

      toast({
        title: saved.offline
          ? "Venda registrada offline"
          : editingSaleId
            ? "Venda atualizada!"
            : "Venda finalizada!",
        description: saved.offline
          ? `Cupom ${saved.receiptNumber} — ${formatCurrency(saved.total)}. Sobe para o servidor quando a conexão voltar.`
          : `Venda #${saved.receiptNumber} — ${formatCurrency(saved.total)}`,
        duration: saved.offline ? 6000 : 3000,
        className: saved.offline
          ? "bg-amber-500 text-amber-950 border-none"
          : "bg-emerald-500 text-white border-none",
      });

      // Montado a partir do carrinho, e não da resposta da API, porque só o
      // carrinho tem o nome dos produtos e o dinheiro recebido em mãos.
      const receipt: ReceiptData = {
        saleId: saved.receiptNumber,
        createdAt: saved.createdAt,
        operatorName,
        customerDocument: saved.customerDocument || consumer.document.trim() || null,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: round2(item.price - item.discount),
          barcode: item.barcode,
        })),
        payments: payments.map((payment) => ({
          name: paymentMethodNameById[payment.paymentMethodId] || "Não informado",
          amount: round2(payment.amount),
          installments: payment.installmentNumber,
        })),
        discount: globalDiscount,
        total: saved.total,
        amountReceived: receivedAmount,
        change: receivedAmount !== null ? change : null,
        notes: saved.notes,
        reprint: Boolean(editingSaleId),
        offline: saved.offline,
        // Identidade do cadastro da empresa; campo vazio cai no padrão embutido.
        store: resolveStoreInfo(companySettings),
      };

      finishSale();
      checkout.setPayments([]);
      checkout.setAmountReceived("");
      setSearchResults([]);
      setSearchQuery("");

      // Sem await: a caixa de impressão é modal e não pode segurar o botão de
      // finalizar, que já pode liberar para a próxima venda. O cursor volta para
      // a busca quando a impressão sai do caminho.
      if (autoPrintReceipt) void sendReceiptToPrinter(receipt).then(focusSearch);
      else focusSearch();
    } catch (error) {
      // A venda offline foi recusada pela conferência da base local. A mesma regra
      // vale no servidor, então deixar passar só adiaria o "não" para a
      // sincronização — com o cliente já fora da loja.
      if (error instanceof LocalStockError) {
        toast({
          title: "Estoque insuficiente na base local",
          description: error.shortages
            .map((item) => `${item.productName}: pedido ${item.requested}, disponível ${item.available}`)
            .join(" · "),
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      toast({
        title: "Não foi possível registrar a venda",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setSavingSale(false);
    }
  };

  /** Abre o caixa com o fundo de troco informado, liberando o PDV para vender. */
  const handleAbrirCaixa = async () => {
    const value = aberturaValor.trim() === "" ? 0 : parseAmount(aberturaValor);
    if (isNaN(value) || value < 0) {
      toast({
        title: "Valor inválido",
        description: "Informe o fundo de troco colocado na gaveta.",
        variant: "destructive",
      });
      return;
    }

    setAbrindoCaixa(true);
    try {
      await openCashRegister(value, aberturaObs);
      setAberturaValor("");
      setAberturaObs("");
      toast({
        title: "Caixa aberto!",
        description: `Fundo de troco: ${formatCurrency(value)}`,
        className: "bg-emerald-500 text-white border-none",
      });
    } catch (error) {
      toast({
        title: "Não foi possível abrir o caixa",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAbrindoCaixa(false);
    }
  };

  /**
   * Fecha o caixa com o dinheiro contado na gaveta e encerra a sessão do operador.
   * A diferença apurada vem calculada do backend.
   *
   * Movimento pendente bloqueia o fechamento — venda **ou** baixa de estoque. O
   * esperado em gaveta é calculado pelo servidor a partir do que ele conhece:
   * fechar com venda na fila produziria uma conferência que não fecha e, pior, o
   * backend recusaria depois a venda numa sessão já encerrada. A baixa entra na
   * mesma regra por outro motivo: ela é carimbada com a sessão aberta na hora em
   * que sobe, e subir depois do fechamento a jogaria no turno seguinte.
   *
   * A tentativa dispara uma sincronização — se ela resolver, o operador segue
   * direto.
   */

  /**
   * Encerra a sessão do operador de verdade: token, cadastros locais e stores.
   *
   * Antes, "sair" só zerava o carrinho e o cache de consultas — o JWT continuava
   * no localStorage (navegar de volta para "/" reautenticava o operador
   * anterior) e a base local seguia legível com nome/CPF/telefone de clientes.
   *
   * As filas offline **nunca** são apagadas aqui: quem chama garante que não há
   * pendência (a saída é bloqueada enquanto houver), e `clearLocalCatalog` só
   * toca o cadastro.
   */
  const performLogout = async () => {
    // O token sai primeiro: mesmo que a limpeza da base local falhe, a sessão
    // não pode continuar reutilizável.
    clearAuthSession();
    clearSession();
    useOfflineStore.getState().reset();

    try {
      await clearLocalCatalog();
    } catch {
      // Navegador sem IndexedDB ou base bloqueada por outra aba: não há
      // cadastro a limpar (ou não dá para limpar agora) — a saída segue.
    }

    closeLocalDatabase();
    queryClient.clear();
    setLocation("/login");
  };

  /** Sai do PDV. Bloqueia a saída com caixa aberto ou com movimento pendente. */
  const handleExitClick = () => {
    if (sessionId) {
      toast({
        title: "Fechamento necessário",
        description: "Não é possível sair com o caixa aberto. Efetue o fechamento primeiro.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    // Sair com fila pendente deixaria venda/baixa presa neste navegador — e o
    // logout limpa o cadastro local, então o operador seguinte nem saberia da
    // pendência. Sincronizar primeiro é obrigatório.
    if (queuedCount > 0) {
      toast({
        title: "Há movimentos não sincronizados",
        description: online
          ? `${queuedCount} venda(s)/baixa(s) ainda não subiram para o servidor. Resolva a fila em "Operação offline" antes de sair.`
          : `${queuedCount} movimento(s) offline aguardando conexão. Saia somente depois que eles subirem.`,
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    void performLogout();
  };

  /** Cancela uma venda da sessão, devolvendo ao estoque os itens já baixados. */
  const handleCancelSale = async (sale: SaleDto) => {
    setBusySaleId(sale.id);
    try {
      await cancelSaleRequest(sale.id, "Cancelada no PDV");

      // O servidor devolveu o estoque dele; a projeção local precisa acompanhar,
      // senão a base local fica subestimada até o próximo snapshot e o PDV
      // recusa venda offline de produto que está na prateleira.
      try {
        await restoreCancelledSaleStock(sale.id);
        await queryClient.invalidateQueries({ queryKey: ["pdv-products"] });
      } catch {
        // A venda foi cancelada; se a devolução local falhar (base indisponível),
        // a projeção se corrige no próximo snapshot.
      }

      await refreshSales();
      toast({ title: "Venda cancelada", description: `A venda #${sale.id} foi cancelada e o estoque devolvido.` });
    } catch (error) {
      toast({
        title: "Não foi possível cancelar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusySaleId(null);
    }
  };

  /** Guarda a venda em andamento na fila de espera e libera o caixa. */
  const handleHoldSale = () => {
    const held = holdSale();
    if (!held) return;

    checkout.setPayments([]);
    checkout.setAmountReceived("");
    setSearchResults([]);
    setSearchQuery("");

    toast({
      title: "Venda pausada",
      description: `${formatCurrency(held.total)} guardados em espera. Retome pelo botão no topo da tela.`,
      duration: 3000,
    });
  };

  /** Volta uma venda em espera para o carrinho e devolve o foco à busca. */
  const handleResumedHeldSale = (held: HeldSale) => {
    checkout.setPayments([]);
    checkout.setAmountReceived("");
    setSearchResults([]);
    setSearchQuery("");

    toast({
      title: "Venda retomada",
      description: `${held.items.length} ${held.items.length === 1 ? "item" : "itens"} de volta no carrinho.`,
      duration: 3000,
    });
  };

  /**
   * Imprime o relatório de vendas da sessão aberta, com o consolidado do caixa
   * e a relação das vendas registradas até o momento.
   */
  const handlePrintSalesReport = async () => {
    if (!session) {
      toast({
        title: "Caixa fechado",
        description: "Abra o caixa para emitir o relatório de vendas.",
        variant: "destructive",
      });
      return;
    }

    setPrintingReport(true);
    try {
      await printSalesReport({
        sessionId: session.id,
        operatorName: session.userName || operatorName,
        openedAt: session.openedAt,
        closedAt: session.closedAt ?? null,
        printedAt: new Date(),
        openingBalance: session.openingBalance,
        summary: {
          salesCount: summary?.salesCount ?? 0,
          cancelledSalesCount: summary?.cancelledSalesCount ?? 0,
          revenue: summary?.revenue ?? 0,
          discounts: summary?.discounts ?? 0,
          itemsCount: summary?.itemsCount ?? 0,
          cashAmount: summary?.cashAmount ?? 0,
          nonCashAmount: summary?.nonCashAmount ?? 0,
          expectedCashAmount: summary?.expectedCashAmount ?? session.openingBalance,
          byPaymentMethod: (summary?.byPaymentMethod ?? []).map((method) => ({
            paymentMethodName: method.paymentMethodName,
            count: method.count,
            amount: method.amount,
          })),
        },
        sales: sales.map((sale) => ({
          id: sale.id,
          createdAt: sale.createdAt,
          total: sale.total,
          cancelled: enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled,
          paymentNames: (sale.payments ?? [])
            .map((payment) => payment.paymentMethodName || paymentMethodNameById[payment.paymentMethodId])
            .filter((name): name is string => Boolean(name)),
        })),
        // Identidade do cadastro da empresa; campo vazio cai no padrão embutido.
        store: resolveStoreInfo(companySettings),
      });
    } catch (error) {
      toast({
        title: "Não foi possível imprimir o relatório",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPrintingReport(false);
    }
  };

  /** Reimprime o cupom de uma venda da sessão, marcado como segunda via. */
  const handlePrintSaleReceipt = async (sale: SaleDto) => {
    setBusySaleId(sale.id);
    try {
      const saleItems = await getSaleItems(sale.id);
      await sendReceiptToPrinter(
        // Sem `operatorName`: a segunda via tem que nomear quem vendeu, e não
        // quem está no caixa agora. O nome sai da própria venda, que é o mesmo
        // caminho da reimpressão pelo painel administrativo — os dois cupons
        // precisam sair idênticos.
        buildReceiptFromSale(sale, saleItems, {
          paymentMethodNameById,
          reprint: true,
          cancelled: enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled,
          // Identidade do cadastro da empresa; campo vazio cai no padrão embutido.
          store: resolveStoreInfo(companySettings),
        }),
      );
    } catch (error) {
      toast({
        title: "Não foi possível montar o cupom",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusySaleId(null);
    }
  };

  /**
   * Carrega uma venda finalizada de volta no carrinho para reedição, reconstruindo
   * o desconto de cada item a partir do preço de tabela atual do produto.
   */
  const loadSaleToCart = async (sale: SaleDto) => {
    setBusySaleId(sale.id);
    try {
      const saleItems = await getSaleItems(sale.id);
      const productIds = [...new Set(saleItems.map((item) => item.productId))];
      const products = await Promise.all(
        productIds.map((id) => apiGet<ProductDto>(`/Products/${id}`).catch(() => null)),
      );
      const productById = new Map(products.filter(Boolean).map((p) => [p!.id, p!]));

      const cartItems: PdvItem[] = saleItems.map((item) => {
        const product = productById.get(item.productId);
        const originalPriceFromSale = item.unitPrice + (item.discount ?? 0);
        const price = product?.price ?? originalPriceFromSale;
        return {
          id: `${item.id}`,
          productId: item.productId,
          name: item.productName || product?.name || `Produto #${item.productId}`,
          barcode: product?.barcode || item.barcode || undefined,
          price,
          quantity: item.quantity,
          discount: Math.max(0, round2(price - item.unitPrice)),
          // O estoque atual já não contém as unidades desta venda.
          availableStock: (product?.stock ?? 0) + item.quantity,
        };
      });

      loadSaleForEditing(sale.id, cartItems, sale.discount);
      setIsSalesHistoryOpen(false);
      toast({
        title: "Venda carregada",
        description: `Editando a venda #${sale.id}. Faça as alterações e finalize.`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Não foi possível carregar a venda",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusySaleId(null);
    }
  };

  /** Inicia a edição de uma venda, pedindo confirmação se já houver carrinho em andamento. */
  const handleEditSale = (sale: SaleDto) => {
    if (items.length > 0) {
      setPendingSaleToEdit(sale);
      setIsConfirmDiscardOpen(true);
    } else {
      loadSaleToCart(sale);
    }
  };

  /** Descarta o carrinho atual e carrega a venda escolhida para edição. */
  const confirmDiscardAndEdit = () => {
    if (pendingSaleToEdit) {
      loadSaleToCart(pendingSaleToEdit);
      setPendingSaleToEdit(null);
    }
    setIsConfirmDiscardOpen(false);
  };

  if (isLoading || loadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden selection:bg-primary/30">
      {/* HEADER */}
      <header className="relative h-20 border-b border-border/50 bg-card/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <img loading="lazy" decoding="async" src="/images/logo-icon.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-display font-bold leading-none text-xl tracking-tight">Uaus! Máximo 30</h1>
            {session && (
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                Caixa #{session.id} aberto às{" "}
                {new Date(session.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {/* A sessão veio da base local: o resumo do caixa é o do último
                    contato com o servidor e pode estar defasado. */}
                {isSessionFromCache && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">· sessão da base local</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
          {heldSales.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHeldSalesOpen(true)}
              title="Ver vendas em espera"
              className="relative flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <PauseCircle className="w-4 h-4" />
              Vendas em espera
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[10px] font-bold text-white">
                {heldSales.length}
              </span>
            </button>
          )}

          <OfflineStatus sessionId={sessionId} onSynced={refreshSales} />

          <Clock />
        </div>

        <div className="flex items-center gap-4">
          <FontSizeControl />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCalculator}
            title="Calculadora"
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
          >
            <CalculatorIcon className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2 text-primary">
            <span className="text-sm font-bold tracking-tight">{operatorName}</span>
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
                    {/* Sem controle de caixa não há turno para encerrar; o item
                        some em vez de ficar desabilitado para sempre. */}
                    {mode.requiresOpenSession && (
                      <button
                        onClick={() => {
                          setIsSandwichMenuOpen(false);
                          void(0);
                        }}
                        disabled={!sessionId}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4 text-primary" />
                        Fechar Caixa
                      </button>
                    )}
                    {/* A baixa de estoque entra aqui, e não no checkout: a tela
                        de finalização não pode ganhar mais nada, e baixa não tem
                        relação com pagamento. Também não exige caixa aberto —
                        quem resolve a sessão dela é o servidor. */}
                    <button
                      onClick={() => {
                        setIsSandwichMenuOpen(false);
                        setIsStockWriteOffOpen(true);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <PackageMinus className="w-4 h-4 text-primary" />
                      Baixa de Estoque
                    </button>
                    <button
                      onClick={() => {
                        setIsSandwichMenuOpen(false);
                        setIsSalesHistoryOpen(true);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <History className="w-4 h-4 text-primary" />
                      Histórico de Vendas
                    </button>
                    <button
                      onClick={() => {
                        setIsSandwichMenuOpen(false);
                        setIsHeldSalesOpen(true);
                      }}
                      className="flex items-center justify-between gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-3">
                        <PauseCircle className="w-4 h-4 text-primary" />
                        Vendas em Espera
                      </span>
                      {heldSales.length > 0 && (
                        <span className="rounded-full bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-white">
                          {heldSales.length}
                        </span>
                      )}
                    </button>
                    {/* O relatório é o consolidado de um turno; sem controle de
                        caixa não existe turno para consolidar. */}
                    {mode.requiresOpenSession && (
                      <button
                        onClick={() => {
                          setIsSandwichMenuOpen(false);
                          handlePrintSalesReport();
                        }}
                        disabled={!sessionId || printingReport}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FileBarChart className="w-4 h-4 text-primary" />
                        Relatório de Vendas
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsSandwichMenuOpen(false);
                        toggleCalculator();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <CalculatorIcon className="w-4 h-4 text-primary" />
                      Calculadora
                    </button>
                    <button
                      onClick={() => {
                        setIsSandwichMenuOpen(false);
                        setIsPreferencesOpen(true);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      Preferências
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button
                      onClick={() => {
                        setIsSandwichMenuOpen(false);
                        handleExitClick();
                      }}
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
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary text-primary-foreground font-bold hover:scale-105 active:scale-95 transition-transform"
                  disabled={isSearching}
                >
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
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Resultados da Busca
                  </h3>
                  <ScrollArea className="flex-1">
                    <div className="grid grid-cols-1 gap-2">
                      {searchResults.map((product) => {
                        const outOfStock = product.stock <= 0;
                        return (
                          <motion.div
                            key={product.id}
                            whileHover={outOfStock ? undefined : { scale: 1.01 }}
                            className={`flex items-center justify-between p-4 rounded-xl border bg-card group transition-all ${
                              outOfStock
                                ? "border-border/30 opacity-50 cursor-not-allowed"
                                : "border-border/50 cursor-pointer hover:border-primary/40"
                            }`}
                            onClick={() => {
                              if (outOfStock) return;
                              addProductToCart(product);
                              setSearchResults([]);
                              setSearchQuery("");
                            }}
                          >
                            <div>
                              <h4 className="font-bold text-lg">{product.name}</h4>
                              <p className="text-xs text-muted-foreground font-mono">
                                {product.barcode} · Estoque: {product.stock}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-mono font-bold text-primary">
                                {formatCurrency(product.price)}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold group-hover:text-primary transition-colors">
                                {outOfStock ? "Sem estoque" : "Clique para adicionar"}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
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
                  <h2 className="text-4xl font-display font-bold text-foreground/20 uppercase tracking-widest">
                    Aguardando Busca
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT COLUMN: Cart */}
        <div className="w-[500px] flex flex-col bg-card shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-20 relative">
          <div className="p-6 border-b border-border/50 bg-muted/10 flex items-center justify-between">
            <h2 className="text-xl font-display font-bold flex items-center gap-2 uppercase">
              <ShoppingCart className="w-5 h-5 text-primary" /> Resumo da Venda
            </h2>
            {editingSaleId && (
              <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-bold uppercase">
                Editando #{editingSaleId}
              </span>
            )}
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-2">
              <AnimatePresence>
                {items.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground uppercase">Carrinho vazio</div>
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
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            >
                              <Minus className="w-2 h-2" />
                            </Button>
                            <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                if (item.quantity + 1 > item.availableStock) {
                                  toast({
                                    title: "Estoque insuficiente",
                                    description: `Só há ${item.availableStock} unidade(s) de ${item.name}.`,
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                updateQuantity(item.id, item.quantity + 1);
                              }}
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
                                  handleUpdateItemUnitPrice(
                                    item.id,
                                    item.price,
                                    (e.target as HTMLInputElement).value,
                                    e.target as HTMLInputElement,
                                  );
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
                <span className="uppercase">Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>

              {globalDiscount > 0 && (
                <div className="flex justify-between items-center text-emerald-500 font-bold text-sm">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Desconto Total
                  </span>
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
                onClick={() => handleApplyDiscount("global")}
                disabled={items.length === 0}
              >
                DESCONTO
              </Button>
              <Button
                className="h-14 font-bold text-sm tracking-widest bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20"
                disabled={items.length === 0 || (mode.saleRequiresSession && !sessionId)}
                onClick={setCheckout}
              >
                FINALIZAR
              </Button>
            </div>

            {items.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] font-bold tracking-wider text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 cursor-pointer disabled:opacity-40"
                  onClick={handleHoldSale}
                  disabled={editingSaleId !== null}
                  title={
                    editingSaleId
                      ? "Conclua ou descarte a edição antes de pausar"
                      : "Guardar esta venda e liberar o caixa"
                  }
                >
                  <PauseCircle className="w-3.5 h-3.5" /> PAUSAR
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] font-bold tracking-wider text-muted-foreground hover:text-destructive cursor-pointer"
                  onClick={cancelSale}
                >
                  {editingSaleId ? "DESCARTAR EDIÇÃO" : "CANCELAR VENDA"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ABRIR CAIXA — bloqueia o PDV enquanto não houver sessão.
          Numa loja sem controle de caixa o diálogo não aparece: não há turno a
          abrir. Ver o bloqueio em `lib/cash-register-mode.ts`. */}
      <Dialog
        open={mode.requiresOpenSession && !sessionId && !loadingSession}
        onOpenChange={() => undefined}
      >
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-card border-border shadow-2xl [&>button]:hidden">
          <div className="bg-primary/10 p-6 border-b border-border/50">
            <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
              <Unlock className="w-5 h-5 text-primary" /> Abertura de Caixa
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informe o fundo de troco para começar a vender.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="aberturaValor" className="text-sm font-semibold flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" /> Fundo de Troco
              </Label>
              <Input
                id="aberturaValor"
                type="text"
                placeholder="R$ 0,00"
                className="h-12 text-lg font-mono"
                value={aberturaValor}
                onChange={(e) => setAberturaValor(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Dinheiro em espécie deixado na gaveta no início do turno.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aberturaObs" className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Observações
              </Label>
              <textarea
                id="aberturaObs"
                placeholder="Opcional..."
                className="w-full min-h-[70px] p-3 rounded-lg border border-input bg-background/50 focus-visible:ring-primary/50 text-sm outline-none focus:border-primary transition-colors resize-none"
                value={aberturaObs}
                onChange={(e) => setAberturaObs(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 cursor-pointer"
                onClick={() => {
                  queryClient.clear();
                  setLocation("/login");
                }}
              >
                Sair
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-orange-600 font-bold text-white border-none cursor-pointer"
                onClick={handleAbrirCaixa}
                disabled={abrindoCaixa}
              >
                {abrindoCaixa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Abrir Caixa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CHECKOUT MODAL */}
      <CheckoutDialog
        open={status === "CHECKOUT"}
        onOpenChange={(open) => !open && backToSelling()}
        consumer={consumer}
        setConsumer={setConsumer}
        total={subtotal}
        checkout={checkout}
        savingSale={savingSale}
        onConfirmPayment={handleConfirmPayment}
      />

      <DiscountDialog
        open={discountDialogOpen}
        onOpenChange={setDiscountDialogOpen}
        target={discountTarget}
        globalDiscount={globalDiscount}
        items={items}
        subtotal={subtotal}
        applyGlobalDiscount={applyGlobalDiscount}
        applyItemDiscount={applyItemDiscount}
      />

      {/* HISTÓRICO DE VENDAS DIALOG */}
      <SalesHistoryDialog
        open={isSalesHistoryOpen}
        onOpenChange={setIsSalesHistoryOpen}
        queuedSalesCount={queuedSalesCount}
        loadingSales={loadingSales}
        sales={sales}
        busySaleId={busySaleId}
        sessionId={sessionId}
        printingReport={printingReport}
        onPrintSaleReceipt={handlePrintSaleReceipt}
        onEditSale={handleEditSale}
        onCancelSale={handleCancelSale}
        onPrintSalesReport={handlePrintSalesReport}
      />

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
                  className={`flex-1 gap-2 h-14 font-semibold cursor-pointer ${
                    theme === "light" ? "bg-primary text-primary-foreground border-none" : "border-border/50 text-foreground"
                  }`}
                  onClick={() => setTheme("light")}
                >
                  <Sun className="w-4 h-4" /> Claro
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  className={`flex-1 gap-2 h-14 font-semibold cursor-pointer ${
                    theme === "dark" ? "bg-primary text-primary-foreground border-none" : "border-border/50 text-foreground"
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="w-4 h-4" /> Escuro
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Cupom da Venda
              </Label>
              <button
                type="button"
                onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-muted/40 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Imprimir ao finalizar a venda</span>
                </span>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    autoPrintReceipt ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      autoPrintReceipt ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
              <p className="text-xs text-muted-foreground">
                Desligado, o cupom continua disponível pelo histórico de vendas.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setIsPreferencesOpen(false)} className="w-full cursor-pointer">
                Salvar e Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE DESCARTE PARA EDIÇÃO */}
      <Dialog open={isConfirmDiscardOpen} onOpenChange={setIsConfirmDiscardOpen}>
        <DialogContent className="sm:max-w-[400px] p-6 bg-card border-border shadow-2xl">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
            Confirmar Descarte
          </DialogTitle>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Há itens ativos no carrinho de compras atual. Deseja descartar esta venda em andamento para editar a venda
              selecionada?
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1 cursor-pointer" onClick={() => setIsConfirmDiscardOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer border-none"
                onClick={confirmDiscardAndEdit}
              >
                Descartar e Editar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BAIXA DE ESTOQUE — aberta pelo menu, nunca pelo checkout */}
      <StockWriteOffDialog
        open={isStockWriteOffOpen}
        onOpenChange={setIsStockWriteOffOpen}
        onRegistered={async () => {
          await queryClient.invalidateQueries({ queryKey: ["pdv-products"] });
        }}
      />

      <OpenCashRegisterDialog
        requiresOpenSession={mode.requiresOpenSession}
        sessionId={sessionId}
        loadingSession={loadingSession}
        onOpenRegister={openCashRegister}
        onLogout={() => {
          queryClient.clear();
          setLocation("/login");
        }}
      />

      <CloseCashRegisterDialog
        open={isFecharCaixaOpen}
        onOpenChange={setIsFecharCaixaOpen}
        summary={summary}
        session={session}
        onCloseRegister={closeCashRegister}
      />

      {/* VENDAS EM ESPERA */}
      <HeldSalesDialog
        open={isHeldSalesOpen}
        onOpenChange={setIsHeldSalesOpen}
        onResumed={handleResumedHeldSale}
        onHeldToMakeRoom={() => {
          checkout.setPayments([]);
          checkout.setAmountReceived("");
        }}
      />

      <Calculator />
    </div>
  );
}


































