import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  createProductLabelBatch: vi.fn(),
  searchPdvProducts: vi.fn(),
  getProductLabelDraft: vi.fn(),
  saveProductLabelDraft: vi.fn(),
  printLabelSheet: vi.fn(),
  toast: vi.fn(),
  useGetCurrentPromotions: vi.fn(),
}));

// Só o que fala com a rede é dublado — enums, chaves de cache e helpers puros
// vêm do módulo real, para o teste bater contra o contrato de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createProductLabelBatch: mocks.createProductLabelBatch,
  searchPdvProducts: mocks.searchPdvProducts,
  getProductLabelDraft: mocks.getProductLabelDraft,
  saveProductLabelDraft: mocks.saveProductLabelDraft,
  useGetCurrentPromotions: mocks.useGetCurrentPromotions,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../../print", () => ({
  printLabelSheet: mocks.printLabelSheet,
}));

const { useLabelComposer } = await import("../useLabelComposer");

/** Sem promoção nenhuma. Referência ÚNICA: o React Query devolve dado estável. */
const SEM_PROMOCOES = { data: [] };

/** Relâmpago de R$ 9,90 no grupo 41, das 08:00 às 18:00 de 11/10/2026. */
const RELAMPAGO_ATE_AS_18H = {
  data: [
    {
      id: 8,
      productGroupId: 41,
      productGroupIds: [41],
      type: "Flash",
      discountType: "FinalPrice",
      discountValue: 9.9,
      validFrom: "2026-10-11T08:00:00",
      validUntil: "2026-10-11T18:00:00",
    },
  ],
};

/** Relâmpago de R$ 9,90 no grupo 41, valendo o dia todo de qualquer dia. */
const RELAMPAGO_NO_GRUPO_41 = {
  data: [
    {
      id: 7,
      productGroupId: 41,
      productGroupIds: [41],
      type: "Flash",
      discountType: "FinalPrice",
      discountValue: 9.9,
      validFrom: "2000-01-01T00:00:00",
      validUntil: "2999-12-31T23:59:59",
    },
  ],
};

/** Produto devolvido pela busca do balcão; só os campos que o hook usa. */
function product(id: number, patch?: Partial<ProductPdvSearchDto>): ProductPdvSearchDto {
  return {
    id,
    name: `Produto ${id}`,
    barcode: `789000000000${id}`,
    price: 12.5,
    stock: 5,
    ...patch,
  } as ProductPdvSearchDto;
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/**
 * Monta o hook e espera o rascunho ser lido: antes disso a lista não aceita
 * alteração (gravar antes sobrescreveria o rascunho salvo).
 */
async function renderComposer() {
  const rendered = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });
  await waitFor(() => expect(rendered.result.current.canEdit).toBe(true));
  return rendered;
}

describe("useLabelComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetCurrentPromotions.mockReturnValue(SEM_PROMOCOES);
    mocks.getProductLabelDraft.mockResolvedValue(null);
    mocks.saveProductLabelDraft.mockResolvedValue(undefined);
    mocks.searchPdvProducts.mockResolvedValue([]);
    mocks.printLabelSheet.mockResolvedValue(undefined);
    mocks.createProductLabelBatch.mockResolvedValue({
      id: 1,
      createdAt: "2026-08-07T10:00:00",
      updatedAt: null,
      description: null,
      userId: 3,
      userName: "Ana",
      totalProducts: 1,
      totalLabels: 2,
      items: [
        {
          id: 10,
          productId: 5,
          productName: "CANECA",
          barcode: "7891234567895",
          price: 9.99,
          labelType: "Promotion",
          labelTypeName: "Promoção",
          quantity: 2,
        },
      ],
    });
  });

  it("abre sem buscar nada — a lista de produtos nasce vazia", async () => {
    const { result } = await renderComposer();

    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.hasSearched).toBe(false);
  });

  it("adiciona o produto com tipo Normal e preço do cadastro", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5, { price: 12.5 })));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      productId: 5,
      labelType: 1,
      priceInput: "12,50",
      quantityInput: "1",
    });
    expect(result.current.totalLabels).toBe(1);
  });

  it("soma uma cópia ao adicionar o mesmo produto de novo no tipo Normal", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.addProduct(product(5)));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantityInput).toBe("2");
    expect(result.current.totalLabels).toBe(2);
  });

  it("permite o mesmo produto com tipos diferentes, mas bloqueia tipo repetido", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.updateItem(0, { labelType: 2 }));
    act(() => result.current.addProduct(product(5)));

    expect(result.current.items).toHaveLength(2);

    // Tentar transformar a linha Normal em Promoção repetiria o par produto+tipo.
    act(() => result.current.updateItem(1, { labelType: 2 }));

    expect(result.current.items[1].labelType).toBe(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("barra a geração quando algum item tem preço ou quantidade inválidos", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.updateItem(0, { priceInput: "0" }));

    await act(async () => result.current.handleGenerate());

    expect(mocks.createProductLabelBatch).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("gera o lote com os valores digitados e imprime o que o backend congelou", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.updateItem(0, { labelType: 2, priceInput: "9,99", quantityInput: "2" }));
    act(() => result.current.setDescription("Promoção da semana"));

    await act(async () => result.current.handleGenerate());

    expect(mocks.createProductLabelBatch).toHaveBeenCalledWith({
      description: "Promoção da semana",
      items: [
        {
          productId: 5,
          labelType: 2,
          price: 9.99,
          quantity: 2,
          productName: null,
          referencePrice: null,
          promotionSeal: null,
        },
      ],
    });

    expect(mocks.printLabelSheet).toHaveBeenCalledWith([
      {
        productName: "CANECA",
        barcode: "7891234567895",
        price: 9.99,
        labelType: 2,
        quantity: 2,
        referencePrice: null,
        promotionSeal: null,
      },
    ]);
  });

  describe("produto em promoção (05/10/2026)", () => {
    beforeEach(() => {
      mocks.useGetCurrentPromotions.mockReturnValue(RELAMPAGO_NO_GRUPO_41);
    });

    it("entra como Promoção, com o preço promocional, o De e o selo na prévia", async () => {
      const { result } = await renderComposer();

      act(() => result.current.addProduct(product(5, { price: 12.5, productGroupId: 41 })));

      expect(result.current.items[0]).toMatchObject({ labelType: 2, priceInput: "9,90" });
      expect(result.current.previewLabels[0]).toMatchObject({
        price: 9.9,
        referencePrice: 12.5,
        promotionSeal: "Relâmpago",
      });
    });

    it("trocar para Normal volta ao preço de tabela, sem De nem selo — e de volta", async () => {
      // A Normal é o caminho para imprimir a etiqueta que fica na gôndola depois
      // do sábado sem desligar a relâmpago.
      const { result } = await renderComposer();
      act(() => result.current.addProduct(product(5, { price: 12.5, productGroupId: 41 })));

      act(() => result.current.updateItem(0, { labelType: 1 }));
      expect(result.current.items[0].priceInput).toBe("12,50");
      expect(result.current.previewLabels[0]).toMatchObject({ referencePrice: null, promotionSeal: null });

      act(() => result.current.updateItem(0, { labelType: 2 }));
      expect(result.current.items[0].priceInput).toBe("9,90");
    });

    it("o preço digitado à mão não é trocado pela troca de tipo", async () => {
      const { result } = await renderComposer();
      act(() => result.current.addProduct(product(5, { price: 12.5, productGroupId: 41 })));
      act(() => result.current.updateItem(0, { priceInput: "8,00" }));

      act(() => result.current.updateItem(0, { labelType: 3 }));

      expect(result.current.items[0].priceInput).toBe("8,00");
      expect(result.current.previewLabels[0]).toMatchObject({ price: 8, referencePrice: 12.5 });
    });

    it("gera o lote com o De e o selo, para o backend congelar", async () => {
      const { result } = await renderComposer();
      act(() => result.current.addProduct(product(5, { price: 12.5, productGroupId: 41 })));

      await act(async () => result.current.handleGenerate());

      expect(mocks.createProductLabelBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [expect.objectContaining({ price: 9.9, referencePrice: 12.5, promotionSeal: "Relâmpago" })],
        }),
      );
    });

    it("a etiqueta montada durante a relâmpago volta ao preço de tabela quando ela acaba", async () => {
      // Achado da revisão: montada às 17h e impressa às 18h30, ela saía com o
      // preço da relâmpago — a lista do dia não muda às 18h, e nada reavaliava.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.setSystemTime(new Date(2026, 9, 11, 17, 59, 30));
        mocks.useGetCurrentPromotions.mockReturnValue(RELAMPAGO_ATE_AS_18H);
        const { result } = await renderComposer();

        act(() => result.current.addProduct(product(5, { price: 12.5, productGroupId: 41 })));
        expect(result.current.previewLabels[0]).toMatchObject({ price: 9.9, promotionSeal: "Relâmpago" });

        await act(async () => {
          vi.advanceTimersByTime(31_000 + 100);
        });

        expect(result.current.items[0].priceInput).toBe("12,50");
        expect(result.current.previewLabels[0]).toMatchObject({
          price: 12.5,
          referencePrice: null,
          promotionSeal: null,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("reabre o rascunho com o preço promocional no item que segue o cadastro", async () => {
      mocks.getProductLabelDraft.mockResolvedValue({
        description: null,
        items: [
          {
            productId: 5,
            productGroupId: 41,
            labelType: "Promotion",
            quantity: 1,
            catalogName: "CANECA",
            catalogPrice: 12.5,
          },
        ],
      });

      const { result } = await renderComposer();

      await waitFor(() => expect(result.current.items).toHaveLength(1));
      expect(result.current.items[0].priceInput).toBe("9,90");
      expect(result.current.previewLabels[0]).toMatchObject({ referencePrice: 12.5 });
    });
  });

  it("mantém o lote na tela depois de imprimir, para reimprimir sem remontar", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.setDescription("Promoção da semana"));

    await act(async () => result.current.handleGenerate());

    await waitFor(() => expect(mocks.printLabelSheet).toHaveBeenCalled());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.description).toBe("Promoção da semana");

    // Esvaziar é decisão de quem opera — e leva a identificação junto.
    act(() => result.current.clearBatch());

    expect(result.current.items).toHaveLength(0);
    expect(result.current.description).toBe("");
  });

  it("manda o nome encurtado quando o operador renomeia a etiqueta", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5, { name: "COPO AMERICANO [ORIGINAL]" })));
    act(() => result.current.updateItem(0, { productName: "COPO AMERICANO" }));

    expect(result.current.previewLabels[0].productName).toBe("COPO AMERICANO");

    await act(async () => result.current.handleGenerate());

    expect(mocks.createProductLabelBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ productName: "COPO AMERICANO" })],
      }),
    );
  });

  it("nome apagado volta para o do cadastro, na prévia e no envio", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5, { name: "COPO AMERICANO [ORIGINAL]" })));
    act(() => result.current.updateItem(0, { productName: "   " }));

    expect(result.current.previewLabels[0].productName).toBe("COPO AMERICANO [ORIGINAL]");

    await act(async () => result.current.handleGenerate());

    // Nulo, e não o texto da busca: para variação, o nome composto é do backend.
    expect(mocks.createProductLabelBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ productName: null })],
      }),
    );
  });
});
