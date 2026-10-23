import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError, exceedsMaxSalePrice, isBelowCost } from "@workspace/core";
import {
  PURCHASE_STATUS,
  deletePurchase,
  enumCode,
  getPurchase,
  getGetLowStockQueryKey,
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
import { useSessao } from "@/hooks/use-sessao";
import { announceReactivatedProducts } from "@/lib/product-reactivation";
import { planTripNotice } from "@/lib/stock-control";
import { productStockTabPathname } from "@/features/products/product-detail-route";
import { productFromPurchasePath } from "../purchases-route";
import { conferencia, isNewBrandRow, purchaseItemIdOf } from "../lib/new-brand";
import {
  effectiveSupplierFilter,
  purchasesSupplierParams,
  readSupplierFilter,
  rememberSupplierFilter,
} from "../lib/purchase-filters";
import { barcodeChangesOf, receiveBarcodeProblem, receiveUnitCost } from "../lib/receive-barcode";
import type { PurchaseFormItem, ReceiveForm } from "../types";
import { useCancelPurchaseReceipt } from "./useCancelPurchaseReceipt";
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
 *
 * O nº da nota também já vem, quando a compra o tem (24/09/2026): ele foi
 * digitado no registro da compra, e é a mesma nota.
 */
function emptyReceiveForm(purchase?: PurchaseDto): ReceiveForm {
  return {
    entryDate: todayDateKey(),
    invoiceNumber: purchase?.invoiceNumber ?? "",
    notes: "",
    // Sem preço na compra, o ATUAL do produto (22/10/2026): a reposição grava o
    // preço em branco quando ninguém o mexeu, e o recebimento mostra o de agora.
    price: purchase?.suggestedPrice ?? purchase?.productPrice ?? 0,
    // A grade vem com o que foi PEDIDO; conferir é ajustar o que veio. A marca
    // nova (fase 4) vem com o código que a compra já sabia, se sabia — o
    // recebimento o exige, bipado ou gerado.
    items: (purchase?.items ?? []).flatMap((item) => {
      // A marca nova (fase 4) e a variação do produto novo (fase 5) são a mesma
      // linha sem cadastro.
      const semCadastro = item.newBrand || item.newValue;
      if (item.productId == null && semCadastro)
        return [
          {
            productId: -item.id,
            name: semCadastro,
            barcode: null,
            stock: 0,
            quantity: item.quantity,
            grossTotal: item.grossTotal,
            finalTotal: item.finalTotal,
            newBrand: semCadastro,
            newBarcode: item.newBarcode ?? "",
            generateBarcode: false,
          },
        ];
      return item.productId == null
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
          ];
    }),
    finalTotal: purchase?.finalTotal ?? 0,
    currentBrand: "",
    barcodeChanges: {},
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
 * - **Produto novo JÁ com variações** (fase 5, 21/10/2026): o diálogo, como o
 *   primeiro caminho. O produto nasce na confirmação, com o código de cada
 *   variação bipado ou gerado, e a tela vai para ele, na aba Estoque.
 */
export function usePurchases() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [searchValue, setSearchValue] = useState("");
  const search = useDebounce(searchValue, 300);
  const [statusFilter, setStatusFilterState] = useState<string>(STATUS_FILTER_OPEN);
  const [page, setPage] = useState(1);

  const { data: suppliers = [] } = useAllSuppliers();

  // O filtro de fornecedor é LEMBRADO (22/10/2026, pedido do dono): registrar uma
  // compra ou lançar um recebimento — que leva à tela do produto e desmonta esta —
  // não o desfaz. Enquanto ninguém escolhe nesta visita, vale o gravado; quem
  // escolhe grava. Ver `lib/purchase-filters.ts`.
  const { data: usuario } = useSessao();
  const userId = usuario?.id ?? null;
  const lembrado = useMemo(() => readSupplierFilter(userId), [userId]);
  const [supplierChoice, setSupplierChoice] = useState<string | null>(null);
  const supplierFilter = effectiveSupplierFilter(supplierChoice ?? lembrado, suppliers);

  function setSearch(value: string) {
    setSearchValue(value);
    setPage(1);
  }

  function setStatusFilter(value: string) {
    setStatusFilterState(value);
    setPage(1);
  }

  function setSupplierFilter(value: string) {
    setSupplierChoice(value);
    rememberSupplierFilter(userId, value);
    setPage(1);
  }

  const list = useGetPurchases({
    ...purchasesStatusParams(statusFilter),
    ...purchasesSupplierParams(supplierFilter),
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  });
  useApiErrorToast(list.isError, list.error);

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
      // A compra que vai para A caminho sai do relatório e do alerta de estoque
      // baixo (14/10/2026); sem isso, o vermelho do painel ficaria até um
      // minuto com o número velho.
      queryClient.invalidateQueries({ queryKey: getGetLowStockQueryKey() }),
    ]);
  }

  const form = usePurchaseForm({ onSaved: invalidate, suppliers, categories });

  // "Cancelar recebimento" (23/10/2026): cancelada, a compra abre em edição já "A
  // caminho" — é ali que se troca o produto errado antes de receber de novo.
  const cancelReceipt = useCancelPurchaseReceipt({ onCancelled: form.openEdit });

  /**
   * O "Cancelar recebimento" do rodapé da compra lançada. A modal da compra
   * fecha antes de a confirmação abrir: dois diálogos empilhados disputariam o
   * foco, e a compra volta a abrir sozinha, editável, quando o cancelamento sai.
   *
   * Desistir ("Voltar") reabre a compra como estava: quem estava olhando para ela
   * não pode cair na lista — que abre em "Não lançadas", sem a compra. Ela é
   * relida, porque o formulário não guarda a compra inteira.
   */
  function cancelReceiptOfOpenPurchase() {
    if (form.editingId == null) return;
    const target = { id: form.editingId, productName: form.form.productName };
    form.requestClose();
    cancelReceipt.start(target, {
      onDismiss: () => {
        getPurchase(target.id)
          .then(form.openEdit)
          .catch((error: unknown) =>
            toast({
              title: "Não foi possível reabrir a compra",
              description: describeApiError(error, "Abra a compra de novo pela lista."),
              error,
              variant: "destructive",
            }),
          );
      },
    });
  }

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
  /** O preço do recebimento fica abaixo do custo: a confirmação está aberta. */
  const [belowCostOpen, setBelowCostOpen] = useState(false);

  const receiveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReceiveForm }) =>
      receivePurchase(id, {
        // Instante LOCAL sem fuso, como as demais entradas: `entry_date` é
        // `timestamp without time zone` e o Npgsql recusa Kind=Utc.
        entryDate: `${payload.entryDate}T00:00:00`,
        invoiceNumber: payload.invoiceNumber || null,
        notes: payload.notes || null,
        price: payload.price > 0 ? payload.price : null,
        // Grade só quando a compra tem mais de uma variação (ou marca nova): com
        // uma só não há conferência a fazer, e mandar a lista seria ruído no corpo.
        // A marca nova vai SEMPRE, inclusive com zero: o servidor exige saber de
        // cada uma se veio (fase 4).
        items: conferencia(payload.items)
          ? payload.items
              .filter((item) => item.quantity > 0 || isNewBrandRow(item))
              .map((item) =>
                isNewBrandRow(item)
                  ? {
                      productId: null,
                      purchaseItemId: purchaseItemIdOf(item),
                      quantity: item.quantity,
                      finalTotal: item.quantity > 0 ? item.finalTotal : 0,
                      barcode: item.generateBarcode ? null : item.newBarcode?.trim() || null,
                      generateBarcode: item.generateBarcode ?? false,
                    }
                  : {
                      productId: item.productId,
                      quantity: item.quantity,
                      finalTotal: item.finalTotal,
                    },
              )
          : undefined,
        finalTotal: conferencia(payload.items) ? payload.finalTotal : undefined,
        currentBrand: payload.currentBrand.trim() || null,
        // "Código de barras mudou?" (22/10/2026): só o que mudou de fato.
        barcodeChanges: barcodeChangesOf(payload.items, payload.barcodeChanges),
      }),
    onSuccess: async (purchase) => {
      await invalidate();
      setReceiving(null);
      toast({
        title: "Compra lançada no estoque",
        description: `${purchase.quantity} un. de ${purchase.productName} entraram no estoque.`,
      });
      announceReactivatedProducts(purchase.reactivatedProducts);
      // Compra pequena de atacado ou varejo (14/10/2026): o produto saiu do
      // controle de estoque. Com um toast por vez na tela, este SUBSTITUI o
      // "Compra lançada" de propósito — é o que surpreende; a entrada gravada a
      // pessoa vê na aba Estoque, para onde a tela vai agora.
      const planTrip = planTripNotice(purchase.planTripProducts);
      if (planTrip) toast({ ...planTrip, variant: "warning" });
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

    // Produto NOVO já com variações (fase 5) não vai ao cadastro: ele nasce na
    // própria conferência, com o código de cada variação.
    if (!purchaseHasProduct(purchase) && purchase.newVariationGradeType == null) {
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
  /** Linha de marca nova no recebimento: o código bipado ou o "Gerar código". */
  function updateReceiveBrand(
    productId: number,
    campo: "newBarcode" | "generateBarcode",
    valor: string | boolean,
  ) {
    setReceiveForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.productId === productId ? { ...item, [campo]: valor } : item)),
    }));
  }

  /** "Código de barras mudou?": o código novo de uma variação cadastrada da compra. */
  function updateReceiveBarcode(productId: number, valor: string) {
    setReceiveForm((current) => ({
      ...current,
      barcodeChanges: { ...current.barcodeChanges, [productId]: valor },
    }));
  }

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

  /**
   * Confirma o recebimento.
   *
   * Preço abaixo do custo — margem negativa — é permitido (22/10/2026: o custo
   * pode passar do teto de R$ 30), mas pergunta antes: é o número que só se digita
   * por engano ou de propósito. Em branco vale o preço atual do produto, que
   * também é conferido.
   */
  function confirmReceive(aceitaPrejuizo = false) {
    if (!receiving) return;
    if (!receiveForm.entryDate) {
      toast({ title: "Informe a data da entrada", variant: "warning" });
      return;
    }
    const problema = exceedsMaxSalePrice(receiveForm.price)
      ? "O preço de venda não pode passar de R$ 30,00, o teto da loja."
      : receiveBarcodeProblem(receiveForm.items, receiveForm.barcodeChanges);
    if (problema) {
      toast({ title: "Atenção", description: problema, variant: "warning" });
      return;
    }
    const preco = receiveForm.price > 0 ? receiveForm.price : (receiving.productPrice ?? 0);
    if (!aceitaPrejuizo && isBelowCost(receiveUnitCost(receiving, receiveForm.items), preco)) {
      setBelowCostOpen(true);
      return;
    }
    setBelowCostOpen(false);
    receiveMutation.mutate({ id: receiving.id, payload: receiveForm });
  }

  return {
    // listagem
    searchValue,
    setSearch,
    statusFilter,
    setStatusFilter,
    supplierFilter,
    setSupplierFilter,
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
    updateReceiveBrand,
    updateReceiveBarcode,
    addReceiveItem,
    startReceive,
    cancelReceive: () => setReceiving(null),
    editReceiving,
    confirmReceive: () => confirmReceive(),
    /** A pergunta da margem negativa no recebimento. */
    belowCostOpen,
    // Só com a pergunta de pé — ver `usePurchaseForm.confirmBelowCost`.
    confirmReceiveBelowCost: () => {
      if (belowCostOpen) confirmReceive(true);
    },
    cancelReceiveBelowCost: () => setBelowCostOpen(false),
    isReceiving: receiveMutation.isPending,
    stockFrozen,
    // cancelamento do recebimento
    cancelReceipt,
    cancelReceiptOfOpenPurchase,
  };
}
