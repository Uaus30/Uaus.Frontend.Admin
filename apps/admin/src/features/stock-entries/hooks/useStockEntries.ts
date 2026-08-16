import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@workspace/ui";
import {
  getGetPurchaseEntriesQueryKey,
  useGetPurchaseEntries,
  useGetPurchaseEntryDetails,
  useReceivePurchaseEntry,
  useDeletePurchaseEntry,
} from "@workspace/api-client-react";

import { getProductById } from "@/services/products.service";
import type { ProductSearchOption } from "@/components/product-search-picker";
import type { NewEntryItem } from "../types";
import { useAllSuppliers } from "@/hooks/use-catalog";
import { describeApiError } from "@workspace/core";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/** Campos numéricos que o operador digita direto na linha do rascunho. */
export type EditableEntryItemField = "quantity" | "unitCost" | "price";

/** O que o rascunho precisa saber de um produto, venha da busca ou do `?productId=`. */
type ProductForDraft = {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  costPrice: number;
};

/**
 * Monta a linha do rascunho já com custo e preço sugeridos pelo cadastro.
 *
 * Sugerir não é impor: a nota manda no custo, e é comum ela chegar com preço
 * diferente do último. Os dois campos seguem editáveis na linha.
 */
function toDraftItem(product: ProductForDraft, quantity = 1): NewEntryItem {
  return {
    productId: product.id,
    productName: product.name,
    barcode: product.barcode || null,
    quantity,
    unitCost: product.costPrice ?? 0,
    price: product.price ?? 0,
  };
}

/** Lê o `?productId=` da URL, ignorando lixo (`abc`, `0`, negativo). */
function readPreloadProductId(): number | null {
  const param = new URLSearchParams(window.location.search).get("productId");
  if (!param) return null;
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * useStockEntries
 *
 * Hook customizado para gerenciar a listagem, detalhamento, criação
 * e cancelamento de notas/entradas de mercadoria no estoque.
 */
export function useStockEntries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    isError,
    error,
  } = useGetPurchaseEntries({
    page,
    limit: 10,
    supplierId: selectedSupplierFilter !== "all" ? Number(selectedSupplierFilter) : undefined,
  });

  /**
   * Recarrega a listagem inteira, e não só a página aberta.
   *
   * `refetch()` da própria query atualizaria apenas a combinação de página e
   * filtro em uso; as demais ficariam no cache com dados de antes. Invalidar
   * pelo PREFIXO da chave alcança todas de uma vez (ver armadilha 1 do
   * CLAUDE.md e o README do api-client).
   */
  function invalidateEntries() {
    return queryClient.invalidateQueries({ queryKey: getGetPurchaseEntriesQueryKey() });
  }

  /**
   * Troca o fornecedor do filtro e volta para a primeira página.
   *
   * Manter a página atual mostraria "nenhuma entrada" só porque o novo recorte
   * é menor que o anterior.
   */
  function handleSupplierFilterChange(value: string) {
    setSelectedSupplierFilter(value);
    setPage(1);
  }

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

  // Atalho "registrar entrada" da tela de produtos: o produto vem pela URL.
  // Busca-se UM produto por ID em vez do catálogo inteiro — a tela não carrega
  // mais a lista completa desde que a escolha passou a ser por busca.
  const [preloadProductId] = useState(readPreloadProductId);
  const preloadAppliedRef = useRef(false);

  const { data: preloadProduct } = useQuery({
    queryKey: ["product-for-entry", preloadProductId],
    enabled: preloadProductId !== null,
    queryFn: () => getProductById(preloadProductId as number),
  });

  useEffect(() => {
    if (!preloadProduct || preloadAppliedRef.current) return;

    // A guarda de uma vez só existe porque o efeito também roda quando a query
    // revalida; sem ela, voltar para a aba repetiria o item já lançado.
    preloadAppliedRef.current = true;
    setNewEntryModalOpen(true);
    setItems([toDraftItem(preloadProduct)]);
    window.history.replaceState(null, "", window.location.pathname);
  }, [preloadProduct]);

  // Mutation: Registrar entrada no estoque
  const { mutate: receiveEntry, isPending: isSavingEntry } = useReceivePurchaseEntry({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Entrada de estoque registrada com sucesso!" });
        setNewEntryModalOpen(false);
        resetNewEntryForm();
        // Volta para a primeira página: é lá que a nota nova aparece, já que a
        // listagem vem ordenada por data de entrada decrescente. Salvar estando
        // na página 2 deixava o operador olhando para o fim da lista, sem ver o
        // que acabou de lançar.
        setPage(1);
        invalidateEntries();
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
        invalidateEntries();
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

  /**
   * Coloca o produto escolhido na busca no rascunho da nota.
   *
   * Escolher o mesmo produto de novo soma na linha existente em vez de
   * duplicá-la: duas linhas do mesmo produto viram dois lotes com o mesmo custo,
   * e conferir a nota contra a tela fica mais difícil sem ganho nenhum.
   */
  function handleAddItem(product: ProductSearchOption, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }

      return [...prev, toDraftItem(product, quantity)];
    });
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  /** Atualiza um dos campos numéricos da linha. O produto não muda mais aqui. */
  function handleItemChange(index: number, field: EditableEntryItemField, value: number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  /**
   * Valida e submete a gravação da nova entrada de mercadoria.
   *
   * A data viaja como instante LOCAL sem fuso (`2026-08-16T00:00:00`), que é a
   * convenção de datas do sistema (`docs/fuso-horario.md` do backend). O
   * `toISOString()` que estava aqui devolvia `...T00:00:00.000Z`: a coluna
   * `entry_date` é `timestamp without time zone` e o Npgsql **recusa** gravar um
   * `DateTime` com `Kind=Utc` nela — era isso que virava 500 ao salvar. Mesmo se
   * gravasse, a entrada do dia 16 cairia no dia 15 no Brasil.
   */
  function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      toast({ title: "Atenção", description: "Selecione um fornecedor.", variant: "warning" });
      return;
    }
    if (!entryDate) {
      toast({ title: "Atenção", description: "Informe a data da entrada.", variant: "warning" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Atenção", description: "Adicione pelo menos um produto.", variant: "warning" });
      return;
    }

    const invalidItem = items.some(
      (item) => item.productId <= 0 || item.quantity <= 0 || item.unitCost < 0 || item.price < 0,
    );
    if (invalidItem) {
      toast({
        title: "Atenção",
        description: "Verifique as quantidades e os valores lançados.",
        variant: "warning",
      });
      return;
    }

    receiveEntry({
      data: {
        supplierId: Number(supplierId),
        entryDate: `${entryDate}T00:00:00`,
        invoiceNumber: invoiceNumber || null,
        notes: notes || null,
        items: items.map((i) => ({
          productId: i.productId,
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
    setSelectedSupplierFilter: handleSupplierFilterChange,
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
    isSavingEntry,
    resetNewEntryForm,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleSaveEntry,
    handleViewDetails,
    formatCurrency,
    formatShortDate,
    deleteEntry,
  };
}
