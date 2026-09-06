import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  PURCHASE_STATUS,
  deletePurchase,
  enumCode,
  getGetPurchasesQueryKey,
  receivePurchase,
  updatePurchaseStatus,
  useGetPurchases,
  type PurchaseDto,
} from "@workspace/api-client-react";
import { RESOURCE_KEYS, useAllSuppliers } from "@/hooks/use-catalog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { productStockTabPathname } from "@/features/products/product-detail-route";
import { productFromPurchasePath } from "../purchases-route";
import type { ReceiveForm } from "../types";
import { useNewPurchaseFromUrl } from "./useNewPurchaseFromUrl";
import { usePurchaseForm } from "./usePurchaseForm";

/** Linhas por página. */
export const PAGE_SIZE = 20;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Tela de Compras: listagem com filtros, o formulário (via `usePurchaseForm`),
 * a troca de situação, a exclusão e os dois caminhos do "Lançar recebimento".
 *
 * ## Os dois caminhos do recebimento
 *
 * - **Produto já cadastrado** (reposição): abre o diálogo de recebimento
 *   (data, nota, preço) e chama `POST /Purchases/{id}/receive`, que grava a
 *   entrada com a quantidade e o custo da compra e marca como lançada, numa
 *   transação. Depois leva à tela do produto, onde a entrada já aparece.
 * - **Produto novo**: leva à tela de Produtos com `?compra=<id>`; o cadastro
 *   abre preenchido (nome, detalhes, fotos, preço sugerido) e, salvo, a aba
 *   Estoque já vem com a entrada da compra pronta. Quem fecha a compra é a
 *   própria entrada, chamando `mark-received` — ver `useProductStockEntries`.
 */
export function usePurchases() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [searchValue, setSearchValue] = useState("");
  const search = useDebounce(searchValue, 300);
  const [statusFilter, setStatusFilterState] = useState<string>("all");
  const [page, setPage] = useState(1);

  function setSearch(value: string) {
    setSearchValue(value);
    setPage(1);
  }

  function setStatusFilter(value: string) {
    setStatusFilterState(value);
    setPage(1);
  }

  const list = useGetPurchases({
    status: statusFilter !== "all" ? Number(statusFilter) : undefined,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  });
  useApiErrorToast(list.isError, list.error);

  const { data: suppliers = [] } = useAllSuppliers();

  /**
   * Invalida o PREFIXO: lista (todas as páginas e filtros) e itens. O
   * recebimento mexe também no produto (estoque, custo) — por isso o recurso
   * de produtos entra junto.
   */
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetPurchasesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
    ]);
  }

  const form = usePurchaseForm({ onSaved: invalidate });

  // Quem chega de `/estoque/compras?produto=10&fornecedor=13` — o "Resolver" do
  // relatório de estoque baixo — cai no formulário já preenchido.
  useNewPurchaseFromUrl({ abrirCompra: form.openForRestock });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) => updatePurchaseStatus(id, status),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Situação atualizada" });
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao alterar a situação",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePurchase(id),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Compra excluída" });
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao excluir a compra",
        description: describeApiError(error, "Compra já lançada não pode ser excluída."),
        variant: "destructive",
      }),
  });

  // ---- Recebimento de produto já cadastrado ----
  const [receiving, setReceiving] = useState<PurchaseDto | null>(null);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>({
    entryDate: todayKey(),
    invoiceNumber: "",
    notes: "",
    price: 0,
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReceiveForm }) =>
      receivePurchase(id, {
        // Instante LOCAL sem fuso, como as demais entradas: `entry_date` é
        // `timestamp without time zone` e o Npgsql recusa Kind=Utc.
        entryDate: `${payload.entryDate}T00:00:00`,
        invoiceNumber: payload.invoiceNumber || null,
        notes: payload.notes || null,
        price: payload.price > 0 ? payload.price : null,
      }),
    onSuccess: async (purchase) => {
      await invalidate();
      setReceiving(null);
      toast({
        title: "Compra lançada no estoque",
        description: `${purchase.quantity} un. de ${purchase.productName} entraram no estoque.`,
      });
      // Na aba de Estoque: a entrada que este recebimento acabou de gravar e o
      // que a pessoa veio conferir.
      if (purchase.productGroupId)
        navigate(productStockTabPathname(purchase.productGroupId, purchase.productId));
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao receber a compra",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      }),
  });

  /**
   * "Lançar recebimento": decide o caminho pelo vínculo com produto.
   *
   * Sem produto, a tela de Produtos abre o cadastro preenchido pela compra;
   * com produto, o diálogo de recebimento pede só o que a compra não sabe
   * (data, nota, preço de venda).
   */
  function startReceive(purchase: PurchaseDto) {
    if (enumCode(purchase.status, PURCHASE_STATUS) === PURCHASE_STATUS.Received) return;

    // `== null` de propósito: o backend omite campos nulos, e `productId` de
    // produto novo chega AUSENTE. Com `=== null` a compra de produto novo caía
    // no diálogo de produto vinculado.
    if (purchase.productId == null) {
      navigate(productFromPurchasePath(purchase.id));
      return;
    }

    setReceiveForm({ entryDate: todayKey(), invoiceNumber: "", notes: "", price: 0 });
    setReceiving(purchase);
  }

  function updateReceiveForm<K extends keyof ReceiveForm>(field: K, value: ReceiveForm[K]) {
    setReceiveForm((current) => ({ ...current, [field]: value }));
  }

  function confirmReceive() {
    if (!receiving) return;
    if (!receiveForm.entryDate) {
      toast({ title: "Informe a data da entrada", variant: "warning" });
      return;
    }
    receiveMutation.mutate({ id: receiving.id, payload: receiveForm });
  }

  return {
    // listagem
    searchValue,
    setSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    totalPages: list.data?.totalPages ?? 1,
    total: list.data?.total ?? 0,
    items: list.data?.data ?? [],
    isLoading: list.isLoading,
    suppliers,
    // formulário
    form,
    // ações da linha
    setStatus: (id: number, status: number) => statusMutation.mutate({ id, status }),
    remove: (id: number) => deleteMutation.mutate(id),
    mutatingId: statusMutation.isPending
      ? statusMutation.variables?.id
      : deleteMutation.isPending
        ? deleteMutation.variables
        : null,
    // recebimento
    receiving,
    receiveForm,
    updateReceiveForm,
    startReceive,
    cancelReceive: () => setReceiving(null),
    confirmReceive,
    isReceiving: receiveMutation.isPending,
  };
}
