import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createProductLabelBatch,
  getGetProductLabelBatchesQueryKey,
  searchPdvProducts,
  type ProductPdvSearchDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { useLabelProductSearch } from "./useLabelProductSearch";
import { useLabelDraft } from "./useLabelDraft";
import { describeApiError, type ShelfPrice } from "@workspace/core";
import { useShelfPrice } from "@/hooks/use-shelf-price";
import { printLabelSheet } from "../print";
import { exactBarcodeMatches, scanToastOf, type BarcodeScanOutcome } from "../barcode-lookup";
import { toDraftPayload, type LoadedLabelDraft } from "../draft";
import {
  defaultLabelTypeOf,
  expectedLabelPrice,
  labelPromotionOf,
  withLabelPromotion,
  withLabelType,
} from "../promotion";
import {
  customNameForPayload,
  draftToPrintable,
  formatPriceInput,
  labelTypeFromEnum,
  parsePriceInput,
  parseQuantityInput,
  printedNameOf,
  type LabelDraftItem,
  type LabelPromotion,
  type PrintableLabel,
} from "../types";

/**
 * Orquestra a aba de geração de etiquetas: busca de produtos (digitada ou pela
 * câmera), montagem da lista (nome, tipo, preço e quantidade por item), o
 * rascunho salvo no servidor e o fluxo gravar → imprimir.
 *
 * Preço e nome de cada item nascem do cadastro mas são editáveis — é assim que
 * a etiqueta de promoção sai com o valor da oferta sem mexer no produto, e que
 * "COPO AMERICANO [ORIGINAL]" vira "COPO AMERICANO" na gôndola.
 *
 * **A lista se salva sozinha** (30/09/2026): ela é montada olhando a
 * prateleira, no celular, e impressa depois, no computador. Toda alteração feita
 * pela pessoa agenda a gravação ({@link useLabelDraft}); a remontagem vinda do
 * servidor não agenda nada. Enquanto o rascunho não foi lido, a lista não aceita
 * alteração — gravar antes sobrescreveria o rascunho com uma lista vazia.
 *
 * **Imprimir não esvazia a tela.** O lote fica montado até alguém clicar em
 * Limpar: quem imprime costuma reimprimir na hora — papel torto, etiqueta
 * faltando. Mas imprimir ENCERRA o rascunho no servidor: a lista impressa não
 * volta na próxima abertura.
 *
 * **Produto em promoção entra com o preço promocional** (05/10/2026): tipo
 * Promoção, o "De" e o selo, derivados da mesma lista de promoções da listagem
 * de produtos — ver `promotion.ts`.
 */
export function useLabelComposer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productSearch = useLabelProductSearch();
  const { shelfPriceOf } = useShelfPrice();

  /** A promoção que um produto leva para a etiqueta agora. */
  const promotionOf = useCallback(
    (productGroupId: number | null | undefined, price: number): LabelPromotion | null =>
      labelPromotionOf(shelfPriceOf(productGroupId, price)),
    [shelfPriceOf],
  );
  // O rascunho é lido uma vez, por um callback estável; a promoção que ele
  // aplica tem de ser a da lista MAIS RECENTE, e não a da montagem.
  const promotionOfRef = useRef(promotionOf);
  useEffect(() => {
    promotionOfRef.current = promotionOf;
  }, [promotionOf]);
  const [description, setDescriptionState] = useState("");
  const [items, setItems] = useState<LabelDraftItem[]>([]);
  const [printing, setPrinting] = useState(false);

  // Cada alteração feita pela pessoa avança a revisão; é ela, e não a mudança
  // da lista em si, que agenda a gravação — a remontagem vinda do servidor muda
  // a lista sem mexer na revisão.
  const [revision, setRevision] = useState(0);
  const scheduledRevisionRef = useRef(0);
  const touch = () => setRevision((current) => current + 1);

  const hydrate = useCallback((loaded: LoadedLabelDraft) => {
    setItems(
      loaded.items.map((item) =>
        withLabelPromotion(item, promotionOfRef.current(item.productGroupId, item.catalogPrice)),
      ),
    );
    setDescriptionState(loaded.description);
  }, []);

  // A lista de promoções chegou depois do rascunho, ou mudou (a relâmpago
  // começou com a tela aberta): cada item acompanha, sem agendar gravação — a
  // promoção é derivada e não vai para o rascunho. Ajuste DURANTE o render, o
  // padrão do React para estado que acompanha outro valor; num efeito a lista
  // seria desenhada uma vez com a promoção velha.
  const [promotionsSeen, setPromotionsSeen] = useState(() => promotionOf);
  if (promotionsSeen !== promotionOf) {
    setPromotionsSeen(() => promotionOf);
    setItems((current) =>
      current.map((item) => withLabelPromotion(item, promotionOf(item.productGroupId, item.catalogPrice))),
    );
  }
  const draft = useLabelDraft(hydrate);
  const { schedule } = draft;
  const canEdit = draft.loadState === "ready";

  useEffect(() => {
    if (revision === scheduledRevisionRef.current) return;
    scheduledRevisionRef.current = revision;
    schedule(toDraftPayload(items, description));
  }, [revision, items, description, schedule]);

  // A leitura pela câmera chega de forma assíncrona; o "já estava na lista?"
  // do aviso precisa da lista atual, não da que existia quando a câmera abriu.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const totalLabels = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, parseQuantityInput(item.quantityInput)), 0),
    [items],
  );
  const totalProducts = useMemo(() => new Set(items.map((item) => item.productId)).size, [items]);

  /** Etiquetas como serão impressas, para a pré-visualização em tela. */
  const previewLabels = useMemo<PrintableLabel[]>(() => items.map(draftToPrintable), [items]);

  const setDescription = (value: string) => {
    if (!canEdit) return;
    setDescriptionState(value);
    touch();
  };

  /**
   * Tipo com que o produto entra: Promoção quando há promoção valendo para ele,
   * Normal no resto.
   */
  const entryTypeOf = (product: ProductPdvSearchDto) =>
    defaultLabelTypeOf(promotionOf(product.productGroupId, product.price));

  /**
   * Adiciona o produto — com tipo Promoção e o preço promocional quando há
   * promoção valendo, Normal no resto; se já estiver na lista com esse tipo, soma
   * uma cópia.
   */
  const addProduct = (product: ProductPdvSearchDto) => {
    if (!canEdit) return;
    const promotion = promotionOf(product.productGroupId, product.price);
    const labelType = defaultLabelTypeOf(promotion);
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.productId === product.id && item.labelType === labelType,
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
          priceInput: formatPriceInput(
            expectedLabelPrice({ labelType, promotion, catalogPrice: product.price }),
          ),
          catalogPrice: product.price,
          labelType,
          quantityInput: "1",
          productGroupId: product.productGroupId ?? null,
          promotion,
        },
      ];
    });
    touch();
  };

  /**
   * O "+" de um resultado da busca: adiciona e esvazia o campo para a próxima
   * busca (pedido do dono, 07/10/2026). Antes o termo e a lista ficavam na tela,
   * e cada produto novo começava apagando o anterior à mão. A câmera não passa
   * por aqui — ela não usa o campo.
   */
  const addFromSearch = (product: ProductPdvSearchDto) => {
    if (!canEdit) return;
    addProduct(product);
    productSearch.clear();
  };

  /**
   * Adiciona pelo código lido na câmera, sem passar pela lista de resultados.
   *
   * Só entra sozinho o produto cujo código é EXATAMENTE o lido. Mais de um
   * produto com o mesmo código vai para a busca, e a escolha fica com a pessoa.
   */
  const addByBarcode = async (code: string): Promise<BarcodeScanOutcome> => {
    if (!canEdit) return { kind: "error", code };
    try {
      const matches = exactBarcodeMatches(await searchPdvProducts(code, 5), code);
      if (matches.length === 0) return { kind: "not-found", code };
      if (matches.length > 1) {
        productSearch.searchNow(code);
        // A câmera fecha sem vibrar; sem este aviso a pessoa só veria a busca
        // preenchida, sem saber por quê.
        toast({
          title: "Mais de um produto com este código",
          description: `Escolha na busca o produto do código ${code}.`,
        });
        return { kind: "ambiguous", code };
      }

      const product = matches[0];
      const existing = itemsRef.current.find(
        (item) => item.productId === product.id && item.labelType === entryTypeOf(product),
      );
      addProduct(product);
      const outcome: BarcodeScanOutcome = {
        kind: "added",
        name: product.name,
        copies: existing ? parseQuantityInput(existing.quantityInput) + 1 : 1,
      };
      // A câmera fecha a cada produto encontrado; o nome vai para o aviso da
      // tela, que é a conferência de que ela leu a etiqueta certa.
      toast({ title: "Adicionado pela câmera", description: scanToastOf(outcome) });
      return outcome;
    } catch (error) {
      console.error("Erro ao buscar o código lido:", error);
      return { kind: "error", code };
    }
  };

  /**
   * Atualiza um item da lista. A troca de tipo é recusada quando criaria o
   * mesmo produto duas vezes com o mesmo tipo — regra que o backend também
   * valida; para mais cópias existe a quantidade.
   */
  const updateItem = (index: number, patch: Partial<LabelDraftItem>) => {
    if (!canEdit) return;
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

      // Trocar o tipo leva o preço junto quando ele não foi editado: de Promoção
      // para Normal, o promocional dá lugar ao de tabela (`withLabelType`).
      return current.map((item, i) => {
        if (i !== index) return item;
        const { labelType, ...rest } = patch;
        const retipado = labelType !== undefined ? withLabelType(item, labelType) : item;
        return { ...retipado, ...rest };
      });
    });
    touch();
  };

  const removeItem = (index: number) => {
    if (!canEdit) return;
    setItems((current) => current.filter((_, i) => i !== index));
    touch();
  };

  /** Recomeça o lote do zero — esvazia a tela e apaga o rascunho salvo. */
  const clearBatch = () => {
    if (!canEdit) return;
    setItems([]);
    setDescriptionState("");
    touch();
  };

  const canGenerate = canEdit && items.length > 0 && !printing;

  /** Grava o lote no histórico e abre a impressão A4 com os valores congelados. */
  const handleGenerate = async () => {
    if (!canGenerate) return;

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
      // A gravação pendente sai ANTES da impressão: a geração apaga o
      // rascunho no servidor, e uma gravação atrasada o ressuscitaria. E se a
      // impressão falhar, o rascunho já está com a lista mais recente.
      const changeAtPrint = draft.beginPrint();
      await draft.flush();

      const batch = await createProductLabelBatch({
        description: description.trim() || null,
        items: items.map((item) => {
          // O "De" e o selo saem da mesma conta da prévia, e o backend os
          // congela para a reimpressão.
          const printable = draftToPrintable(item);
          return {
            productId: item.productId,
            labelType: item.labelType,
            price: parsePriceInput(item.priceInput),
            quantity: parseQuantityInput(item.quantityInput),
            productName: customNameForPayload(item),
            referencePrice: printable.referencePrice ?? null,
            promotionSeal: printable.promotionSeal ?? null,
          };
        }),
      });
      draft.markPrinted(changeAtPrint);

      // Imprime o que o backend congelou; se o body não vier, usa a lista local.
      const labels: PrintableLabel[] = batch
        ? batch.items.map((item) => ({
            productName: item.productName,
            barcode: item.barcode,
            price: item.price,
            labelType: labelTypeFromEnum(item.labelType),
            quantity: item.quantity,
            referencePrice: item.referencePrice ?? null,
            promotionSeal: item.promotionSeal ?? null,
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

  /** O preço de um resultado da busca, já com a promoção — o que a lista mostra. */
  const searchResultShelf = (product: ProductPdvSearchDto): ShelfPrice =>
    shelfPriceOf(product.productGroupId, product.price);

  return {
    searchResultShelf,
    search: productSearch.search,
    setSearch: productSearch.setSearch,
    submitSearch: productSearch.submit,
    clearSearch: productSearch.clear,
    searchResults: productSearch.results,
    isSearching: productSearch.isSearching,
    hasSearched: productSearch.hasSearched,
    searchFailed: productSearch.hasFailed,
    description,
    setDescription,
    items,
    previewLabels,
    addProduct,
    addFromSearch,
    addByBarcode,
    updateItem,
    removeItem,
    clearBatch,
    totalLabels,
    totalProducts,
    printing,
    canEdit,
    canGenerate,
    handleGenerate,
    draftLoadState: draft.loadState,
    draftSaveState: draft.saveState,
    draftSavedAt: draft.savedAt,
    retryDraftLoad: draft.retryLoad,
    retryDraftSave: draft.flush,
  };
}
