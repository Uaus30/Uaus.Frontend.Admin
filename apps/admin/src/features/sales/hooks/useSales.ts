import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetSales, getGetSalesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getEnumOptions } from "@/services/core";
import { buildEnrichedSales, buildProductCollections } from "@/services/mappers";
import {
  getAllProducts,
  getAllProductGroups,
  getAllProductTags,
  getAllProductImages,
} from "@/services/products.service";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllTags } from "@/services/tags.service";
import { getAllImages } from "@/services/images.service";
import { getAllCustomers } from "@/services/customers.service";
import { getAllSaleItems, createSaleWithItems, deleteSaleWithItems } from "@/services/sales.service";
import type { NewSaleDraftItem, EnrichedSale } from "../types";

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

  // Query: Busca vendas paginadas
  const { data: salesPage, isLoading } = useGetSales({ page, limit: 15 });

  // Query: Carrega todos os clientes
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all-for-sales"],
    queryFn: () => getAllCustomers(),
  });

  // Query: Carrega enums de métodos de pagamento
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-method-options"],
    queryFn: () => getEnumOptions("/Sales/enums/payment-method"),
  });

  // Query: Carrega enums de status de pagamento
  const { data: paymentStatuses = [] } = useQuery({
    queryKey: ["payment-status-options"],
    queryFn: () => getEnumOptions("/Sales/enums/payment-status"),
  });

  // Query: Carrega catálogo de produtos enriquecidos para o checkout
  const { data: enrichedProducts = [] } = useQuery({
    queryKey: ["products-enriched-for-sales"],
    queryFn: async () => {
      const [
        products,
        productGroups,
        categories,
        departments,
        tags,
        productTags,
        images,
        productImages,
      ] = await Promise.all([
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
  });

  // Query: Busca todos os itens de vendas no histórico
  const { data: saleItems = [] } = useQuery({
    queryKey: ["sale-items-all-for-sales"],
    queryFn: () => getAllSaleItems(),
  });

  // Mapeador de métodos de pagamento por ID
  const paymentMethodById = useMemo(
    () => Object.fromEntries(paymentMethods.map((item) => [item.id, item.name])),
    [paymentMethods]
  );

  // Lista de vendas enriquecida com relacionamentos
  const saleDetails = useMemo<EnrichedSale[]>(() => {
    if (!salesPage) return [];
    return buildEnrichedSales({
      sales: salesPage.data,
      saleItems,
      customers,
      enrichedProducts,
    }) as EnrichedSale[];
  }, [customers, enrichedProducts, saleItems, salesPage]);

  // Estados do formulário de Checkout
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [items, setItems] = useState<NewSaleDraftItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [savingSale, setSavingSale] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);

  // Produtos disponíveis com estoque positivo
  const availableProducts = useMemo(
    () => enrichedProducts.filter((product) => product.stock > 0 && product.status !== 4),
    [enrichedProducts]
  );

  function resetSaleForm() {
    setCustomerId(null);
    setItems([]);
    setDiscount(0);
    setPaymentMethod(paymentMethods.find((item) => item.allowSelect)?.id.toString() ?? "");
    setPaymentStatus(paymentStatuses.find((item) => item.allowSelect)?.id.toString() ?? "");
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

    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + selectedQty } : item
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

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [items]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

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

    if (!paymentMethod || !paymentStatus) {
      toast({
        title: "Selecione o método e o status do pagamento.",
        variant: "destructive",
      });
      return;
    }

    setSavingSale(true);
    try {
      await createSaleWithItems({
        customerId,
        discount,
        paymentMethod: Number(paymentMethod),
        paymentStatus: Number(paymentStatus),
        notes,
        items,
      });

      await queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: ["sale-items-all-for-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["customers-all-for-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["products-enriched-for-sales"] });

      toast({ title: "Venda registrada com sucesso." });
      setCreateModalOpen(false);
      resetSaleForm();
    } catch (error) {
      toast({
        title: "Erro ao registrar venda",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingSale(false);
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
      await queryClient.invalidateQueries({ queryKey: ["sale-items-all-for-sales"] });
      toast({ title: "Venda removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover venda",
        description: error instanceof Error ? error.message : "Tente novamente.",
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
    paymentMethods,
    paymentStatuses,
    paymentMethodById,
    saleDetails,
    customerId,
    setCustomerId,
    items,
    setItems,
    discount,
    setDiscount,
    paymentMethod,
    setPaymentMethod,
    paymentStatus,
    setPaymentStatus,
    notes,
    setNotes,
    selectedProductId,
    setSelectedProductId,
    selectedQty,
    setSelectedQty,
    savingSale,
    deletingSaleId,
    availableProducts,
    subtotal,
    total,
    saleToView,
    resetSaleForm,
    addItem,
    removeItem,
    handleCreateSubmit,
    handleDeleteSale,
  };
}
