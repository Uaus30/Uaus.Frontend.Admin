import { useQuery } from "@tanstack/react-query";
import { getProductsPage } from "@/services/products.service";
import { applyCostSplit, sumItems } from "../lib/purchase-items";
import type { PurchaseForm, PurchaseFormItem } from "../types";

/** Teto de variações que a grade carrega. Nenhum grupo do catálogo chega perto. */
const LIMITE_DE_VARIACOES = 200;

type VariationOption = { productId: number; name: string; barcode: string | null; stock: number };

type UsePurchaseVariationsParams = {
  form: PurchaseForm;
  setForm: React.Dispatch<React.SetStateAction<PurchaseForm>>;
};

/**
 * A grade de variações da compra.
 *
 * Comprar uma camiseta em três cores eram TRÊS compras até 12/09/2026 —
 * fornecedor, data, link e fotos digitados três vezes, o total rateado de
 * cabeça, três recebimentos. Agora é uma compra com uma grade.
 *
 * ## Três regras que não são óbvias
 *
 * **A grade mostra todas as variações do grupo, não só as compradas.** É ela que
 * responde "o que existe para eu escolher"; quantidade zero é "não comprei
 * esta", e o backend descarta a linha. Por isso a grade da tela e os itens
 * gravados não têm o mesmo tamanho.
 *
 * **Exatamente um lado do custo é digitado.** Em rateio (o padrão) o operador
 * digita os totais do PEDIDO e a fatia de cada variação é derivada; em manual é
 * o inverso, e o cabeçalho vira a soma. Com os dois digitados a tela se
 * contradiz — dois números para a mesma pergunta, e nenhum erro que explique.
 *
 * **Produto SIMPLES não tem grade.** A quantidade continua sendo um campo só,
 * que é o caso da esmagadora maioria das compras e não podia ficar mais
 * trabalhoso para atender ao caso raro.
 */
export function usePurchaseVariations({ form, setForm }: UsePurchaseVariationsParams) {
  const groupId = form.productGroupId;

  const { data: page, isFetching } = useQuery({
    queryKey: ["purchase-variations", groupId],
    enabled: groupId !== null,
    queryFn: () => getProductsPage({ productGroupId: groupId as number, limit: LIMITE_DE_VARIACOES }),
  });

  /** As variações do grupo, na ordem em que a grade as mostra. */
  const variations: VariationOption[] = (page?.data ?? [])
    .map((produto) => ({
      productId: produto.id,
      name: produto.displayName || produto.name,
      barcode: produto.barcode || null,
      stock: produto.stock,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  /** O grupo tem mais de uma variação — é o que decide se a grade aparece. */
  const hasGrid = variations.length > 1;

  // A grade nasce quando a lista de variações chega, como AJUSTE DURANTE O
  // RENDER — não num efeito. Num efeito seria preciso guardar "já montei esta"
  // para não remontar a cada render, e remontar apagaria a quantidade que o
  // operador acabou de digitar. Aqui a condição se desfaz sozinha: depois do
  // ajuste a grade cobre todas as variações e nada mais dispara.
  if (hasGrid && !cobreTodas(form.items, variations)) {
    setForm((atual) => recompute(montarGrade(atual, variations)));
  }

  function setItemQuantity(productId: number, quantity: number) {
    setForm((atual) =>
      recompute({
        ...atual,
        items: atual.items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Number.isFinite(quantity) ? quantity : 0 }
            : item,
        ),
      }),
    );
  }

  /** Só tem efeito em modo manual — em rateio a fatia é derivada. */
  function setItemTotal(productId: number, campo: "grossTotal" | "finalTotal", valor: number) {
    setForm((atual) =>
      recompute({
        ...atual,
        items: atual.items.map((item) => (item.productId === productId ? { ...item, [campo]: valor } : item)),
      }),
    );
  }

  /**
   * Troca quem é a fonte da verdade do custo.
   *
   * Ligar o manual PARTE das fatias que o rateio já calculou, em vez de zerar: o
   * caso real é "quase tudo igual, menos o GG", e zerar obrigaria a redigitar o
   * que já estava certo. Desligar recalcula tudo — por isso a tela avisa antes.
   */
  function setCostSplitManual(manual: boolean) {
    setForm((atual) => {
      const comFatias = manual
        ? applyCostSplit(atual.items, atual.grossTotal, atual.finalTotal, false)
        : atual.items;
      return recompute({ ...atual, costSplitManual: manual, items: comFatias });
    });
  }

  /** Recalcula as fatias quando o operador mexe nos totais do pedido. */
  function refreshSplit(grossTotal: number, finalTotal: number) {
    setForm((atual) => recompute({ ...atual, grossTotal, finalTotal }));
  }

  return {
    variations,
    hasGrid,
    isLoadingVariations: isFetching,
    setItemQuantity,
    setItemTotal,
    setCostSplitManual,
    refreshSplit,
  };
}

/** A grade já cobre exatamente estas variações? */
function cobreTodas(items: PurchaseFormItem[], variations: VariationOption[]): boolean {
  if (items.length !== variations.length) return false;
  const naGrade = new Set(items.map((item) => item.productId));
  return variations.every((variacao) => naGrade.has(variacao.productId));
}

/** A grade do grupo, preservando o que já foi digitado. */
function montarGrade(atual: PurchaseForm, variations: VariationOption[]): PurchaseForm {
  const jaDigitado = new Map(atual.items.map((item) => [item.productId, item]));

  const items: PurchaseFormItem[] = variations.map((variacao) => {
    const anterior = jaDigitado.get(variacao.productId);
    return {
      ...variacao,
      quantity:
        anterior?.quantity ??
        // A variação escolhida na busca nasce com a quantidade do campo: é a que
        // o operador já tinha em mente quando procurou o produto.
        (variacao.productId === atual.productId ? Math.max(atual.quantity, 1) : 0),
      grossTotal: anterior?.grossTotal ?? 0,
      finalTotal: anterior?.finalTotal ?? 0,
    };
  });

  return { ...atual, items };
}

/**
 * Deixa cabeçalho e grade coerentes depois de qualquer edição.
 *
 * A quantidade do cabeçalho é SEMPRE a soma da grade. Os totais dependem do
 * modo: em manual eles são a soma dos itens; em rateio continuam sendo o que foi
 * digitado, e quem muda são as fatias.
 */
function recompute(atual: PurchaseForm): PurchaseForm {
  if (atual.items.length === 0) return atual;

  if (atual.costSplitManual) {
    return {
      ...atual,
      quantity: sumItems(atual.items, "quantity"),
      grossTotal: sumItems(atual.items, "grossTotal"),
      finalTotal: sumItems(atual.items, "finalTotal"),
    };
  }

  return {
    ...atual,
    quantity: sumItems(atual.items, "quantity"),
    items: applyCostSplit(atual.items, atual.grossTotal, atual.finalTotal, false),
  };
}
