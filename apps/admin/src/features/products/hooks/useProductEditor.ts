import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProductsPage } from "@/services/products.service";

import { buildProductCollections } from "@/services/mappers";
import {
  GRADE_TYPE,
  buildPublicImageUrl,
  enumCode,
  getGetPurchasesQueryKey,
  markPurchaseReceived,
  type GradeTypeCode,
  type ProductVariationValueDto,
  type PurchaseDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError, suggestedPrice } from "@workspace/core";
import type {
  LocalImage,
  ProductGroupForm,
  ProductEditorForm,
  ProductGrade,
  PurchaseContext,
  VariationDraft,
} from "../types";
import { createEmptyProductEditor } from "./editor/utils";
import { gradesDasVariacoes, temVariacaoSalva } from "../lib/variationGrades";

import { useBarcodeLookup } from "./editor/useBarcodeLookup";
import { useProductForm } from "./editor/useProductForm";
import { useProductVariations } from "./editor/useProductVariations";
import { useProductImages } from "./editor/useProductImages";
import { useProductSubmit } from "./editor/useProductSubmit";
import { CATALOG_KEYS, RESOURCE_KEYS, useAllImages, useAllProductImages } from "@/hooks/use-catalog";

export function useProductEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [detailOpen, setDetailOpen] = useState(false);
  /** A compra que originou este cadastro, quando ele veio de `?compra=`. Ver `openDetailFromPurchase`. */
  const [purchaseContext, setPurchaseContext] = useState<PurchaseContext | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [loadedGroupId, setLoadedGroupId] = useState<number | null>(null);
  const [activeVariationKey, setActiveVariationKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Há alterações não salvas na tela aberta.
   *
   * É o que alimenta o aviso ao sair (`beforeunload`, confirmação ao fechar e a
   * intercepção do voltar do navegador). Sujam o formulário só os setters
   * ENVIADOS à tela; o carregamento e o salvar usam os setters crus.
   */
  const [dirty, setDirty] = useState(false);
  /** Espelho de `detailOpen` legível dentro de handlers, sem esperar efeito. */
  const detailOpenRef = useRef(false);

  const [images, setImages] = useState<LocalImage[]>([]);
  const [form, setForm] = useState<ProductGroupForm>({
    departmentId: "",
    categoryId: "",
    productGroupName: "",
    description: "",
    hasVariations: false,
    isPublic: true,
  });
  const [productEditor, setProductEditor] = useState<ProductEditorForm>(createEmptyProductEditor());
  const [variationDrafts, setVariationDrafts] = useState<VariationDraft[]>([]);
  /**
   * Grades deste produto e os valores de cada uma, DERIVADOS das variações.
   *
   * Não é estado nem catálogo: as variações já carregam os valores, venham da
   * matriz recém-gerada ou do servidor. Guardar à parte exigiria um efeito para
   * sincronizar ao abrir um produto salvo — e a tabela mostraria as colunas de
   * grade só depois de um render a mais.
   */
  const selectedGrades = useMemo(() => gradesDasVariacoes(variationDrafts), [variationDrafts]);

  useEffect(() => {
    detailOpenRef.current = detailOpen;
  }, [detailOpen]);

  /** Marca a tela como alterada. Ignorado se o detalhe nem está aberto. */
  function markDirty() {
    if (detailOpenRef.current) setDirty(true);
  }

  /** Limpa a marcação — usado ao abrir um produto e após salvar. */
  function markClean() {
    setDirty(false);
  }

  const productForm = useProductForm({
    form,
    setForm,
    productEditor,
    setProductEditor,
    setEditingGroupId,
    setLoadedGroupId,
    setActiveVariationKey,
    setVariationDrafts,
    setImages,
  });

  const {
    data: groupProductsPage,
    isFetching: isFetchingGroupProducts,
    refetch: refetchGroupProducts,
  } = useQuery({
    queryKey: ["products-by-group", editingGroupId],
    enabled: detailOpen && editingGroupId != null && form.hasVariations,
    queryFn: () =>
      getProductsPage({
        productGroupId: editingGroupId ?? undefined,
        page: 1,
        limit: 200,
      }),
  });

  const { data: imagesCatalog = [] } = useAllImages();

  const { data: productImagesAll = [] } = useAllProductImages();

  /**
   * Código de barras já cadastrado carrega o produto existente na tela.
   *
   * Só em cadastro NOVO: na edição o operador já escolheu o produto, e trocá-lo
   * no meio da digitação jogaria fora o que ele preencheu. `openDetail` é
   * declaração de função, então já existe aqui — a chamada abaixo é hoisted.
   */
  const { lookupBarcode } = useBarcodeLookup({
    podeCarregar: detailOpen && editingGroupId === null,
    carregarProduto: openDetail,
    productGroups: productForm.productGroups,
    categories: productForm.categories,
    departments: productForm.departments,
    tags: productForm.tags,
    productTags: productForm.productTags,
    images: imagesCatalog,
    productImages: productImagesAll,
  });

  const enrichedGroupProducts = useMemo(() => {
    const groupProducts = groupProductsPage?.data ?? [];
    return buildProductCollections({
      products: groupProducts,
      productGroups: productForm.productGroups,
      categories: productForm.categories,
      departments: productForm.departments,
      tags: productForm.tags,
      productTags: productForm.productTags,
      images: imagesCatalog,
      productImages: productImagesAll,
    }).enrichedProducts;
  }, [
    productForm.categories,
    productForm.departments,
    groupProductsPage?.data,
    imagesCatalog,
    productForm.productGroups,
    productImagesAll,
    productForm.productTags,
    productForm.tags,
  ]);

  /**
   * Invalida tudo que reflete um produto salvo, excluído ou reordenado.
   *
   * `RESOURCE_KEYS.products` é o que alcança a TABELA. Desde o item 4.1 ela é uma
   * query só, registrada como `["products","table", params]`; a chave
   * `["product-groups-page"]`, que a listagem em cascata usava, deixou de existir
   * e foi retirada daqui. Invalidar a chave errada não quebra nada visível —
   * compila, roda, e a tela mostra o preço antigo depois de salvar.
   *
   * `["products-by-group", id]` continua na lista porque é a query da TELA DE
   * DETALHE (a lista de variações), não da tabela.
   */
  async function invalidateProductQueries(groupId?: number | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
      queryClient.invalidateQueries({ queryKey: ["products-page"] }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productGroups }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productTags }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productImages }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.images }),
      queryClient.invalidateQueries({ queryKey: ["products-by-group", groupId ?? editingGroupId] }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.tags }),
      queryClient.invalidateQueries({ queryKey: ["product-group-history", groupId ?? editingGroupId] }),
    ]);
  }

  const productVariations = useProductVariations({
    form,
    setForm,
    productEditor,
    variationDrafts,
    setVariationDrafts,
    activeVariationKey,
    setActiveVariationKey,
    defaultStatus: productForm.defaultStatus,
    editingGroupId,
    invalidateProductQueries,
    refetchGroupProducts,
  });

  /**
   * `updateVariationDraft` que suja o formulário. Envolver aqui, e não lá dentro,
   * mantém TODO o critério de sujeira neste hook — inclusive para as imagens da
   * variação, que chegam por ele via `useProductImages`.
   */
  function updateVariationDraft(key: string, updater: (draft: VariationDraft) => VariationDraft) {
    markDirty();
    productVariations.updateVariationDraft(key, updater);
  }

  const productImagesHook = useProductImages({
    setImages,
    activeVariation: productVariations.activeVariation,
    updateVariationDraft,
  });

  const productSubmit = useProductSubmit({
    form,
    editingGroupId,
    setEditingGroupId,
    productEditor,
    setProductEditor,
    variationDrafts,
    setVariationDrafts,
    images,
    setImages,
    setActiveVariationKey,
    setSaving,
    invalidateProductQueries,
    refetchGroupProducts,
    productTags: productForm.productTags,
    productImages: productImagesAll,
    getStatusNumber: productForm.getStatusNumber,
    markClean,
  });

  function toVariationDraft(product: any): VariationDraft {
    return {
      key: `product-${product.id}`,
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock || 0,
      minStock: product.minStock || 0,
      status: productForm.getStatusIdAsString(product.status),
      tagIds: product.tags.map((tag: any) => tag.id),
      barcode: product.barcode || "",
      // O servidor devolve os valores de grade já na ordem de exibição.
      values: (product.variationValues ?? []).map((value: ProductVariationValueDto) => ({
        gradeType: enumCode(value.gradeType, GRADE_TYPE) as GradeTypeCode,
        value: value.value,
      })),
      images: productImagesHook.toLocalImages(product.images),
      canDelete: product.canDelete,
    };
  }

  function openDetail(product?: any) {
    setDirty(false);
    if (product) {
      setEditingGroupId(product.productGroup?.id ?? product.productGroupId);
      setForm({
        departmentId: product.department?.id.toString() ?? "",
        categoryId: product.category?.id.toString() ?? "",
        productGroupName: product.productGroup?.name ?? "",
        description: product.productGroup?.description || "",
        hasVariations: product.productGroup?.hasVariations ?? false,
        isPublic: product.productGroup?.showOnSite ?? true,
      });

      if (product.productGroup?.hasVariations) {
        const draft = toVariationDraft(product);
        setVariationDrafts([draft]);
        setActiveVariationKey(draft.key);
        setProductEditor(createEmptyProductEditor(productForm.defaultStatus));
        setImages([]);
      } else {
        setProductEditor({
          id: product.id,
          name: product.name,
          description: product.description || "",
          price: product.price,
          stock: product.stock || 0,
          minStock: product.minStock || 0,
          status: productForm.getStatusIdAsString(product.status),
          tagIds: product.tags.map((tag: any) => tag.id),
          barcode: product.barcode || "",
        });
        setImages(productImagesHook.toLocalImages(product.images));
        setVariationDrafts([]);
        setActiveVariationKey(null);
      }
    } else {
      productForm.resetForm();
    }
    setDetailOpen(true);
  }

  /**
   * Abre o cadastro de produto NOVO preenchido por uma compra.
   *
   * É o segundo caminho do "Lançar recebimento" (`features/purchases`): a compra
   * de algo que ainda não existe no cadastro traz nome, detalhes, fotos e o
   * custo — e o operador completa código de barras, departamento, categoria e
   * variações. O preço nasce sugerido a 40% sobre o custo unitário FINAL, pela
   * mesma regra da entrada (`suggestedPrice`); é sugestão, não imposição.
   *
   * As fotos entram como imagens JÁ enviadas (`imageId`): são as mesmas do
   * catálogo de imagens, e o salvar só cria a associação — sem novo upload.
   * O contexto da compra fica guardado para a aba Estoque abrir a entrada
   * preenchida e, gravada, fechar a compra.
   */
  function openDetailFromPurchase(purchase: PurchaseDto) {
    setDirty(false);
    productForm.resetForm();
    setForm({
      departmentId: "",
      categoryId: "",
      productGroupName: purchase.productName,
      description: purchase.details ?? "",
      hasVariations: false,
      isPublic: true,
    });
    setProductEditor({
      ...createEmptyProductEditor(productForm.defaultStatus),
      name: purchase.productName,
      price: suggestedPrice(purchase.unitFinal) ?? 0,
    });
    setImages(
      purchase.images.map((image) => ({
        imageId: image.imageId,
        name: purchase.productName,
        url: buildPublicImageUrl(image.url),
      })),
    );
    setPurchaseContext({
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
      quantity: purchase.quantity,
      unitCost: purchase.unitFinal,
      productName: purchase.productName,
    });
    setDetailOpen(true);
  }

  /**
   * Fecha a compra que originou o cadastro, depois que a entrada foi gravada.
   *
   * Chamado pela aba Estoque com o id da entrada. Sem contexto de compra não
   * faz nada — é o caminho normal de todo cadastro que não veio de compra.
   */
  async function completePurchaseReceipt(productId: number, purchaseEntryId: number) {
    if (!purchaseContext) return;

    try {
      await markPurchaseReceived(purchaseContext.purchaseId, { productId, purchaseEntryId });
      await queryClient.invalidateQueries({ queryKey: getGetPurchasesQueryKey() });
      toast({
        title: "Compra lançada",
        description: `A compra de ${purchaseContext.productName} passou a Lançado, vinculada a este produto.`,
      });
      setPurchaseContext(null);
    } catch (error) {
      toast({
        title: "Entrada gravada, mas a compra não foi fechada",
        description: describeApiError(error, "Feche a compra pela tela de Compras."),
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    if (!detailOpen) return;
    setProductEditor((current) =>
      current.status ? current : { ...current, status: productForm.defaultStatus },
    );
  }, [productForm.defaultStatus, detailOpen]);

  useEffect(() => {
    if (!detailOpen || !form.hasVariations) return;
    setVariationDrafts((current) => {
      if (current.length > 0) return current;
      const draft: VariationDraft = {
        ...createEmptyProductEditor(productForm.defaultStatus),
        key: `temp-${Math.random().toString(36).substring(2, 9)}`,
        name: form.productGroupName.trim(),
        images: [],
        canDelete: true,
        values: [],
      };
      setActiveVariationKey(draft.key);
      return [draft];
    });
  }, [productForm.defaultStatus, form.hasVariations, form.productGroupName, detailOpen]);

  useEffect(() => {
    if (
      !detailOpen ||
      !form.hasVariations ||
      !editingGroupId ||
      enrichedGroupProducts.length === 0 ||
      loadedGroupId === editingGroupId
    ) {
      return;
    }

    const drafts = enrichedGroupProducts.map(toVariationDraft);
    setVariationDrafts(drafts);
    setActiveVariationKey((current) => current ?? drafts[0]?.key ?? null);
    setLoadedGroupId(editingGroupId);
  }, [editingGroupId, enrichedGroupProducts, form.hasVariations, detailOpen, loadedGroupId]);

  return {
    detailOpen,
    setDetailOpen,
    isDirty: dirty,
    form,
    setForm: (update: React.SetStateAction<ProductGroupForm>) => {
      markDirty();
      setForm(update);
    },
    productEditor,
    setProductEditor: (update: React.SetStateAction<ProductEditorForm>) => {
      markDirty();
      setProductEditor(update);
    },
    variationDrafts,
    activeVariationKey,
    setActiveVariationKey,
    activeVariation: productVariations.activeVariation,
    images,
    setImages: (update: React.SetStateAction<LocalImage[]>) => {
      markDirty();
      setImages(update);
    },

    /**
     * A galeria da aba **Dados**, já apontada para o alvo certo: a VARIAÇÃO
     * ATIVA quando o grupo tem variações, o produto simples quando não tem.
     *
     * ## Por que a escolha mora aqui, e não na tela
     *
     * Porque errá-la não gera erro. Até 06/09/2026 a galeria estava fixa em
     * `images` — o estado do produto SIMPLES — mesmo em grupo com variações. E
     * o `handleSubmit`, no ramo com variações, só percorre `variationDrafts`:
     * a imagem que o operador acabara de anexar não era gravada em lugar
     * nenhum, o toast dizia "Grupo e variações salvos" e no F5 seguinte
     * `openDetail` fazia `setImages([])` e a foto sumia. Nenhum erro em lugar
     * nenhum — só a foto que não estava lá.
     *
     * Com a decisão dentro do hook, a tela não tem como escolher errado: existe
     * UMA galeria e ela já vem ligada no alvo que o `handleSubmit` persiste.
     *
     * As imagens são POR VARIAÇÃO, e não do grupo: no banco de dev, 62 dos 76
     * grupos com variações e com foto têm fotos DIFERENTES em cada variação
     * (toalha por cor, forma por tamanho). Aplicar uma galeria única ao grupo
     * inteiro apagaria justamente essas.
     */
    galleryImages: form.hasVariations ? (productVariations.activeVariation?.images ?? []) : images,
    setGalleryImages: (update: React.SetStateAction<LocalImage[]>) => {
      markDirty();
      if (form.hasVariations) return productImagesHook.setVariationImages(update);
      setImages(update);
    },
    handleGalleryFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => {
      markDirty();
      return form.hasVariations
        ? productImagesHook.handleVariationFileSelection(event)
        : productImagesHook.handleSimpleFileSelection(event);
    },
    reorderGalleryImage: (oldIndex: number, newIndex: number) => {
      markDirty();
      if (form.hasVariations) return productImagesHook.reorderVariationImage(oldIndex, newIndex);
      productImagesHook.reorderProductImage(oldIndex, newIndex);
    },
    saving,
    departments: productForm.departments,
    categories: productForm.categories,
    filteredCategories: productForm.filteredCategories,
    tags: productForm.tags,
    statusOptions: productForm.statusOptions,
    selectableStatusOptions: productForm.selectableStatusOptions,
    isFetchingGroupProducts,
    editingGroupId,
    openDetail,
    openDetailFromPurchase,
    purchaseContext,
    completePurchaseReceipt,
    lookupBarcode,
    resetForm: () => {
      // Fechar a tela descarta o contexto da compra: um cadastro aberto depois
      // pela lista não pode herdar a entrada de um pedido que não é dele.
      setPurchaseContext(null);
      productForm.resetForm();
    },
    registerTag: productForm.registerTag,
    updateVariationDraft,

    moveProductImage: (index: number, direction: -1 | 1) => {
      markDirty();
      productImagesHook.moveProductImage(index, direction);
    },
    reorderProductImage: (oldIndex: number, newIndex: number) => {
      markDirty();
      productImagesHook.reorderProductImage(oldIndex, newIndex);
    },
    handleSimpleFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => {
      markDirty();
      return productImagesHook.handleSimpleFileSelection(event);
    },
    handleVariationFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => {
      markDirty();
      return productImagesHook.handleVariationFileSelection(event);
    },
    toggleHasVariations: (checked: boolean) => {
      markDirty();
      productForm.toggleHasVariations(checked);
    },
    addVariationDraft: (initialValues?: Partial<VariationDraft>) => {
      markDirty();
      productVariations.addVariationDraft(initialValues);
    },
    handleDeleteVariation: (draft: VariationDraft) => {
      markDirty();
      return productVariations.handleDeleteVariation(draft);
    },
    handleDeleteProductGroup: productForm.handleDeleteProductGroup,
    handleSubmit: productSubmit.handleSubmit,
    toLocalImages: productImagesHook.toLocalImages,
    selectedGrades,
    /**
     * Produto já cadastrado: a modal de grades vira gerenciadora de COLUNA e
     * para de gerar matriz. A tela precisa do mesmo critério do hook para
     * mostrar a modal certa, por isso ele sai daqui em vez de ser recalculado
     * lá — dois critérios diferentes deixariam a modal prometendo uma coisa e o
     * botão fazendo outra.
     */
    hasSavedVariations: temVariacaoSalva(variationDrafts),
    applyGrades: (grades: ProductGrade[]) => {
      markDirty();
      return productVariations.applyGrades(grades);
    },
    changeGradeType: (de: GradeTypeCode, para: GradeTypeCode) => {
      markDirty();
      productVariations.changeGradeType(de, para);
    },
  };
}
