import { createRef } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import type { LocalPromotion } from "@/offline";
import { usePdvStore } from "@/stores/use-pdv-store";
import { PdvSearchPanel } from "../pdv-search-panel";
import type { ProductSearchState } from "../../hooks/use-product-search";
import { renderWithHints } from "@/test/render-with-hints";

/**
 * A câmera é dublada no kit: o diálogo real liga a câmera do aparelho, e o que
 * importa aqui é QUANDO o botão aparece e o que ele entrega ao diálogo.
 */
const camera = vi.hoisted(() => ({
  canUseCamera: vi.fn(() => true),
  dialog: null as null | { open: boolean; onDetected: (code: string) => unknown },
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  canUseCamera: camera.canUseCamera,
  BarcodeScannerDialog: (props: { open: boolean; onDetected: (code: string) => unknown }) => {
    camera.dialog = props;
    return null;
  },
}));

const PRODUTO: ProductPdvSearchDto = {
  id: 7,
  name: "COCA-COLA 350ML",
  barcode: "7891000100103",
  price: 10,
  stock: 5,
  productGroupId: 3,
  imageUrl: null,
};

/** Relâmpago de preço final R$ 7,50 no grupo do produto, valendo agora. */
const RELAMPAGO: LocalPromotion = {
  id: 11,
  productGroupId: 3,
  productGroupIds: [3],
  comboQuantity: null,
  type: 2,
  discountType: 2,
  discountValue: 7.5,
  validFrom: "2000-01-01T00:00:00",
  validUntil: "2999-12-31T23:59:59",
  maxQuantityPerSale: 6,
};

/** Texto sem o espaço inquebrável que o `Intl` põe depois do "R$". */
function texto(elemento: HTMLElement): string {
  return (elemento.textContent ?? "").replace(/\u00a0/g, " ");
}

function makeSearch(overrides: Partial<ProductSearchState> = {}): ProductSearchState {
  return {
    query: "coca",
    setQuery: vi.fn(),
    results: [PRODUTO],
    notFound: false,
    isSearching: false,
    search: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

function renderPanel(search = makeSearch()) {
  const inputRef = createRef<HTMLInputElement>();
  const onPickProduct = vi.fn();
  renderWithHints(
    <PdvSearchPanel search={search} inputRef={inputRef} online onPickProduct={onPickProduct} />,
  );
  return { inputRef, onPickProduct, search };
}

describe("PdvSearchPanel", () => {
  afterEach(() => {
    usePdvStore.setState({
      promotions: [],
      salePromotions: null,
      promotionInstant: null,
      editingSaleId: null,
    });
  });

  it("devolve o cursor ao campo de busca depois de escolher um produto na lista", () => {
    // O card é uma div: o mousedown nela tirava o cursor do campo, e o próximo
    // bipe do leitor não entrava em lugar nenhum. Aqui o campo é tirado do foco
    // à mão, como o navegador faz, e o clique tem que trazê-lo de volta.
    const { inputRef, onPickProduct, search } = renderPanel();
    const input = inputRef.current!;
    input.focus();
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.click(screen.getByTestId("search-result"));

    expect(onPickProduct).toHaveBeenCalledWith(PRODUTO);
    expect(search.clear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });

  it("não deixa o mousedown no card tirar o cursor do campo", () => {
    // `fireEvent` devolve false quando o padrão do evento foi cancelado — e
    // cancelar o mousedown é o que impede o navegador de mover o foco.
    renderPanel();

    expect(fireEvent.mouseDown(screen.getByTestId("search-result"))).toBe(false);
  });

  it("amplia a foto do resultado sem adicionar o produto ao carrinho", async () => {
    // A miniatura de 48px não separa "...CONICA" de "...RETA"; a ampliação é a
    // mesma do carrinho. O clique nela tem que ficar na foto: se subisse até a
    // linha, tocar para conferir venderia o item.
    const { onPickProduct } = renderPanel(
      makeSearch({ results: [{ ...PRODUTO, imageUrl: "produtos/coca.png" }] }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Ampliar a foto/ }));

    await waitFor(() => expect(screen.getByAltText("COCA-COLA 350ML")).toBeTruthy());
    expect(onPickProduct).not.toHaveBeenCalled();
  });

  it("não adiciona nem limpa a busca ao clicar em produto sem estoque", () => {
    const { onPickProduct, search } = renderPanel(makeSearch({ results: [{ ...PRODUTO, stock: 0 }] }));

    fireEvent.click(screen.getByTestId("search-result"));

    expect(onPickProduct).not.toHaveBeenCalled();
    expect(search.clear).not.toHaveBeenCalled();
  });

  describe("preço promocional na lista (05/10/2026)", () => {
    it("mostra o promocional, o de tabela riscado e o selo do tipo com o limite", () => {
      usePdvStore.setState({ promotions: [RELAMPAGO] });
      renderPanel();

      const linha = texto(screen.getByTestId("search-result"));
      expect(linha).toContain("De R$ 10,00");
      expect(linha).toContain("por R$ 7,50");
      expect(linha).toContain("Relâmpago · até 6");
    });

    it("no combo, o preço normal continua o principal e a oferta vai no selo", () => {
      usePdvStore.setState({
        promotions: [
          { ...RELAMPAGO, type: 3, discountType: 3, discountValue: 20, comboQuantity: 3, productGroupId: 0 },
        ],
      });
      renderPanel();

      const linha = texto(screen.getByTestId("search-result"));
      expect(linha).toContain("R$ 10,00");
      expect(linha).toContain("3 por R$ 20,00");
      expect(linha).not.toContain("De ");
    });

    it("com venda em curso, anuncia o que o carrinho vai cobrar: a lista e o relógio congelados", () => {
      // A lista viva já não tem a relâmpago (acabou, ou foi encerrada no
      // admin), mas a venda começou com ela: o carrinho ainda a aplica, e a
      // busca não pode dizer o contrário.
      usePdvStore.setState({
        promotions: [],
        salePromotions: [{ ...RELAMPAGO, validUntil: "2026-10-11T18:00:00" }],
        promotionInstant: "2026-10-11T17:59:00",
      });
      renderPanel();

      expect(texto(screen.getByTestId("search-result"))).toContain("por R$ 7,50");
    });

    it("na reedição de uma venda, a busca não anuncia promoção — o carrinho não aplica", () => {
      usePdvStore.setState({ promotions: [RELAMPAGO], editingSaleId: 123 });
      renderPanel();

      const linha = texto(screen.getByTestId("search-result"));
      expect(linha).toContain("R$ 10,00");
      expect(linha).not.toContain("por R$ 7,50");
      expect(linha).not.toContain("Relâmpago");
    });

    it("sem promoção para o grupo, é o preço de tabela, sem selo", () => {
      usePdvStore.setState({ promotions: [{ ...RELAMPAGO, productGroupId: 99, productGroupIds: [99] }] });
      renderPanel();

      const linha = texto(screen.getByTestId("search-result"));
      expect(linha).toContain("R$ 10,00");
      expect(linha).not.toContain("Relâmpago");
    });
  });

  describe("no celular (compact)", () => {
    function renderPhone(onScanCode = vi.fn()) {
      const inputRef = createRef<HTMLInputElement>();
      const onPickProduct = vi.fn();
      renderWithHints(
        <PdvSearchPanel
          search={makeSearch()}
          inputRef={inputRef}
          online
          onPickProduct={onPickProduct}
          compact
          onScanCode={onScanCode}
        />,
      );
      return { inputRef, onPickProduct, onScanCode };
    }

    afterEach(() => {
      camera.canUseCamera.mockReturnValue(true);
      camera.dialog = null;
    });

    it("a câmera ao lado do campo abre o leitor, e cada código vai para quem soma no carrinho", async () => {
      const { onScanCode } = renderPhone();

      fireEvent.click(screen.getByRole("button", { name: "Ler o código de barras pela câmera" }));

      expect(camera.dialog?.open).toBe(true);
      await camera.dialog?.onDetected("7891000100103");
      expect(onScanCode).toHaveBeenCalledWith("7891000100103");
    });

    it("sem câmera utilizável (sem HTTPS ou sem permissão), nenhum botão que não funcionaria", () => {
      camera.canUseCamera.mockReturnValue(false);
      renderPhone();

      expect(screen.queryByRole("button", { name: /câmera/ })).toBeNull();
    });

    it("no balcão não há câmera: lá o leitor é o de mão", () => {
      renderPanel();

      expect(screen.queryByRole("button", { name: /câmera/ })).toBeNull();
    });

    it("escolher um produto fecha o teclado em vez de devolver o cursor", () => {
      const { inputRef, onPickProduct } = renderPhone();
      inputRef.current!.focus();

      fireEvent.click(screen.getByTestId("search-result"));

      expect(onPickProduct).toHaveBeenCalledWith(PRODUTO);
      expect(document.activeElement).not.toBe(inputRef.current);
    });
  });
});
