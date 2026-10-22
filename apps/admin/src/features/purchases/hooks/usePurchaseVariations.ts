import { useQuery } from "@tanstack/react-query";
import { GRADE_TYPE, PRODUCT_STATUS, enumCode } from "@workspace/api-client-react";
import { getProductsPage } from "@/services/products.service";
import { applyCostSplit, recomputeGrid, sumItems } from "../lib/purchase-items";
import { spreadRestockQuantity } from "../lib/spread-restock";
import { emptyNewRow, isNewBrandRow, nextNewBrandKey } from "../lib/new-brand";
import type { PurchaseForm, PurchaseFormItem } from "../types";

/** Nem inativa, nem rascunho: a variação que recebe parte da reposição do produto inteiro. */
function vendavel(status: Parameters<typeof enumCode>[0]): boolean {
  const codigo = enumCode(status, PRODUCT_STATUS);
  return codigo !== PRODUCT_STATUS.Inactive && codigo !== PRODUCT_STATUS.Draft;
}

/** Teto de variações que a grade carrega. Nenhum grupo do catálogo chega perto. */
const LIMITE_DE_VARIACOES = 200;

type VariationOption = {
  productId: number;
  name: string;
  barcode: string | null;
  stock: number;
  /** Nem inativa, nem rascunho — a que recebe parte da reposição do produto inteiro. */
  sellable: boolean;
  /** A marca da variação (grade Marca), quando ela tem. */
  brand: string | null;
  /** Tem grade que NÃO é Marca (Cor, Tamanho...)? Aí o produto não aceita marca nova. */
  hasOtherGrade: boolean;
  /** Preço de venda atual — o da reposição nasce com ele (`defaultSuggestedPrice`). */
  price: number;
};

type UsePurchaseVariationsParams = {
  form: PurchaseForm;
  setForm: React.Dispatch<React.SetStateAction<PurchaseForm>>;
  /**
   * O operador mexeu na grade — quantidade, fatia ou o modo do custo.
   *
   * Avisa quem guarda o "há algo para perder" do formulário. Só os GESTOS
   * chamam: a montagem da grade quando a lista de variações chega é
   * preenchimento automático, e marcar ali faria abrir uma compra já perguntar
   * se quer descartar na saída.
   */
  onEdit: () => void;
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
export function usePurchaseVariations({ form, setForm, onEdit }: UsePurchaseVariationsParams) {
  const groupId = form.productGroupId;

  const { data: page, isFetching } = useQuery({
    queryKey: ["purchase-variations", groupId],
    enabled: groupId !== null,
    queryFn: () => getProductsPage({ productGroupId: groupId as number, limit: LIMITE_DE_VARIACOES }),
  });

  /** As variações do grupo, na ordem em que a grade as mostra. */
  const variations: VariationOption[] = (page?.data ?? [])
    .map((produto) => {
      const grades = (produto.variationValues ?? []).map((valor) => ({
        tipo: enumCode(valor.gradeType, GRADE_TYPE),
        valor: valor.value,
      }));
      return {
        productId: produto.id,
        name: produto.displayName || produto.name,
        barcode: produto.barcode || null,
        stock: produto.stock,
        sellable: vendavel(produto.status),
        brand: grades.find((grade) => grade.tipo === GRADE_TYPE.Brand)?.valor ?? null,
        hasOtherGrade: grades.some((grade) => grade.tipo !== GRADE_TYPE.Brand),
        price: produto.price ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const hasNewBrand = form.items.some(isNewBrandRow);

  /**
   * A grade aparece com mais de uma variação — ou com marca nova, que num
   * produto simples transforma o campo de quantidade numa grade de duas linhas.
   */
  const hasGrid = variations.length > 1 || hasNewBrand;

  /**
   * "+ Nova variação (marca)" (fase 4): só em produto simples ou com variações
   * SÓ de Marca. Com Cor ou Tamanho, a variação nova teria uma grade só e o
   * produto ficaria inconsistente — o backend recusa do mesmo jeito.
   */
  const canAddBrand = groupId !== null && variations.length > 0 && variations.every((v) => !v.hasOtherGrade);

  // A grade nasce quando a lista de variações chega, como AJUSTE DURANTE O
  // RENDER — não num efeito. Num efeito seria preciso guardar "já montei esta"
  // para não remontar a cada render, e remontar apagaria a quantidade que o
  // operador acabou de digitar. Aqui a condição se desfaz sozinha: depois do
  // ajuste a grade cobre todas as variações e nada mais dispara.
  if (hasGrid && variations.length > 0 && !cobreTodas(form.items, variations)) {
    setForm((atual) => recomputeGrid(montarGrade(atual, variations)));
  }

  /**
   * Acrescenta uma linha sem cadastro: a marca nova ou, no produto novo com
   * variações (fase 5), mais uma variação. Em produto simples a grade ainda não
   * existe: ela nasce com o cadastro atual (a quantidade do campo) e a linha nova.
   */
  function addNewBrand() {
    onEdit();
    setForm((atual) => {
      const base = atual.items.length > 0 ? atual : montarGrade({ ...atual, items: [] }, variations);
      return recomputeGrid({ ...base, items: [...base.items, emptyNewRow(nextNewBrandKey(base.items), 1)] });
    });
  }

  function setNewBrand(productId: number, campo: "newBrand" | "newBarcode", valor: string) {
    onEdit();
    setForm((atual) => ({
      ...atual,
      items: atual.items.map((item) =>
        item.productId === productId
          ? { ...item, [campo]: campo === "newBrand" ? valor.toUpperCase() : valor }
          : item,
      ),
    }));
  }

  /**
   * Tira a linha de marca nova. Sem marca nova e com uma variação só, a grade
   * some e a quantidade volta ao campo — como era antes do clique.
   *
   * O produto volta ao cabeçalho: a compra GRAVADA com a marca nova tinha dois
   * itens, e o servidor só preenche o produto da compra com item único. Sem
   * isso, ela iria sem produto e viraria "produto ainda não cadastrado" — o
   * recebimento abriria um cadastro em branco, duplicando o que existe. Em
   * custo manual os totais eram a soma da grade, com a marca nova dentro: voltam
   * a ser a soma do que ficou.
   */
  function removeNewBrand(productId: number) {
    onEdit();
    setForm((atual) => {
      const items = atual.items.filter((item) => item.productId !== productId);
      if (variations.length <= 1 && !items.some(isNewBrandRow)) {
        const quantidade = items.reduce((soma, item) => soma + item.quantity, 0);
        const totais = atual.costSplitManual
          ? { grossTotal: sumItems(items, "grossTotal"), finalTotal: sumItems(items, "finalTotal") }
          : {};
        return {
          ...atual,
          ...totais,
          productId: items[0]?.productId ?? variations[0]?.productId ?? atual.productId,
          items: [],
          quantity: Math.max(quantidade, 1),
          costSplitManual: false,
        };
      }
      return recomputeGrid({ ...atual, items });
    });
  }

  function setItemQuantity(productId: number, quantity: number) {
    onEdit();
    setForm((atual) =>
      recomputeGrid({
        ...atual,
        items: atual.items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Number.isFinite(quantity) ? quantity : 0 }
            : item,
        ),
      }),
    );
  }

  /**
   * O custo de UMA variação, digitado em modo manual — em rateio a fatia é
   * derivada, e isto não tem efeito.
   *
   * O bruto da variação vai junto quando ela não tem desconto declarado — bruto
   * zerado, ou igual ao custo que está sendo trocado. É a regra do cabeçalho (o
   * final nasce igual ao bruto, 24/09/2026) aplicada à fatia. Sem isso, quem
   * passasse ao custo por variação antes de digitar os totais — ou reabrisse uma
   * compra de antes da regra, com o bruto zerado — ficava com o bruto do pedido
   * em zero sem ter como digitá-lo: em modo manual ele é a SOMA das variações,
   * sem campo, justamente quando passou a ser obrigatório fora de Pendente. A
   * fatia com desconto (bruto diferente do custo) mantém o bruto dela.
   */
  function setItemCost(productId: number, valor: number) {
    onEdit();
    setForm((atual) =>
      recomputeGrid({
        ...atual,
        items: atual.items.map((item) => {
          if (item.productId !== productId) return item;
          const semDesconto = item.grossTotal <= 0 || item.grossTotal === item.finalTotal;
          return { ...item, finalTotal: valor, ...(semDesconto ? { grossTotal: valor } : {}) };
        }),
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
    onEdit();
    setForm((atual) => {
      const comFatias = manual
        ? applyCostSplit(atual.items, atual.grossTotal, atual.finalTotal, false)
        : atual.items;
      return recomputeGrid({ ...atual, costSplitManual: manual, items: comFatias });
    });
  }

  /** Recalcula as fatias quando o operador mexe nos totais do pedido. */
  function refreshSplit(grossTotal: number, finalTotal: number) {
    onEdit();
    setForm((atual) => recomputeGrid({ ...atual, grossTotal, finalTotal }));
  }

  return {
    variations,
    hasGrid,
    canAddBrand,
    /** As marcas que o produto já tem — a linha nova não pode repetir nenhuma. */
    existingBrands: variations.flatMap((variacao) => (variacao.brand ? [variacao.brand] : [])),
    /** O preço atual de cada variação do grupo (vazio enquanto a lista não chega). */
    groupPrices: variations.map((variacao) => variacao.price),
    addNewBrand,
    setNewBrand,
    removeNewBrand,
    isLoadingVariations: isFetching,
    setItemQuantity,
    setItemCost,
    setCostSplitManual,
    refreshSplit,
  };
}

/** A grade já cobre exatamente estas variações? As linhas de marca nova não contam. */
function cobreTodas(items: PurchaseFormItem[], variations: VariationOption[]): boolean {
  const cadastradas = items.filter((item) => !isNewBrandRow(item));
  if (cadastradas.length !== variations.length) return false;
  const naGrade = new Set(cadastradas.map((item) => item.productId));
  return variations.every((variacao) => naGrade.has(variacao.productId));
}

/** A grade do grupo, preservando o que já foi digitado — e as linhas de marca nova, no fim. */
function montarGrade(atual: PurchaseForm, variations: VariationOption[]): PurchaseForm {
  const jaDigitado = new Map(atual.items.map((item) => [item.productId, item]));
  // A reposição do produto INTEIRO (linha de grupo do estoque baixo) se reparte
  // entre as variações, e só na primeira montagem.
  const repartida =
    atual.spreadQuantity && atual.items.length === 0
      ? spreadRestockQuantity(atual.quantity, variations)
      : null;

  const items: PurchaseFormItem[] = variations.map(
    ({ sellable: _vendavel, brand: _marca, hasOtherGrade: _outra, ...variacao }) => {
      const anterior = jaDigitado.get(variacao.productId);
      return {
        ...variacao,
        quantity:
          anterior?.quantity ??
          repartida?.get(variacao.productId) ??
          // A variação escolhida na busca nasce com a quantidade do campo: é a que
          // o operador já tinha em mente quando procurou o produto.
          (variacao.productId === atual.productId ? Math.max(atual.quantity, 1) : 0),
        grossTotal: anterior?.grossTotal ?? 0,
        finalTotal: anterior?.finalTotal ?? 0,
      };
    },
  );

  return { ...atual, items: [...items, ...atual.items.filter(isNewBrandRow)], spreadQuantity: false };
}
