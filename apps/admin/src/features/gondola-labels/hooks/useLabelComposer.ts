import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PRODUCT_LABEL_TYPE,
  createProductLabelBatch,
  getGetProductLabelBatchesQueryKey,
  type ProductPdvSearchDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { useLabelProductSearch } from "./useLabelProductSearch";
import { describeApiError } from "@workspace/core";
import { printLabelSheet } from "../print";
import {
  customNameForPayload,
  draftToPrintable,
  formatPriceInput,
  labelTypeFromEnum,
  parsePriceInput,
  parseQuantityInput,
  printedNameOf,
  type LabelDraftItem,
  type PrintableLabel,
} from "../types";

/**
 * Orquestra a aba de geração de etiquetas: busca de produtos, montagem da
 * lista (nome, tipo, preço e quantidade por item) e o fluxo gravar → imprimir.
 *
 * Preço e nome de cada item nascem do cadastro mas são editáveis — é assim que
 * a etiqueta de promoção sai com o valor da oferta sem mexer no produto, e que
 * "COPO AMERICANO [ORIGINAL]" vira "COPO AMERICANO" na gôndola.
 *
 * **Imprimir não esvazia a tela.** O lote fica montado até alguém clicar em
 * Limpar (ou recarregar): quem imprime costuma reimprimir na hora — papel
 * torto, etiqueta faltando — e remontar a seleção era o pedágio disso.
 *
 * A busca de produtos é do {@link useLabelProductSearch}: a tela abre com a
 * lista vazia e consulta o balcão, com os mesmos gatilhos do PDV.
 */
export function useLabelComposer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productSearch = useLabelProductSearch();
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LabelDraftItem[]>([]);
  const [printing, setPrinting] = useState(false);

  const totalLabels = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, parseQuantityInput(item.quantityInput)), 0),
    [items],
  );
  const totalProducts = useMemo(() => new Set(items.map((item) => item.productId)).size, [items]);

  /** Etiquetas como serão impressas, para a pré-visualização em tela. */
  const previewLabels = useMemo<PrintableLabel[]>(() => items.map(draftToPrintable), [items]);

  /** Adiciona o produto com tipo Normal; se já estiver na lista com esse tipo, soma uma cópia. */
  const addProduct = (product: ProductPdvSearchDto) => {
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
          catalogName: product.name,
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
            i !== index && item.productId === target.productId && item.labelType === patch.labelType,
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

  const removeItem = (index: number) => setItems((current) => current.filter((_, i) => i !== index));

  /** Recomeça o lote do zero — é a única coisa que esvazia a tela, inclusive depois de imprimir. */
  const clearBatch = () => {
    setItems([]);
    setDescription("");
  };

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
        description: `"${printedNameOf(invalid)}" precisa de preço e quantidade maiores que zero.`,
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
          productName: customNameForPayload(item),
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

      // A lista fica na tela de propósito: a impressora engasga, o papel sai
      // torto, a pessoa quer conferir uma etiqueta antes de recortar — e
      // remontar a seleção do zero por causa disso era o que mais custava.
      // Limpar é escolha de quem opera, no botão Limpar.
      toast({
        title: "Lote de etiquetas gerado!",
        description: `${totalLabels} etiqueta(s) no lote, salvo no histórico. A lista continua aqui até você clicar em Limpar.`,
      });
    } catch (error) {
      console.error("Erro ao gerar lote de etiquetas:", error);
      toast({
        title: "Erro ao gerar etiquetas",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  };

  return {
    search: productSearch.search,
    setSearch: productSearch.setSearch,
    submitSearch: productSearch.submit,
    searchResults: productSearch.results,
    isSearching: productSearch.isSearching,
    hasSearched: productSearch.hasSearched,
    searchFailed: productSearch.hasFailed,
    description,
    setDescription,
    items,
    previewLabels,
    addProduct,
    updateItem,
    removeItem,
    clearBatch,
    totalLabels,
    totalProducts,
    printing,
    canGenerate,
    handleGenerate,
  };
}
