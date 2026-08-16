import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CouponLookupDto } from "@workspace/api-client-react";
import type { LocalCouponLookup } from "@/offline";

const mocks = vi.hoisted(() => ({
  lookupPdvCoupon: vi.fn(),
  lookupLocalCoupon: vi.fn(),
}));

// Só o que fala com a rede (e com o IndexedDB) é dublado. `ApiError`,
// `COUPON_DISCOUNT_TYPE` e `enumCode` vêm do módulo REAL: um enum redefinido no
// mock faria o teste concordar com um contrato que não existe.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  lookupPdvCoupon: mocks.lookupPdvCoupon,
}));

vi.mock("@/offline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/offline")>()),
  lookupLocalCoupon: mocks.lookupLocalCoupon,
}));

const { useCoupon } = await import("../use-coupon");
const { usePdvStore } = await import("@/stores/use-pdv-store");
const { useOfflineStore } = await import("@/stores/use-offline-store");
const { ApiError, COUPON_DISCOUNT_TYPE } = await import("@workspace/api-client-react");

/** Item de R$ 10,00, duas unidades: R$ 20,00 de subtotal. */
const ITEM = {
  id: "linha-1",
  productId: 7,
  name: "Coca-Cola 350ml",
  price: 10,
  quantity: 2,
  discount: 0,
  availableStock: 9,
};

/** Produto de R$ 30,00 que o operador bipa depois de já ter aplicado o cupom. */
const PRODUTO_30 = {
  productId: 9,
  name: "Vinho tinto",
  price: 30,
  quantity: 1,
  discount: 0,
  availableStock: 4,
};

/** Resposta do `GET /Pdv/coupons/{code}`: 10% e nenhuma pergunta. */
const LOOKUP_10: CouponLookupDto = {
  couponId: 7,
  code: "10OFFSET26",
  description: "Panfleto de setembro",
  // A API serializa o enum pelo NOME; `enumCode` é quem resolve.
  discountType: "Percentage",
  discountValue: 10,
  requiresAnswers: false,
  questions: [],
};

/** O mesmo cupom, com uma pergunta obrigatória de duas alternativas. */
const LOOKUP_COM_PERGUNTA: CouponLookupDto = {
  ...LOOKUP_10,
  requiresAnswers: true,
  questions: [
    {
      questionId: 3,
      label: "Como conheceu a loja?",
      isRequired: true,
      options: [
        { optionId: 21, label: "Panfleto" },
        { optionId: 22, label: "Instagram" },
      ],
    },
  ],
};

/** Cupom encontrado na base local, com um uso restante. */
const LOCAL_ENCONTRADO: LocalCouponLookup = {
  outcome: "found",
  coupon: {
    couponId: 7,
    code: "10OFFSET26",
    description: null,
    discountType: COUPON_DISCOUNT_TYPE.Percentage,
    discountValue: 10,
    validFrom: "2026-08-01T00:00:00",
    validUntil: null,
    remainingAtSnapshot: 1,
    questions: [],
  },
  remainingUses: 1,
  overLimit: false,
};

describe("useCoupon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePdvStore.setState({
      status: "SELLING",
      items: [ITEM],
      globalDiscount: 0,
      coupon: null,
      heldSales: [],
      editingSaleId: null,
    });
    useOfflineStore.setState({ online: true });
    mocks.lookupPdvCoupon.mockResolvedValue(LOOKUP_10);
    mocks.lookupLocalCoupon.mockResolvedValue(LOCAL_ENCONTRADO);
  });

  it("deve guardar a DEFINIÇÃO do cupom e derivar o abatimento do carrinho", async () => {
    const { result } = renderHook(() => useCoupon());

    await act(async () => {
      await result.current.lookup("10offset26");
    });
    act(() => {
      result.current.apply([]);
    });

    // O que fica gravado é o panfleto, nunca reais: nenhum campo de valor
    // calculado no cupom aplicado.
    expect(usePdvStore.getState().coupon).toEqual({
      couponId: 7,
      code: "10OFFSET26",
      description: "Panfleto de setembro",
      discountType: COUPON_DISCOUNT_TYPE.Percentage,
      discountValue: 10,
      answers: [],
    });
    expect(result.current.discount).toBe(2);
    expect(usePdvStore.getState().getTotal()).toBe(18);
  });

  it("deve reajustar o abatimento quando um item é bipado depois do cupom", async () => {
    const { result } = renderHook(() => useCoupon());

    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });
    act(() => {
      result.current.apply([]);
    });
    expect(result.current.discount).toBe(2);

    // O operador bipa mais um produto com o cupom já aplicado. Com o valor em
    // reais congelado no store, o desconto ficaria parado em R$ 2,00 e o total
    // da tela deixaria de bater com o que o servidor calcula.
    act(() => {
      usePdvStore.getState().addItem(PRODUTO_30);
    });

    expect(result.current.discount).toBe(5);
    expect(usePdvStore.getState().getTotal()).toBe(45);
  });

  it("deve calcular o percentual sobre o que resta depois do desconto global", async () => {
    usePdvStore.setState({ globalDiscount: 5 });
    const { result } = renderHook(() => useCoupon());

    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });
    act(() => {
      result.current.apply([]);
    });

    // 10% de R$ 15,00 (20,00 − 5,00), não de R$ 20,00.
    expect(result.current.discount).toBe(1.5);
  });

  it("deve exibir a mensagem que o servidor escreveu para o balcão", async () => {
    mocks.lookupPdvCoupon.mockRejectedValue(
      new ApiError("Cupom expirado em 30/09/2026 às 23:59!", 400, null),
    );

    const { result } = renderHook(() => useCoupon());
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });

    // Trocar por "erro ao consultar" obrigaria o operador a adivinhar o que
    // dizer ao cliente que está com o panfleto na mão.
    expect(result.current.refusal).toBe("Cupom expirado em 30/09/2026 às 23:59!");
    expect(result.current.found).toBeNull();
    expect(usePdvStore.getState().coupon).toBeNull();
  });

  it("deve consultar a base local quando não há conexão", async () => {
    useOfflineStore.setState({ online: false });

    const { result } = renderHook(() => useCoupon());
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });

    expect(mocks.lookupPdvCoupon).not.toHaveBeenCalled();
    expect(mocks.lookupLocalCoupon).toHaveBeenCalledWith("10OFFSET26");
    expect(result.current.found?.fromLocalDatabase).toBe(true);
    expect(result.current.found?.remainingUses).toBe(1);
  });

  it("deve cair para a base local quando a rede falha no meio da consulta", async () => {
    // Falha de rede não é recusa: o cliente está no balcão com o papel na mão, e
    // recusar um cupom válido por causa da internet da loja perderia a venda.
    mocks.lookupPdvCoupon.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useCoupon());
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });

    expect(mocks.lookupLocalCoupon).toHaveBeenCalled();
    expect(result.current.found?.couponId).toBe(7);
    expect(result.current.refusal).toBeNull();
  });

  it("deve recusar a aplicação com pergunta obrigatória sem resposta", async () => {
    mocks.lookupPdvCoupon.mockResolvedValue(LOOKUP_COM_PERGUNTA);

    const { result } = renderHook(() => useCoupon());
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });

    let applied = true;
    act(() => {
      applied = result.current.apply([]);
    });

    expect(applied).toBe(false);
    expect(result.current.refusal).toContain("Como conheceu a loja?");
    expect(usePdvStore.getState().coupon).toBeNull();

    act(() => {
      result.current.apply([{ questionId: 3, optionId: 21 }]);
    });

    expect(usePdvStore.getState().coupon?.answers).toEqual([{ questionId: 3, optionId: 21 }]);
  });

  it("deve tirar o cupom da venda sem tocar no carrinho", async () => {
    const { result } = renderHook(() => useCoupon());
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });
    act(() => {
      result.current.apply([]);
    });

    act(() => result.current.remove());

    expect(usePdvStore.getState().coupon).toBeNull();
    expect(usePdvStore.getState().getTotal()).toBe(20);
    expect(usePdvStore.getState().items).toHaveLength(1);
  });

  it("deve preservar o cupom ao pausar e retomar a venda", async () => {
    const { result } = renderHook(() => useCoupon());
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });
    act(() => {
      result.current.apply([]);
    });

    const held = usePdvStore.getState().holdSale();
    // O total guardado na fila já sai com o cupom aplicado.
    expect(held?.total).toBe(18);
    expect(usePdvStore.getState().coupon).toBeNull();

    act(() => {
      usePdvStore.getState().resumeHeldSale(held!.id);
    });

    // O cliente que volta para buscar outro produto não apresenta o panfleto de novo.
    expect(usePdvStore.getState().coupon?.code).toBe("10OFFSET26");
  });

  it("deve retomar sem quebrar uma venda pausada antes do cupom existir", () => {
    // As vendas em espera vivem no localStorage e sobrevivem ao deploy: as
    // antigas voltam sem o campo, e `undefined` não é estado válido do store.
    const antiga = {
      id: "velha",
      heldAt: "2026-08-14T10:00:00",
      items: [ITEM],
      globalDiscount: 0,
      consumer: { customerId: null, name: "", document: "" },
      total: 20,
    };
    usePdvStore.setState({ heldSales: [antiga], items: [], coupon: null });

    act(() => {
      usePdvStore.getState().resumeHeldSale("velha");
    });

    expect(usePdvStore.getState().coupon).toBeNull();
    expect(usePdvStore.getState().getTotal()).toBe(20);
  });

  it("deve limpar o cupom ao finalizar e ao cancelar a venda", async () => {
    const { result } = renderHook(() => useCoupon());

    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });
    act(() => {
      result.current.apply([]);
    });
    act(() => usePdvStore.getState().finishSale());

    // Deixá-lo de pé daria o desconto de graça ao próximo cliente e queimaria um
    // segundo uso do panfleto.
    expect(usePdvStore.getState().coupon).toBeNull();

    usePdvStore.setState({ items: [ITEM] });
    await act(async () => {
      await result.current.lookup("10OFFSET26");
    });
    act(() => {
      result.current.apply([]);
    });
    act(() => usePdvStore.getState().cancelSale());

    expect(usePdvStore.getState().coupon).toBeNull();
  });
});
