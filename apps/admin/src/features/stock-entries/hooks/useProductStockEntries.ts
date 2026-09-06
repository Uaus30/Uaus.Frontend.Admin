import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@workspace/ui";
import { describeApiError, formatCurrency, formatShortDate } from "@workspace/core";
import {
  getGetPurchaseEntriesQueryKey,
  useDeletePurchaseEntry,
  useGetPurchaseEntries,
  useGetPurchaseEntryDetails,
  useReceivePurchaseEntry,
} from "@workspace/api-client-react";

import { getProductById } from "@/services/products.service";
import { RESOURCE_KEYS, useAllSuppliers } from "@/hooks/use-catalog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import type { StockEntryPrefill } from "../types";

export type UseProductStockEntriesOptions = {
  /**
   * Entrada pré-preenchida por uma compra. Com ela, a modal de lançamento abre
   * SOZINHA assim que o produto carrega — é o "avançar para a entrada" do
   * recebimento de produto novo.
   */
  prefill?: StockEntryPrefill | null;
  /** Chamado com o id da entrada gravada. É quem fecha a compra (`mark-received`). */
  onEntrySaved?: (entryId: number) => void;
};

/** Linhas por página do histórico dentro da aba. É um recorte, não a tela cheia. */
const PAGE_SIZE = 10;

/** Rascunho da entrada simplificada: um produto só, o resto igual à nota completa. */
export type SimpleEntryForm = {
  supplierId: string;
  entryDate: string;
  invoiceNumber: string;
  notes: string;
  quantity: number;
  unitCost: number;
  price: number;
};

function emptyForm(): SimpleEntryForm {
  return {
    supplierId: "",
    entryDate: format(new Date(), "yyyy-MM-dd"),
    invoiceNumber: "",
    notes: "",
    quantity: 1,
    unitCost: 0,
    price: 0,
  };
}

/**
 * Histórico de entradas de UM produto e o lançamento simplificado dele.
 *
 * Alimenta a aba **Estoque** da tela de detalhe do produto. Mora aqui, e não na
 * feature de produtos, porque tudo que ele sabe é regra de entrada de mercadoria
 * — a convenção de data sem fuso, a validação do rascunho e a invalidação da
 * listagem são as mesmas do formulário completo, e duplicá-las na outra feature
 * seria repetir a armadilha que o `toISOString()` já custou uma vez.
 *
 * ## Por que a listagem é a de notas, e não a de lotes
 *
 * `GET /PurchaseEntries?productId=` devolve as NOTAS que trouxeram o produto,
 * já ordenadas por data de entrada decrescente e, no empate, por id decrescente
 * (o empate é o caso comum: a data é um dia-calendário à meia-noite). A coluna
 * de valor é o total da NOTA, não do produto — uma nota com dez itens mostra o
 * valor dos dez. Quem quer o que este produto trouxe abre os detalhes, que
 * listam quantidade e custo item a item.
 */
export function useProductStockEntries(
  productId: number | null,
  options: UseProductStockEntriesOptions = {},
) {
  const { prefill = null, onEntrySaved } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [newEntryModalOpen, setNewEntryModalOpen] = useState(false);
  const [form, setForm] = useState<SimpleEntryForm>(emptyForm);
  // Chave de idempotência: UMA por lançamento, renovada a cada abertura da
  // modal. Um retry depois de timeout reenvia a mesma chave e o backend devolve
  // a nota já gravada em vez de duplicar lote e estoque.
  const [clientReference, setClientReference] = useState<string>(() => crypto.randomUUID());

  // Trocar de produto (variação, ou fechar e abrir outro cadastro) tem que
  // voltar para a primeira página: manter a página 3 do produto anterior mostra
  // "nenhuma entrada" para um produto que tem entradas.
  //
  // O ajuste é feito DURANTE o render, e não num efeito, porque é exatamente o
  // caso que a documentação do React chama de "ajustar estado quando uma prop
  // muda": no efeito, a tela chegaria a renderizar uma vez com a página velha e
  // o produto novo — e o lint recusa `setState` síncrono dentro de efeito.
  const [productOfPage, setProductOfPage] = useState(productId);
  if (productOfPage !== productId) {
    setProductOfPage(productId);
    setPage(1);
  }

  const {
    data: entriesData,
    isLoading: isLoadingEntries,
    isError,
    error,
  } = useGetPurchaseEntries(
    { productId: productId ?? undefined, page, limit: PAGE_SIZE },
    { query: { enabled: productId !== null } },
  );

  useApiErrorToast(isError, error);

  const { data: entryDetails, isLoading: isLoadingDetails } = useGetPurchaseEntryDetails(
    selectedEntryId ?? 0,
    { query: { enabled: !!selectedEntryId } },
  );

  const { data: suppliers = [] } = useAllSuppliers();

  /**
   * O produto como está gravado AGORA — custo, preço e saldo.
   *
   * A tela de detalhe carrega o formulário uma vez, na abertura; registrar uma
   * entrada muda custo, preço e estoque no servidor e o formulário não fica
   * sabendo. Esta consulta é o que a aba mostra e o que o rascunho sugere, e é
   * invalidada logo depois de gravar.
   */
  const { data: product } = useQuery({
    queryKey: ["product-for-entry", productId],
    enabled: productId !== null,
    queryFn: () => getProductById(productId as number),
  });

  const { mutate: receiveEntry, isPending: isSavingEntry } = useReceivePurchaseEntry({
    mutation: {
      onSuccess: async (entry) => {
        toast({ title: "Sucesso", description: "Entrada de estoque registrada com sucesso!" });
        setNewEntryModalOpen(false);
        setPage(1);
        await invalidateAfterEntry();
        onEntrySaved?.(entry.id);
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

  const { mutate: deleteEntry } = useDeletePurchaseEntry({
    mutation: {
      onSuccess: async () => {
        toast({ title: "Sucesso", description: "Entrada removida e estoque recalculado!" });
        setDetailsModalOpen(false);
        setSelectedEntryId(null);
        await invalidateAfterEntry();
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

  /**
   * Recarrega tudo que uma entrada mexe.
   *
   * O prefixo das entradas alcança todas as páginas e filtros de uma vez; sem
   * ele, a página 1 ficaria no cache com dados de antes. `RESOURCE_KEYS.products`
   * entra porque receber mercadoria grava custo, preço e saldo no PRODUTO — a
   * tabela atrás da tela mostraria o estoque velho.
   */
  function invalidateAfterEntry() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetPurchaseEntriesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["product-for-entry", productId] }),
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
    ]);
  }

  /**
   * Abre o lançamento já com o custo e o preço vigentes sugeridos — e o
   * fornecedor da entrada mais recente pré-selecionado: o caso comum é repor
   * com quem já vendeu, e a lista vem ordenada da mais nova para a mais velha.
   */
  function openNewEntry() {
    const lastSupplierId = entriesData?.data?.[0]?.supplierId;
    setForm({
      ...emptyForm(),
      supplierId: lastSupplierId ? String(lastSupplierId) : "",
      unitCost: product?.costPrice ?? 0,
      price: product?.price ?? 0,
      // A compra manda no que ela sabe: quem vendeu, quanto veio e a quanto.
      // O preço de venda continua sendo o do cadastro, que acabou de ser salvo.
      ...(prefill
        ? {
            supplierId: String(prefill.supplierId),
            quantity: prefill.quantity,
            unitCost: prefill.unitCost,
            notes: prefill.notes ?? "",
          }
        : {}),
    });
    setClientReference(crypto.randomUUID());
    setNewEntryModalOpen(true);
  }

  // Abertura automática pela compra, UMA vez por compra e só depois de o
  // produto chegar (antes, custo e preço nasceriam zerados). É o mesmo ajuste
  // DURANTE o render usado para a página acima: num efeito seria o `setState`
  // síncrono que o lint recusa, e a tela mostraria um frame sem a modal.
  const [prefillOpenedFor, setPrefillOpenedFor] = useState<string | null>(null);
  if (prefill && product && productId !== null && prefillOpenedFor !== prefill.reference) {
    setPrefillOpenedFor(prefill.reference);
    openNewEntry();
  }

  function updateForm<K extends keyof SimpleEntryForm>(field: K, value: SimpleEntryForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openDetails(id: number) {
    setSelectedEntryId(id);
    setDetailsModalOpen(true);
  }

  /**
   * Valida e grava a entrada do produto selecionado.
   *
   * A data viaja como instante LOCAL sem fuso (`2026-08-16T00:00:00`), igual ao
   * formulário completo: `entry_date` é `timestamp without time zone` e o Npgsql
   * **recusa** um `DateTime` com `Kind=Utc` nessa coluna — o `toISOString()`
   * derrubava a gravação com 500. Ver seção 2 do README desta feature.
   */
  function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault();

    if (productId === null) return;

    if (!form.supplierId) {
      toast({ title: "Atenção", description: "Selecione um fornecedor.", variant: "warning" });
      return;
    }
    if (!form.entryDate) {
      toast({ title: "Atenção", description: "Informe a data da entrada.", variant: "warning" });
      return;
    }
    if (form.quantity <= 0 || !Number.isInteger(form.quantity) || form.unitCost < 0) {
      toast({
        title: "Atenção",
        description: "Verifique a quantidade e os valores lançados.",
        variant: "warning",
      });
      return;
    }
    // Preço zero NÃO passa: o valor lançado sobrescreve o preço de venda do
    // produto no cadastro — o backend também recusa desde a mesma correção.
    if (form.price <= 0) {
      toast({
        title: "Atenção",
        description: "Informe o preço de venda — ele passa a valer no cadastro do produto.",
        variant: "warning",
      });
      return;
    }

    receiveEntry({
      data: {
        supplierId: Number(form.supplierId),
        entryDate: `${form.entryDate}T00:00:00`,
        invoiceNumber: form.invoiceNumber || null,
        notes: form.notes || null,
        clientReference,
        items: [
          {
            productId,
            quantity: form.quantity,
            unitCost: form.unitCost,
            price: form.price,
          },
        ],
      },
    });
  }

  const totalPages = entriesData?.totalPages ?? 1;

  return {
    page,
    setPage,
    totalPages,
    entriesData,
    isLoadingEntries,
    product,
    suppliers,
    selectedEntryId,
    detailsModalOpen,
    setDetailsModalOpen,
    entryDetails,
    isLoadingDetails,
    openDetails,
    deleteEntry,
    newEntryModalOpen,
    setNewEntryModalOpen,
    openNewEntry,
    form,
    updateForm,
    isSavingEntry,
    handleSaveEntry,
    formatCurrency,
    formatShortDate,
  };
}
