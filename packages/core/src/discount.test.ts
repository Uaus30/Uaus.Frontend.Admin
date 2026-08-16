import { describe, expect, it } from "vitest";
import { allocateCouponByItem, computeDiscount, computeSaleTotals } from "./discount";

describe("computeDiscount", () => {
  describe("desconto em valor", () => {
    it("devolve o próprio valor informado", () => {
      expect(computeDiscount({ base: 100, value: 15, type: "value" })).toEqual({ amount: 15 });
    });

    it("aceita desconto igual à base", () => {
      expect(computeDiscount({ base: 100, value: 100, type: "value" })).toEqual({ amount: 100 });
    });

    it("recusa desconto maior que a base", () => {
      expect(computeDiscount({ base: 100, value: 100.01, type: "value" })).toEqual({
        error: "excede-base",
      });
    });
  });

  describe("desconto em percentual", () => {
    it("converte o percentual para reais sobre a base", () => {
      expect(computeDiscount({ base: 200, value: 10, type: "percent" })).toEqual({ amount: 20 });
    });

    it("aceita 100%", () => {
      expect(computeDiscount({ base: 49.9, value: 100, type: "percent" })).toEqual({ amount: 49.9 });
    });

    it("recusa acima de 100%", () => {
      expect(computeDiscount({ base: 100, value: 100.5, type: "percent" })).toEqual({
        error: "excede-base",
      });
    });

    it("arredonda o resultado para duas casas", () => {
      // 33,33% de 10,05 = 3,349665 -> 3,35
      expect(computeDiscount({ base: 10.05, value: 33.33, type: "percent" })).toEqual({
        amount: 3.35,
      });
    });
  });

  describe("entradas inválidas", () => {
    it("recusa NaN", () => {
      expect(computeDiscount({ base: 100, value: NaN, type: "value" })).toEqual({
        error: "invalido",
      });
    });

    it("recusa negativo", () => {
      expect(computeDiscount({ base: 100, value: -1, type: "value" })).toEqual({
        error: "negativo",
      });
      expect(computeDiscount({ base: 100, value: -1, type: "percent" })).toEqual({
        error: "negativo",
      });
    });

    it("aceita zero como remoção do desconto", () => {
      expect(computeDiscount({ base: 100, value: 0, type: "value" })).toEqual({ amount: 0 });
    });

    it("recusa qualquer desconto sobre base zero, exceto zero", () => {
      expect(computeDiscount({ base: 0, value: 0, type: "value" })).toEqual({ amount: 0 });
      expect(computeDiscount({ base: 0, value: 1, type: "value" })).toEqual({
        error: "excede-base",
      });
    });
  });
});

describe("computeSaleTotals", () => {
  const doisItens = [
    { unitPrice: 10, quantity: 2, unitDiscount: 0 },
    { unitPrice: 5.5, quantity: 3, unitDiscount: 0 },
  ];

  it("soma os itens sem desconto nenhum", () => {
    const totais = computeSaleTotals({ items: doisItens });

    expect(totais.grossSubtotal).toBe(36.5);
    expect(totais.subtotal).toBe(36.5);
    expect(totais.total).toBe(36.5);
    expect(totais.discountTotal).toBe(0);
  });

  it("multiplica o desconto do item pela quantidade", () => {
    // O desconto do item é UNITÁRIO — 2 reais de desconto em 3 unidades tira 6.
    const totais = computeSaleTotals({
      items: [{ unitPrice: 10, quantity: 3, unitDiscount: 2 }],
    });

    expect(totais.grossSubtotal).toBe(30);
    expect(totais.itemDiscountTotal).toBe(6);
    expect(totais.subtotal).toBe(24);
    expect(totais.total).toBe(24);
  });

  it("aplica o desconto global sobre o subtotal já líquido dos itens", () => {
    const totais = computeSaleTotals({
      items: [{ unitPrice: 10, quantity: 2, unitDiscount: 1 }],
      globalDiscount: 5,
    });

    expect(totais.subtotal).toBe(18);
    expect(totais.globalDiscount).toBe(5);
    expect(totais.total).toBe(13);
  });

  it("aplica o cupom DEPOIS do desconto global", () => {
    // A ordem importa: item -> global -> cupom. Um cupom de 50% sobre 100 com
    // 20 de desconto global vale 40, não 50.
    const totais = computeSaleTotals({
      items: [{ unitPrice: 100, quantity: 1, unitDiscount: 0 }],
      globalDiscount: 20,
      couponDiscount: 40,
    });

    expect(totais.subtotal).toBe(100);
    expect(totais.globalDiscount).toBe(20);
    expect(totais.couponDiscount).toBe(40);
    expect(totais.discountTotal).toBe(60);
    expect(totais.total).toBe(40);
  });

  it("limita o desconto global ao subtotal", () => {
    const totais = computeSaleTotals({
      items: [{ unitPrice: 10, quantity: 1, unitDiscount: 0 }],
      globalDiscount: 50,
    });

    expect(totais.globalDiscount).toBe(10);
    expect(totais.total).toBe(0);
  });

  it("limita o cupom ao que sobrou depois do desconto global", () => {
    const totais = computeSaleTotals({
      items: [{ unitPrice: 100, quantity: 1, unitDiscount: 0 }],
      globalDiscount: 80,
      couponDiscount: 50,
    });

    expect(totais.couponDiscount).toBe(20);
    expect(totais.total).toBe(0);
  });

  it("nunca devolve total negativo", () => {
    const totais = computeSaleTotals({
      items: [{ unitPrice: 10, quantity: 1, unitDiscount: 0 }],
      globalDiscount: 999,
      couponDiscount: 999,
    });

    expect(totais.total).toBe(0);
    expect(totais.total).toBeGreaterThanOrEqual(0);
  });

  it("arredonda o centavo em vez de propagar o erro do ponto flutuante", () => {
    // 0,1 x 3 = 0,30000000000000004 em binário. Sem arredondar, o total do
    // carrinho não bate com o total gravado na venda.
    const totais = computeSaleTotals({
      items: [{ unitPrice: 0.1, quantity: 3, unitDiscount: 0 }],
    });

    expect(totais.subtotal).toBe(0.3);
    expect(totais.total).toBe(0.3);
  });

  it("arredonda cada etapa, não só o final", () => {
    const totais = computeSaleTotals({
      items: [{ unitPrice: 19.99, quantity: 3, unitDiscount: 0 }],
      globalDiscount: 0.005,
    });

    expect(totais.grossSubtotal).toBe(59.97);
    expect(Number.isInteger(totais.total * 100)).toBe(true);
  });

  it("aceita carrinho vazio", () => {
    const totais = computeSaleTotals({ items: [] });

    expect(totais.grossSubtotal).toBe(0);
    expect(totais.total).toBe(0);
  });

  it("ignora desconto global negativo em vez de aumentar o total", () => {
    // Defesa: desconto negativo viraria acréscimo silencioso na conta.
    const totais = computeSaleTotals({
      items: [{ unitPrice: 10, quantity: 1, unitDiscount: 0 }],
      globalDiscount: -5,
    });

    expect(totais.globalDiscount).toBe(0);
    expect(totais.total).toBe(10);
  });

  it("descontos discriminados somam o desconto total", () => {
    const totais = computeSaleTotals({
      items: [{ unitPrice: 50, quantity: 2, unitDiscount: 5 }],
      globalDiscount: 10,
      couponDiscount: 15,
    });

    expect(totais.itemDiscountTotal).toBe(10);
    expect(totais.discountTotal).toBe(35);
    expect(totais.grossSubtotal - totais.discountTotal).toBe(totais.total);
  });

  it("o total é sempre subtotal menos os descontos aplicados", () => {
    // Invariante do módulo: quem exibe e quem grava usam o MESMO número.
    const totais = computeSaleTotals({
      items: [
        { unitPrice: 12.35, quantity: 3, unitDiscount: 0.45 },
        { unitPrice: 7.9, quantity: 1, unitDiscount: 0 },
      ],
      globalDiscount: 3.33,
      couponDiscount: 1.11,
    });

    expect(totais.total).toBe(
      Math.round(
        (totais.subtotal - totais.globalDiscount - totais.couponDiscount) * 100,
      ) / 100,
    );
  });
});

describe("allocateCouponByItem", () => {
  /**
   * Itens de uma unidade, sem desconto de linha — o subtotal é o próprio preço.
   * O `productId` acompanha a posição porque é ele que decide o empate.
   */
  const itens = (...subtotais: number[]) =>
    subtotais.map((subtotal, indice) => ({
      productId: indice + 1,
      unitPrice: subtotal,
      quantity: 1,
      unitDiscount: 0,
    }));

  /** Soma em centavos INTEIROS: somar floats esconderia o centavo perdido. */
  const centavos = (parcelas: number[]) =>
    parcelas.reduce((total, parcela) => total + Math.round(parcela * 100), 0);

  it("devolve o resíduo POSITIVO ao item de maior subtotal", () => {
    // 10,00 sobre 33,33 / 33,33 / 33,34: três parcelas de 3,33 e 1 centavo sobrando.
    const parcelas = allocateCouponByItem(itens(33.33, 33.33, 33.34), 10);

    expect(parcelas).toEqual([3.33, 3.33, 3.34]);
    expect(centavos(parcelas)).toBe(1000);
  });

  it("devolve o resíduo NEGATIVO ao item de maior subtotal", () => {
    // 7,77 sobre 10 / 20 / 30: 1,30 + 2,59 + 3,89 dá 7,78 — um centavo a MAIS.
    const parcelas = allocateCouponByItem(itens(10, 20, 30), 7.77);

    expect(parcelas).toEqual([1.3, 2.59, 3.88]);
    expect(centavos(parcelas)).toBe(777);
  });

  it("no empate de subtotal o resíduo fica no MENOR productId", () => {
    // Sem regra de desempate, reordenar o carrinho mudaria o rateio da venda.
    expect(allocateCouponByItem(itens(10, 10, 10), 10)).toEqual([3.34, 3.33, 3.33]);
  });

  it("o empate é decidido pelo produto, NÃO pela posição na lista", () => {
    // Mesmo carrinho do caso anterior, com os produtos em ordem invertida: o
    // centavo tem que seguir o produto 1, que agora está na última posição.
    // Desempatar pelo primeiro da lista deixaria este teste vermelho — e é
    // exatamente a divergência que faria o rateio do PDV não bater com o gravado
    // pelo backend, que relê os itens do banco em outra ordem.
    const carrinho = [
      { productId: 3, unitPrice: 10, quantity: 1, unitDiscount: 0 },
      { productId: 2, unitPrice: 10, quantity: 1, unitDiscount: 0 },
      { productId: 1, unitPrice: 10, quantity: 1, unitDiscount: 0 },
    ];

    expect(allocateCouponByItem(carrinho, 10)).toEqual([3.33, 3.33, 3.34]);
  });

  it("devolve as parcelas na mesma ordem dos itens, e a ordem não muda o rateio", () => {
    // Mesmo carrinho do caso 10 / 20 / 30, embaralhado: as mesmas três parcelas.
    expect(allocateCouponByItem(itens(30, 10, 20), 7.77)).toEqual([3.88, 1.3, 2.59]);
  });

  it("dá o cupom inteiro ao item único", () => {
    expect(allocateCouponByItem(itens(50), 7.77)).toEqual([7.77]);
  });

  it("rateia pelo subtotal LÍQUIDO, não pelo preço de tabela", () => {
    // 10,00 x 2 com 5,00 de desconto unitário vale 10,00 — igual ao outro item.
    const carrinho = [
      { productId: 1, unitPrice: 10, quantity: 2, unitDiscount: 5 },
      { productId: 2, unitPrice: 10, quantity: 1, unitDiscount: 0 },
    ];

    expect(allocateCouponByItem(carrinho, 6)).toEqual([3, 3]);
  });

  it("zera as parcelas quando não há cupom", () => {
    expect(allocateCouponByItem(itens(10, 20), 0)).toEqual([0, 0]);
    expect(allocateCouponByItem(itens(10, 20), -5)).toEqual([0, 0]);
  });

  it("aceita lista vazia", () => {
    expect(allocateCouponByItem([], 10)).toEqual([]);
  });

  it("a soma das parcelas reproduz o cupom EXATAMENTE", () => {
    // Invariante que o banco confere: sum(sale_items.coupon_discount) tem que
    // dar sales.coupon_discount. É ela que quebra quando o resíduo é ignorado.
    const carrinho = itens(12.35, 7.9, 103.4, 0.99, 45.6);

    for (const cupom of [0.01, 1.11, 7.77, 10, 33.33, 99.99]) {
      expect(centavos(allocateCouponByItem(carrinho, cupom))).toBe(Math.round(cupom * 100));
    }
  });
});
