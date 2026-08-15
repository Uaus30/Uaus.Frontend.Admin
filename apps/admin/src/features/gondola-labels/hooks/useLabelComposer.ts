import { useMemo, useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PRODUCT_LABEL_TYPE,
  createProductLabelBatch,
  getGetProductLabelBatchesQueryKey,
  type ProductDto,
} from "@workspace/api-client-react";
import { getProductsPage } from "@/services/products.service";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { printLabelSheet } from "../print";
import {
  draftToPrintable,
  formatPriceInput,
  labelTypeFromEnum,
  parsePriceInput,
  parseQuantityInput,
  type LabelDraftItem,
  type PrintableLabel,
} from "../types";

/**
 * Orquestra a aba de geração de etiquetas: busca de produtos, montagem da
 * lista (tipo, preço e quantidade por item) e o fluxo gravar → imprimir.
 *
 * O preço de cada item nasce do cadastro mas é editável — é assim que a
 * etiqueta de promoção sai com o valor da oferta sem mexer no produto.
 */
export function useLabelComposer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LabelDraftItem[]>([]);
  const [printing, setPrinting] = useState(false);

  const { data: productPage, isLoading: isSearching } = useQuery({
    queryKey: ["gondola-labels-product-search", { search: debouncedSearch }],
    queryFn: () => getProductsPage({ search: debouncedSearch, page: 1, limit: 8 }),
  });

  const searchResults = productPage?.data ?? [];

  const totalLabels = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, parseQuantityInput(item.quantityInput)), 0),
    [items],
  );
  const totalProducts = useMemo(
    () => new Set(items.map((item) => item.productId)).size,
    [items],
  );

  /** Etiquetas como serão impressas, para a pré-visualização em tela. */
  const previewLabels = useMemo<PrintableLabel[]>(() => items.map(draftToPrintable), [items]);

  /** Adiciona o produto com tipo Normal; se já estiver na lista com esse tipo, soma uma cópia. */
  const addProduct = (product: ProductDto) => {
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.productId === product.id && item.labelType === PRODUCT_LABEL_TYPE.Normal,
      );

      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantityInput: String(Math.max(1, parseQuantityInput(item.quantityInput)) + 1) }
            : item,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode?.trim() ? product.barcode.trim() : null,
          priceInput: formatPriceInput(product.price),
          labelType: PRODUCT_LABEL_TYPE.Normal,
          quantityInput: "1",
        },
      ];
    });
  };

  /**
   * Atualiza um item da lista. A troca de tipo é recusada quando criaria o
   * mesmo produto duas vezes com o mesmo tipo — regra que o backend também
   * valida; para mais cópias existe a quantidade.
   */
  const updateItem = (index: number, patch: Partial<LabelDraftItem>) => {
    setItems((current) => {
      const target = current[index];
      if (!target) return current;

      if (patch.labelType !== undefined) {
        const conflict = current.some(
          (item, i) =>
            i !== index &&
            item.productId === target.productId &&
            item.labelType === patch.labelType,
        );

        if (conflict) {
          toast({
            title: "Produto já está no lote com esse tipo",
            description: "Para imprimir mais cópias, aumente a quantidade do item existente.",
            variant: "destructive",
          });
          return current;
        }
      }

      return current.map((item, i) => (i === index ? { ...item, ...patch } : item));
    });
  };

  const removeItem = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  const clearItems = () => setItems([]);

  const canGenerate = items.length > 0 && !printing;

  /** Grava o lote no histórico e abre a impressão A4 com os valores congelados. */
  const handleGenerate = async () => {
    if (items.length === 0) return;

    const invalid = items.find(
      (item) => parsePriceInput(item.priceInput) <= 0 || parseQuantityInput(item.quantityInput) < 1,
    );
    if (invalid) {
      toast({
        title: "Revise os itens do lote",
        description: `"${invalid.productName}" precisa de preço e quantidade maiores que zero.`,
        variant: "destructive",
      });
      return;
    }

    setPrinting(true);
    try {
      const batch = await createProductLabelBatch({
        description: description.trim() || null,
        items: items.map((item) => ({
          productId: item.productId,
          labelType: item.labelType,
          price: parsePriceInput(item.priceInput),
          quantity: parseQuantityInput(item.quantityInput),
        })),
      });

      // Imprime o que o backend congelou; se o body não vier, usa a lista local.
      const labels: PrintableLabel[] = batch
        ? batch.items.map((item) => ({
            productName: item.productName,
            barcode: item.barcode,
            price: item.price,
            labelType: labelTypeFromEnum(item.labelType),
            quantity: item.quantity,
          }))
        : items.map(draftToPrintable);

      await queryClient.invalidateQueries({ queryKey: getGetProductLabelBatchesQueryKey() });
      await printLabelSheet(labels);

      toast({
        title: "Lote de etiquetas gerado!",
        description: `${totalLabels} etiqueta(s) no lote. Ele ficou no histórico para reimpressão.`,
      });
      setItems([]);
      setDescription("");
    } catch (error) {
      console.error("Erro ao gerar lote de etiquetas:", error);
      toast({
        title: "Erro ao gerar etiquetas",
        description: describeApiError(error),
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  };

  return {
    search,
    setSearch,
    searchResults,
    isSearching,
    description,
    setDescription,
    items,
    previewLabels,
    addProduct,
    updateItem,
    removeItem,
    clearItems,
    totalLabels,
    totalProducts,
    printing,
    canGenerate,
    handleGenerate,
  };
}
