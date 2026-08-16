import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@workspace/ui";
import {
  useGetPurchaseEntries,
  useGetPurchaseEntryDetails,
  useReceivePurchaseEntry,
  useDeletePurchaseEntry,
} from "@workspace/api-client-react";

import { getAllProducts } from "@/services/products.service";
import type { NewEntryItem } from "../types";
import { CATALOG_KEYS, useAllSuppliers } from "@/hooks/use-catalog";
import { describeApiError } from "@workspace/core";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/**
 * useStockEntries
 *
 * Hook customizado para gerenciar a listagem, detalhamento, criação
 * e cancelamento de notas/entradas de mercadoria no estoque.
 */
export function useStockEntries() {
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [newEntryModalOpen, setNewEntryModalOpen] = useState(false);

  // Estados dos filtros
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("all");

  // Estados do formulário de Nova Entrada
  const [supplierId, setSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<NewEntryItem[]>([]);

  // Query: Busca lista de entradas paginadas
  const {
    data: entriesData,
    isLoading: isLoadingEntries,
    refetch: refetchEntries,
    isError,
    error,
  } = useGetPurchaseEntries({
    page,
    limit: 10,
    supplierId: selectedSupplierFilter !== "all" ? Number(selectedSupplierFilter) : undefined,
  });

  // O aviso de servidor fora do ar é o mesmo em toda tela — mora num hook só.
  useApiErrorToast(isError, error);

  // Query: Busca detalhes da entrada selecionada
  const { data: entryDetails, isLoading: isLoadingDetails } = useGetPurchaseEntryDetails(
    selectedEntryId ?? 0,
    {
      query: {
        enabled: !!selectedEntryId,
      },
    },
  );

  // Query: Carrega fornecedores ativos para listagem/formulário
  const { data: suppliers = [] } = useAllSuppliers();

  // Query: Carrega todos os produtos para seleção rápida na nota
  const { data: products = [] } = useQuery({
    queryKey: CATALOG_KEYS.products,
    queryFn: () => getAllProducts(),
  });

  // Sincroniza parâmetros de URL para pré-carregar um produto vindo da listagem principal
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const productIdParam = searchParams.get("productId");
    if (productIdParam && products.length > 0) {
      const prod = products.find((p) => p.id === Number(productIdParam));
      if (prod) {
        setNewEntryModalOpen(true);
        setItems([
          {
            productId: String(prod.id),
            quantity: 1,
            unitCost: prod.costPrice || 0,
            price: prod.price || 0,
          },
        ]);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [products]);

  // Mutation: Registrar entrada no estoque
  const { mutate: receiveEntry, isPending: isSavingEntry } = useReceivePurchaseEntry({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Entrada de estoque registrada com sucesso!" });
        setNewEntryModalOpen(false);
        resetNewEntryForm();
        refetchEntries();
      },
      onError: (err: unknown) => {
        toast({
          title: "Erro ao registrar entrada",
          description: describeApiError(err, "Ocorreu um erro no processamento."),
          variant: "destructive",
        });
      },
    },
  });

  // Mutation: Cancelar entrada de estoque
  const { mutate: deleteEntry } = useDeletePurchaseEntry({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Entrada removida e estoque recalculado!" });
        setDetailsModalOpen(false);
        setSelectedEntryId(null);
        refetchEntries();
      },
      onError: (err: unknown) => {
        toast({
          title: "Erro ao excluir entrada",
          description: describeApiError(err, "O estoque desta entrada já pode ter sido consumido."),
          variant: "destructive",
        });
      },
    },
  });

  function resetNewEntryForm() {
    setSupplierId("");
    setInvoiceNumber("");
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
    setItems([]);
  }

  function handleAddEmptyItem() {
    setItems((prev) => [...prev, { productId: "", quantity: 1, unitCost: 0, price: 0 }]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, field: keyof NewEntryItem, value: any) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const updated = { ...item, [field]: value };

        // Auto preenche o preço e custo sugeridos caso mude o produto selecionado
        if (field === "productId") {
          const prod = products.find((p) => p.id === Number(value));
          if (prod) {
            updated.price = prod.price;
            updated.unitCost = prod.costPrice;
          }
        }

        return updated;
      }),
    );
  }

  /**
   * Valida e submete a gravação da nova entrada de mercadoria.
   */
  function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      toast({ title: "Atenção", description: "Selecione um fornecedor.", variant: "warning" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Atenção", description: "Adicione pelo menos um produto.", variant: "warning" });
      return;
    }

    const invalidItem = items.some(
      (item) => !item.productId || item.quantity <= 0 || item.unitCost < 0 || item.price < 0,
    );
    if (invalidItem) {
      toast({
        title: "Atenção",
        description: "Verifique se todos os produtos foram selecionados e se os valores são válidos.",
        variant: "warning",
      });
      return;
    }

    receiveEntry({
      data: {
        supplierId: Number(supplierId),
        entryDate: new Date(entryDate).toISOString(),
        invoiceNumber: invoiceNumber || null,
        notes: notes || null,
        items: items.map((i) => ({
          productId: Number(i.productId),
          quantity: i.quantity,
          unitCost: i.unitCost,
          price: i.price,
        })),
      },
    });
  }

  function handleViewDetails(id: number) {
    setSelectedEntryId(id);
    setDetailsModalOpen(true);
  }

  function formatCurrency(val: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  }

  function formatShortDate(dateStr: string) {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  }

  return {
    page,
    setPage,
    selectedEntryId,
    setSelectedEntryId,
    detailsModalOpen,
    setDetailsModalOpen,
    newEntryModalOpen,
    setNewEntryModalOpen,
    selectedSupplierFilter,
    setSelectedSupplierFilter,
    supplierId,
    setSupplierId,
    invoiceNumber,
    setInvoiceNumber,
    entryDate,
    setEntryDate,
    notes,
    setNotes,
    items,
    setItems,
    entriesData,
    isLoadingEntries,
    entryDetails,
    isLoadingDetails,
    suppliers,
    products,
    isSavingEntry,
    resetNewEntryForm,
    handleAddEmptyItem,
    handleRemoveItem,
    handleItemChange,
    handleSaveEntry,
    handleViewDetails,
    formatCurrency,
    formatShortDate,
    deleteEntry,
  };
}
