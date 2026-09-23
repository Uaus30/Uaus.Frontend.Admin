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
  useGetStockFreezeStatus,
  type PurchaseDto,
  type PurchasesParams,
} from "@workspace/api-client-react";
import { RESOURCE_KEYS, useAllCategories, useAllDepartments, useAllSuppliers } from "@/hooks/use-catalog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { announceReactivatedProducts } from "@/lib/product-reactivation";
import { productStockTabPathname } from "@/features/products/product-detail-route";
import { productFromPurchasePath } from "../purchases-route";
import type { PurchaseFormItem, ReceiveForm } from "../types";
import { useNewPurchaseFromUrl } from "./useNewPurchaseFromUrl";
import { usePurchaseFromUrl } from "./usePurchaseFromUrl";
import { purchaseHasProduct, todayDateKey, usePurchaseForm } from "./usePurchaseForm";

/**
 * Linhas por página.
 *
 * Cem, e não vinte (13/09/2026): a tela abre em "Não lançadas", que é o que
 * ainda está por chegar — dezenas de linhas, não milhares —, e paginar isso
 * esconde parte do que a pessoa veio olhar de uma vez. Cem é também o teto que
 * a API aceita (`Math.Clamp(size, 1, 100)`), então pedir mais não traria mais.
 * A paginação continua na tela para o filtro "Todas as situações", que inclui o
 * histórico de lançadas e cresce sem parar.
 */
export const PAGE_SIZE = 100;

/** Valor do filtro de situação que não filtra nada. */
export const STATUS_FILTER_ALL = "all";

/**
 * Valor do filtro de situação para "Não lançadas": Pendente e A caminho, o que
 * ainda está por chegar. É o padrão da tela — a compra lançada já virou
 * entrada e vive na aba de estoque do produto; aqui ela só empurraria para
 * baixo o que ainda precisa de ação. Continua a um clique, no mesmo filtro.
 */
export const STATUS_FILTER_OPEN = "open";

/**
 * Traduz o valor do `<Select>` de situação nos parâmetros da consulta.
 *
 * Os dois valores especiais viram `onlyOpen` ou nada; qualquer outro é o
 * código de `PurchaseStatus` como string. Separado do hook para ter teste puro.
 */
export function purchasesStatusParams(filter: string): Pick<PurchasesParams, "status" | "onlyOpen"> {
  if (filter === STATUS_FILTER_OPEN) return { onlyOpen: true };
  if (filter === STATUS_FILTER_ALL) return {};
  return { status: Number(filter) };
}

/**
 * O formulário de recebimento em branco desta compra.
 *
 * O preço já vem com o que a COMPRA pretendia cobrar: quem decidiu a margem foi
 * quem comprou, olhando para o custo, e obrigar a redigitar no recebimento é
 * pedir a mesma decisão duas vezes — com o risco de a segunda sair diferente.
 * Sem preço sugerido, zero mantém o preço atual do cadastro, como antes.
 */
function emptyReceiveForm(purchase?: PurchaseDto): ReceiveForm {
  return {
    entryDate: todayDateKey(),
    invoiceNumber: "",
    notes: "",
    price: purchase?.suggestedPrice ?? 0,
    // A grade vem com o que foi PEDIDO; conferir é ajustar o que veio.
    items: (purchase?.items ?? []).flatMap((item) =>
      item.productId == null
        ? []
        : [
            {
              productId: item.productId,
              name: item.productName,
              barcode: item.barcode ?? null,
              stock: item.stock,
              quantity: item.quantity,
              grossTotal: item.grossTotal,
              finalTotal: item.finalTotal,
            },
          ],
    ),
    finalTotal: purchase?.finalTotal ?? 0,
  };
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
  const [statusFilter, setStatusFilterState] = useState<string>(STATUS_FILTER_OPEN);
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
    ...purchasesStatusParams(statusFilter),
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  });
  useApiErrorToast(list.isError, list.error);

  const { data: suppliers = [] } = useAllSuppliers();
  // O recebimento grava entrada: com a conferência de estoque aberta, fica pausado.
  const stockFrozen = useGetStockFreezeStatus().data?.salesPaused === true;
  // Departamento e categoria saíram do cadastro de produto para a compra
  // (13/09/2026): o recebimento de produto novo gera o cadastro com os dois
  // preenchidos. O departamento não é gravado — ele filtra as categorias.
  const { data: departments = [] } = useAllDepartments();
  const { data: categories = [] } = useAllCategories();

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

  const form = usePurchaseForm({ onSaved: invalidate, suppliers, categories });

  // Quem chega de `/estoque/compras?produto=10&fornecedor=13` — o "Resolver" do
  // relatório de estoque baixo — cai no formulário já preenchido.
  useNewPurchaseFromUrl({ abrirCompra: form.openForRestock });

  // E quem chega por `/estoque/compras?compra=12` — o link copiado da barra de
  // endereços com a modal aberta — cai na modal daquela compra.
  usePurchaseFromUrl({ abrirCompra: form.openEdit });

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
        error,
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
        error,
        variant: "destructive",
      }),
  });

  // ---- Recebimento de produto já cadastrado ----
  const [receiving, setReceiving] = useState<PurchaseDto | null>(null);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(emptyReceiveForm);

  const receiveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReceiveForm }) =>
      receivePurchase(id, {
        // Instante LOCAL sem fuso, como as demais entradas: `entry_date` é
        // `timestamp without time zone` e o Npgsql recusa Kind=Utc.
        entryDate: `${payload.entryDate}T00:00:00`,
        invoiceNumber: payload.invoiceNumber || null,
        notes: payload.notes || null,
        price: payload.price > 0 ? payload.price : null,
        // Grade só quando a compra tem mais de uma variação: com uma só não há
        // conferência a fazer, e mandar a lista seria ruído no corpo.
        items:
          payload.items.length > 1
            ? payload.items
                .filter((item) => item.quantity > 0)
                .map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  finalTotal: item.finalTotal,
                }))
            : undefined,
        finalTotal: payload.items.length > 1 ? payload.finalTotal : undefined,
      }),
    onSuccess: async (purchase) => {
      await invalidate();
      setReceiving(null);
      toast({
        title: "Compra lançada no estoque",
        description: `${purchase.quantity} un. de ${purchase.productName} entraram no estoque.`,
      });
      announceReactivatedProducts(purchase.reactivatedProducts);
      // Na aba de Estoque: a entrada que este recebimento acabou de gravar e o
      // que a pessoa veio conferir.
      if (purchase.productGroupId)
        navigate(productStockTabPathname(purchase.productGroupId, purchase.productId));
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao receber a compra",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      }),
  });

  /**
   * "Lançar recebimento": decide o caminho pelo vínculo com produto.
   *
   * Sem produto, a tela de Produtos abre o cadastro preenchido pela compra;
   * com produto, o diálogo de recebimento pede só o que a compra não sabe
   * (data, nota, preço de venda) e confere a grade.
   *
   * Quem responde "tem produto?" é o `purchaseHasProduct`, e não o `productId`
   * sozinho: numa compra com VARIAÇÕES o cabeçalho não aponta para nenhuma delas,
   * e olhar só para ele mandava a compra para o cadastro em branco — criando um
   * produto novo, sem variações, ao lado do que já existia.
   *
   * **Compra PENDENTE não se recebe** (13/09/2026). Pendente é a anotação de
   * "preciso comprar isto" — o pedido ainda não foi fechado, e é justamente ali
   * que o custo pode não existir. Receber dali pularia a etapa que diz que a
   * compra saiu: o caminho é marcar como a caminho primeiro, o que já exige o
   * custo de que a entrada precisa.
   *
   * **Nem começa com a conferência de estoque aberta** (23/09/2026): a entrada
   * seria recusada (423). Pelo caminho do produto novo seria pior do que a
   * recusa — o cadastro nasceria, a entrada não, e a compra, ainda sem produto
   * vinculado, mandaria criar o cadastro DE NOVO depois do encerramento.
   */
  function startReceive(purchase: PurchaseDto) {
    const status = enumCode(purchase.status, PURCHASE_STATUS);
    if (status === PURCHASE_STATUS.Received || status === PURCHASE_STATUS.Pending) return;

    if (stockFrozen) {
      toast({
        title: "Recebimento pausado",
        description:
          "Há uma conferência de estoque em andamento. Lance o recebimento depois que ela for encerrada.",
        variant: "warning",
      });
      return;
    }

    if (!purchaseHasProduct(purchase)) {
      navigate(productFromPurchasePath(purchase.id));
      return;
    }

    setReceiveForm(emptyReceiveForm(purchase));
    setReceiving(purchase);
  }

  function updateReceiveForm<K extends keyof ReceiveForm>(field: K, value: ReceiveForm[K]) {
    setReceiveForm((current) => ({ ...current, [field]: value }));
  }

  /**
   * Ajusta uma variação na conferência.
   *
   * Só a quantidade e a fatia mudam aqui; o total pago é campo à parte, porque
   * mexer no que chegou não deve mexer no que saiu do bolso por efeito colateral.
   */
  function updateReceiveItem(productId: number, campo: "quantity" | "finalTotal", valor: number) {
    setReceiveForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.productId === productId ? { ...item, [campo]: valor } : item)),
    }));
  }

  /** Acrescenta à conferência uma variação que veio e não estava no pedido. */
  function addReceiveItem(item: PurchaseFormItem) {
    setReceiveForm((current) =>
      current.items.some((atual) => atual.productId === item.productId)
        ? current
        : { ...current, items: [...current.items, item] },
    );
  }

  /**
   * "Editar compra" de dentro do diálogo de recebimento: o caminho da compra
   * anotada sem custo. Fecha o diálogo e abre o formulário da mesma compra.
   */
  function editReceiving() {
    if (!receiving) return;
    const purchase = receiving;
    setReceiving(null);
    form.openEdit(purchase);
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
    departments,
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
    updateReceiveItem,
    addReceiveItem,
    startReceive,
    cancelReceive: () => setReceiving(null),
    editReceiving,
    confirmReceive,
    isReceiving: receiveMutation.isPending,
    stockFrozen,
  };
}
