import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError, toDateKey } from "@workspace/core";
import {
  PURCHASE_STATUS,
  buildPublicImageUrl,
  createPurchase,
  enumCode,
  updatePurchase,
  type PurchaseDto,
  type SavePurchasePayload,
  type SupplierDto,
} from "@workspace/api-client-react";
import type { ProductSearchOption } from "@/components/product-search-picker";
import type { PurchaseForm } from "../types";
import { usePurchaseImages } from "./usePurchaseImages";

/** Hoje, em `yyyy-MM-dd` — componentes LOCAIS, nunca `toISOString()`. */
export function todayDateKey(): string {
  return toDateKey(new Date());
}

/** O dia de uma data do backend (`2026-09-06T00:00:00`), para o campo de data. */
function dateKeyFromApi(value: string | undefined | null): string {
  return value ? value.slice(0, 10) : todayDateKey();
}

export function emptyPurchaseForm(): PurchaseForm {
  return {
    supplierId: "",
    productId: null,
    productName: "",
    productBarcode: null,
    details: "",
    purchaseLink: "",
    purchaseDate: todayDateKey(),
    quantity: 1,
    grossTotal: 0,
    finalTotal: 0,
    suggestedPrice: 0,
    status: String(PURCHASE_STATUS.Pending),
    images: [],
  };
}

/** Carrega uma compra gravada no formulário. */
export function purchaseToForm(purchase: PurchaseDto): PurchaseForm {
  const status = enumCode(purchase.status, PURCHASE_STATUS);
  return {
    supplierId: String(purchase.supplierId),
    // `?? null`: o backend omite campos nulos e o formulário compara com `=== null`.
    productId: purchase.productId ?? null,
    productName: purchase.productName,
    productBarcode: purchase.productBarcode ?? null,
    details: purchase.details ?? "",
    purchaseLink: purchase.purchaseLink ?? "",
    purchaseDate: dateKeyFromApi(purchase.purchaseDate),
    quantity: purchase.quantity,
    grossTotal: purchase.grossTotal,
    finalTotal: purchase.finalTotal,
    // Zero é "não informado": o campo de moeda não distingue vazio de zero, e o
    // backend recebe nulo nesse caso.
    suggestedPrice: purchase.suggestedPrice ?? 0,
    status: String(status === PURCHASE_STATUS.None ? PURCHASE_STATUS.Pending : status),
    images: purchase.images.map((image) => ({
      imageId: image.imageId,
      url: buildPublicImageUrl(image.url),
      name: purchase.productName,
    })),
  };
}

/**
 * O link é exigido nesta compra?
 *
 * Em marketplace, sair de "Pendente" sem o link deixa a loja com uma compra que
 * ninguém consegue rastrear: a plataforma tem vários vendedores, e não há
 * representante, catálogo nem número de pedido para consultar depois. Pendente
 * fica livre de propósito — é onde se anota a intenção de comprar, antes mesmo
 * de escolher o anúncio.
 *
 * A mesma regra existe no backend (`PurchaseService.EnsurePurchaseLinkAsync`).
 * Aqui ela é conveniência: avisa antes do envio, em vez de deixar o operador
 * preencher tudo para receber um 400.
 */
export function purchaseLinkIsRequired(form: PurchaseForm, supplier: SupplierDto | undefined): boolean {
  return Boolean(supplier?.isMarketplace) && Number(form.status) !== PURCHASE_STATUS.Pending;
}

/** O que falta no formulário para gravar, ou `null` quando está pronto. */
export function validatePurchaseForm(form: PurchaseForm, supplier?: SupplierDto): string | null {
  if (!form.supplierId) return "Selecione o fornecedor.";
  if (form.productId === null && !form.productName.trim()) return "Informe o produto ou o nome do produto.";
  if (!form.purchaseDate) return "Informe a data da compra.";
  if (form.purchaseDate > todayDateKey()) return "A data da compra não pode estar no futuro.";
  if (!Number.isInteger(form.quantity) || form.quantity <= 0)
    return "A quantidade deve ser um inteiro maior que zero.";
  if (form.grossTotal < 0 || form.finalTotal < 0) return "Os valores não podem ser negativos.";
  if (form.suggestedPrice < 0) return "O preço sugerido de venda não pode ser negativo.";
  if (purchaseLinkIsRequired(form, supplier) && !form.purchaseLink.trim())
    return `Informe o link da compra: ${supplier?.name ?? "este fornecedor"} é um marketplace, e sem o link não há como reencontrar o anúncio depois.`;
  return null;
}

type UsePurchaseFormParams = {
  /** Depois de gravar: quem chama invalida a listagem. */
  onSaved: () => Promise<unknown>;
  /**
   * Catálogo de fornecedores da tela. O formulário precisa dele para saber se o
   * escolhido é marketplace — a regra do link depende do cadastro, não do que
   * foi digitado.
   */
  suppliers: SupplierDto[];
};

/**
 * Formulário da compra: estado, produto vinculado, fotos e a gravação.
 *
 * As fotos vivem no `usePurchaseImages`, que este hook reexporta inteiro — são
 * quatro caminhos de entrada (arquivo, Ctrl+V, URL e busca na web) com
 * compressão e upload imediatos, e o corpo da compra leva só os ids.
 *
 * Dois campos merecem nota por não serem óbvios no payload:
 *
 * - **A data da compra** viaja como instante local (`T00:00:00`), não como
 *   `toISOString()`: a coluna é `timestamp without time zone` e o UTC jogaria o
 *   dia para trás no Brasil.
 * - **O preço sugerido zero vira nulo.** O `CurrencyInput` não distingue vazio
 *   de zero, e um zero gravado faria o recebimento tentar aplicar preço zero ao
 *   produto — nulo é o que mantém o preço atual do cadastro.
 */
export function usePurchaseForm({ onSaved, suppliers }: UsePurchaseFormParams) {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PurchaseForm>(emptyPurchaseForm);
  const images = usePurchaseImages({ productName: form.productName, setForm });
  /**
   * Compra lançada abre em leitura, e não deixa de abrir.
   *
   * O backend recusa editar uma compra já lançada — a entrada de estoque existe,
   * e mudar quantidade ou custo aqui deixaria os dois documentos discordando.
   * Mas continuar podendo ABRIR é o que faz a linha inteira ser clicável sem
   * exceção: quem clica quer ver o que comprou, não necessariamente mudar.
   */
  const [readOnly, setReadOnly] = useState(false);

  const supplier = suppliers.find((item) => String(item.id) === form.supplierId);

  function openNew() {
    setEditingId(null);
    setForm(emptyPurchaseForm());
    setReadOnly(false);
    setOpen(true);
  }

  function openEdit(purchase: PurchaseDto) {
    setEditingId(purchase.id);
    setForm(purchaseToForm(purchase));
    setReadOnly(enumCode(purchase.status, PURCHASE_STATUS) === PURCHASE_STATUS.Received);
    setOpen(true);
  }

  /**
   * Abre uma compra NOVA de reposição, já com produto, fornecedor e quantidade.
   *
   * É o destino do "Resolver" do relatório de estoque baixo: lá, resolver o
   * alerta é registrar o pedido. A situação nasce Pendente e tudo continua
   * editável — o formulário é o mesmo de sempre.
   */
  function openForRestock(dados: {
    productId: number;
    productName: string;
    productBarcode: string | null;
    supplierId: number | null;
    quantity: number;
  }) {
    setEditingId(null);
    setReadOnly(false);
    setForm({
      ...emptyPurchaseForm(),
      productId: dados.productId,
      productName: dados.productName,
      productBarcode: dados.productBarcode,
      supplierId: dados.supplierId ? String(dados.supplierId) : "",
      quantity: dados.quantity,
    });
    setOpen(true);
  }

  function update<K extends keyof PurchaseForm>(field: K, value: PurchaseForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  /** Vincula um produto já cadastrado: o nome passa a ser o do cadastro. */
  function selectProduct(product: ProductSearchOption) {
    setForm((current) => ({
      ...current,
      productId: product.id,
      productName: product.name,
      productBarcode: product.barcode,
    }));
  }

  /** Tira o vínculo e libera o nome para digitação (produto novo). */
  function clearProduct() {
    setForm((current) => ({ ...current, productId: null, productBarcode: null }));
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SavePurchasePayload) =>
      editingId ? updatePurchase(editingId, payload) : createPurchase(payload),
    onSuccess: async () => {
      await onSaved();
      setOpen(false);
      toast({ title: editingId ? "Compra atualizada" : "Compra registrada" });
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao salvar a compra",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      }),
  });

  function submit(event?: React.FormEvent) {
    event?.preventDefault();

    if (readOnly) return;

    const problem = validatePurchaseForm(form, supplier);
    if (problem) {
      toast({ title: "Atenção", description: problem, variant: "warning" });
      return;
    }

    saveMutation.mutate({
      supplierId: Number(form.supplierId),
      productId: form.productId,
      productName: form.productName.trim(),
      details: form.details.trim() || null,
      purchaseLink: form.purchaseLink.trim() || null,
      // Instante LOCAL sem fuso, como a entrada de estoque: a coluna é
      // `timestamp without time zone`, e `toISOString()` jogaria o dia para trás.
      purchaseDate: `${form.purchaseDate}T00:00:00`,
      quantity: form.quantity,
      grossTotal: form.grossTotal,
      finalTotal: form.finalTotal,
      suggestedPrice: form.suggestedPrice > 0 ? form.suggestedPrice : null,
      status: Number(form.status),
      imageIds: form.images.map((image) => image.imageId),
    });
  }

  return {
    open,
    setOpen,
    editingId,
    readOnly,
    form,
    supplier,
    linkRequired: purchaseLinkIsRequired(form, supplier),
    update,
    openNew,
    openEdit,
    openForRestock,
    selectProduct,
    clearProduct,
    // Fotos: quatro entradas (arquivo, colagem, URL e busca na web), todas pelo
    // mesmo funil de compressão e upload. Ver `usePurchaseImages`.
    ...images,
    submit,
    isSaving: saveMutation.isPending,
  };
}
