import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@workspace/ui";
import {
  useGetSales,
  useGetPaymentMethods,
  useGetCompanySettings,
  getGetSalesQueryKey,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  enumCode,
} from "@workspace/api-client-react";
import { buildReceiptFromSale, printReceipt, resolveStoreInfo } from "@workspace/receipt";
import { useToast } from "@workspace/ui";
import { describeApiError, computeSaleTotals, formatCurrency, round2 } from "@workspace/core";
import { getEnumOptions } from "@/services/core";
import { buildProductCollections } from "@/services/mappers";
import {
  getAllProducts,
  getAllProductGroups,
  getAllProductTags,
  getAllProductImages,
} from "@/services/products.service";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllTags } from "@/services/tags.service";
import { getAllImages } from "@/services/images.service";

import { createSaleWithItems, deleteSaleWithItems, getSaleItems } from "@/services/sales.service";
import type { NewSaleDraftItem, EnrichedSale, NewSaleDraftPayment } from "../types";
import { CATALOG_KEYS, useAllCustomers } from "@/hooks/use-catalog";

/**
 * useSales
 *
 * Hook customizado para gerenciar a listagem, detalhamento de vendas,
 * e a lógica do carrinho/checkout (registro de novas vendas).
 */
export function useSales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Query: Busca vendas paginadas com filtros
  // O backend compara `CreatedAt <= endDate` com hora; enviar só "yyyy-MM-dd"
  // (meia-noite) excluiria o último dia inteiro do período. O fim do dia vai no
  // fuso LOCAL, sem toISOString (ver docs/fuso-horario.md do backend).
  const { data: salesPage, isLoading } = useGetSales({
    search: debouncedSearch.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
    paymentMethodId: paymentMethodFilter !== "all" ? Number(paymentMethodFilter) : undefined,
    paymentStatus: paymentStatusFilter !== "all" ? Number(paymentStatusFilter) : undefined,
    page,
    limit: 15,
  });

  // Query: Carrega formas de pagamento cadastradas
  const { data: dbPaymentMethodsData } = useGetPaymentMethods({ page: 1, size: 100 });
  const dbPaymentMethods = dbPaymentMethodsData?.data ?? [];

  // Query: Identidade da loja para o cabeçalho do cupom reimpresso. Compartilha
  // a COMPANY_SETTINGS_QUERY_KEY com a tela de configurações — salvar lá já
  // invalida aqui. Enquanto (ou se) a leitura não chega, `resolveStoreInfo`
  // imprime os padrões embutidos.
  const { data: companySettings } = useGetCompanySettings();

  // Query: Carrega todos os clientes para o select do checkout
  const { data: customers = [] } = useAllCustomers();

  // Query: Carrega enums de status de pagamento
  const { data: paymentStatuses = [] } = useQuery({
    queryKey: ["payment-status-options"],
    queryFn: () => getEnumOptions("/Sales/enums/payment-status"),
  });

  // Query: Carrega catálogo de produtos enriquecidos para o checkout
  const { data: enrichedProducts = [] } = useQuery({
    queryKey: ["products-enriched-for-sales"],
    queryFn: async () => {
      const [products, productGroups, categories, departments, tags, productTags, images, productImages] =
        await Promise.all([
          getAllProducts(),
          getAllProductGroups(),
          getAllCategories(),
          getAllDepartments(),
          getAllTags(),
          getAllProductTags(),
          getAllImages(),
          getAllProductImages(),
        ]);

      return buildProductCollections({
        products,
        productGroups,
        categories,
        departments,
        tags,
        productTags,
        images,
        productImages,
      }).enrichedProducts;
    },
    enabled: createModalOpen,
  });

  // Mapeador de métodos de pagamento por ID
  const paymentMethodById = useMemo(
    () => Object.fromEntries(dbPaymentMethods.map((item) => [item.id, item.name])),
    [dbPaymentMethods],
  );

  // Lista de vendas enriquecida com cliente
  const saleDetails = useMemo<EnrichedSale[]>(() => {
    if (!salesPage) return [];
    const customersById = new Map(customers.map((item) => [item.id, item]));
    return salesPage.data.map((sale) => ({
      ...sale,
      customer: sale.customerId ? (customersById.get(sale.customerId) ?? null) : null,
      items: [],
    })) as EnrichedSale[];
  }, [customers, salesPage]);

  // Estados do formulário de Checkout
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [items, setItems] = useState<NewSaleDraftItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState<NewSaleDraftPayment[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [savingSale, setSavingSale] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);
  const [printingSaleId, setPrintingSaleId] = useState<number | null>(null);

  // Produtos disponíveis com estoque positivo
  const availableProducts = useMemo(
    () =>
      enrichedProducts.filter(
        (product) =>
          product.stock > 0 && enumCode(product.status, PRODUCT_STATUS) !== PRODUCT_STATUS.Inactive,
      ),
    [enrichedProducts],
  );

  function resetSaleForm() {
    setCustomerId(null);
    setItems([]);
    setDiscount(0);
    setPayments(dbPaymentMethods.length > 0 ? [{ paymentMethodId: dbPaymentMethods[0].id, amount: 0 }] : []);
    setNotes("");
    setSelectedProductId("");
    setSelectedQty(1);
  }

  /**
   * Adiciona o produto selecionado ao carrinho local (checkout).
   */
  function addItem() {
    if (!selectedProductId || selectedQty <= 0) return;

    const product = availableProducts.find((item) => item.id === Number(selectedProductId));
    if (!product) return;

    const existingItem = items.find((item) => item.productId === product.id);
    const nextQty = (existingItem?.quantity || 0) + selectedQty;

    if (nextQty > product.stock) {
      toast({
        title: "Estoque insuficiente",
        description: `Há apenas ${product.stock} unidades disponíveis no estoque.`,
        variant: "destructive",
      });
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + selectedQty } : item,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          quantity: selectedQty,
          unitPrice: product.price,
        },
      ];
    });

    setSelectedProductId("");
    setSelectedQty(1);
  }

  /**
   * Remove o item do carrinho local.
   */
  function removeItem(productId: number) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  // A conta é a mesma do PDV, vinda do @workspace/core: o admin usava toFixed,
  // que trunca onde o EPSILON arredonda — 2,675 virava 2,67 aqui e 2,68 no
  // caixa, para a mesma venda.
  const totals = useMemo(
    () =>
      computeSaleTotals({
        items: items.map((item) => ({
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          unitDiscount: 0,
        })),
        globalDiscount: discount,
      }),
    [items, discount],
  );

  const subtotal = totals.subtotal;
  const total = totals.total;

  const paidAmount = useMemo(
    () => round2(payments.reduce((sum, payment) => sum + payment.amount, 0)),
    [payments],
  );

  const remainingAmount = useMemo(() => round2(total - paidAmount), [total, paidAmount]);

  // Com uma única forma de pagamento o valor acompanha o total automaticamente.
  useEffect(() => {
    if (payments.length !== 1 || payments[0].amount === total) return;
    setPayments([{ ...payments[0], amount: total }]);
  }, [total, payments]);

  /**
   * Adiciona uma forma de pagamento ainda não usada, já com o valor que falta
   * distribuir. Não faz nada quando todas as formas cadastradas já estão na lista.
   */
  function addPayment() {
    const used = new Set(payments.map((payment) => payment.paymentMethodId));
    const next = dbPaymentMethods.find((method) => !used.has(method.id));
    if (!next) return;

    setPayments((current) => [
      ...current,
      { paymentMethodId: next.id, amount: Math.max(0, remainingAmount) },
    ]);
  }

  /** Remove a forma de pagamento da posição informada. */
  function removePayment(index: number) {
    setPayments((current) => current.filter((_, position) => position !== index));
  }

  /**
   * Altera a forma ou o valor de um pagamento. Com uma única forma na lista, o
   * valor é reescrito pelo total da venda logo em seguida.
   */
  function updatePayment(index: number, patch: Partial<NewSaleDraftPayment>) {
    setPayments((current) =>
      current.map((payment, position) => (position === index ? { ...payment, ...patch } : payment)),
    );
  }

  const saleToView = useMemo(() => {
    return saleDetails.find((sale) => sale.id === viewSaleId) ?? null;
  }, [saleDetails, viewSaleId]);

  /**
   * Submete a nova venda de checkout para a API.
   */
  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (items.length === 0) {
      toast({
        title: "Adicione pelo menos um item à venda.",
        variant: "destructive",
      });
      return;
    }

    if (payments.length === 0) {
      toast({
        title: "Atenção",
        description: "Adicione as formas de pagamento para finalizar a venda.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(remainingAmount) > 0.01) {
      toast({
        title: "Formas de pagamento não fecham com o total.",
        description:
          remainingAmount > 0
            ? `Faltam ${formatCurrency(remainingAmount)} a distribuir.`
            : `Há ${formatCurrency(Math.abs(remainingAmount))} a mais do que o total.`,
        variant: "destructive",
      });
      return;
    }

    setSavingSale(true);
    try {
      await createSaleWithItems({
        customerId,
        discount,
        payments,
        notes,
        items,
      });

      await queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.customers });
      await queryClient.invalidateQueries({ queryKey: ["products-enriched-for-sales"] });

      toast({ title: "Venda registrada com sucesso." });
      setCreateModalOpen(false);
      resetSaleForm();
    } catch (error) {
      toast({
        title: "Erro ao registrar venda",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setSavingSale(false);
    }
  }

  /**
   * Reimprime o cupom de uma venda já registrada.
   *
   * A listagem não traz os itens, então eles são buscados na hora. Todo cupom
   * saído do painel é segunda via — a primeira sai do PDV no ato da venda.
   */
  async function handlePrintReceipt(saleId: number) {
    const sale = saleDetails.find((item) => item.id === saleId);
    if (!sale) return;

    setPrintingSaleId(saleId);
    try {
      const saleItems = await getSaleItems(saleId);
      await printReceipt(
        buildReceiptFromSale(sale, saleItems, {
          // O consumidor não precisa de contexto: o cupom o identifica só pelo
          // documento, e a venda já vem com ele resolvido pelo backend (do
          // cadastro quando há cliente, senão o informado no balcão).
          paymentMethodNameById: paymentMethodById,
          reprint: true,
          cancelled: enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled,
          // Identidade do cadastro da empresa; campo vazio cai no padrão
          // embutido — o mesmo caminho do cupom original do PDV.
          store: resolveStoreInfo(companySettings),
        }),
      );
    } catch (error) {
      toast({
        title: "Erro ao gerar o cupom",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setPrintingSaleId(null);
    }
  }

  /**
   * Exclui uma venda e seus itens associados.
   */
  async function handleDeleteSale(saleId: number) {
    setDeletingSaleId(saleId);
    try {
      await deleteSaleWithItems(saleId);
      await queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
      toast({ title: "Venda removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover venda",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setDeletingSaleId(null);
    }
  }

  return {
    page,
    setPage,
    createModalOpen,
    setCreateModalOpen,
    viewSaleId,
    setViewSaleId,
    salesPage,
    isLoading,
    customers,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentMethodFilter,
    setPaymentMethodFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    paymentMethods: dbPaymentMethods,
    paymentStatuses,
    paymentMethodById,
    saleDetails,
    customerId,
    setCustomerId,
    items,
    setItems,
    discount,
    setDiscount,
    payments,
    setPayments,
    addPayment,
    removePayment,
    updatePayment,
    paidAmount,
    remainingAmount,
    notes,
    setNotes,
    selectedProductId,
    setSelectedProductId,
    selectedQty,
    setSelectedQty,
    savingSale,
    deletingSaleId,
    printingSaleId,
    availableProducts,
    subtotal,
    total,
    saleToView,
    resetSaleForm,
    addItem,
    removeItem,
    handleCreateSubmit,
    handleDeleteSale,
    handlePrintReceipt,
  };
}
