import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ProductImageSearchModal } from "../ProductImageSearchModal";
import * as imagesService from "@/services/images.service";

vi.mock("@/services/images.service", () => ({
  searchInternetImages: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
  buildImageProxyUrl: vi.fn((url: string) => `/Images/proxy?url=${encodeURIComponent(url)}`),
}));

vi.mock("@workspace/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/ui")>();
  return {
    ...actual,
    useToast: () => ({ toast: vi.fn() }),
  };
});

describe("ProductImageSearchModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renderiza o modal com o nome limpo no input de busca e código no cabeçalho", async () => {
    vi.mocked(imagesService.searchInternetImages).mockResolvedValueOnce([
      {
        imageUrl: "https://example.com/rodo.jpg",
        thumbnailUrl: "https://example.com/rodo-thumb.jpg",
        title: "Rodo de Pia Sanremo",
      },
    ]);

    render(
      <ProductImageSearchModal
        isOpen={true}
        productName="RODINHO DE PIA"
        barcode="0986333180612"
        onOpenChange={vi.fn()}
        onSelectImage={vi.fn()}
      />,
    );

    expect(screen.getByText("Buscar imagem na internet")).toBeTruthy();
    expect(screen.getByText("· cód. 0986333180612")).toBeTruthy();

    const input = screen.getByPlaceholderText("Digite o nome ou código de barras para pesquisar...") as HTMLInputElement;
    expect(input.value).toBe("RODINHO DE PIA");

    await waitFor(() => {
      expect(imagesService.searchInternetImages).toHaveBeenCalledWith("RODINHO DE PIA 0986333180612", 6);
    });

    await waitFor(() => {
      expect(screen.getByAltText("Rodo de Pia Sanremo")).toBeTruthy();
    });
  });

  it("permite submeter uma nova pesquisa personalizada pelo input", async () => {
    vi.mocked(imagesService.searchInternetImages)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          imageUrl: "https://example.com/sal.jpg",
          thumbnailUrl: "https://example.com/sal-thumb.jpg",
          title: "Sal Refinado Cisne 1kg",
        },
      ]);

    render(
      <ProductImageSearchModal
        isOpen={true}
        productName="SAL"
        onOpenChange={vi.fn()}
        onSelectImage={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Digite o nome ou código de barras para pesquisar...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "SAL REFINADO" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(imagesService.searchInternetImages).toHaveBeenCalledWith("SAL REFINADO", 6);
    });

    await waitFor(() => {
      expect(screen.getByAltText("Sal Refinado Cisne 1kg")).toBeTruthy();
    });
  });

  it("chama onSelectImage e fecha o modal ao clicar em uma imagem", async () => {
    const onSelectImage = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    vi.mocked(imagesService.searchInternetImages).mockResolvedValueOnce([
      {
        imageUrl: "https://example.com/rodo.jpg",
        thumbnailUrl: "https://example.com/rodo-thumb.jpg",
        title: "Rodo de Pia Sanremo",
      },
    ]);

    render(
      <ProductImageSearchModal
        isOpen={true}
        productName="RODINHO DE PIA"
        onOpenChange={onOpenChange}
        onSelectImage={onSelectImage}
      />,
    );

    const img = await screen.findByAltText("Rodo de Pia Sanremo");
    fireEvent.click(img.parentElement!);

    await waitFor(() => {
      expect(onSelectImage).toHaveBeenCalledWith("https://example.com/rodo.jpg");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("getSearchFallbacks gera alternativas válidas para diminutivos, ruídos de ERP e código de barras", async () => {
    const { getSearchFallbacks } = await import("@/features/products/lib/searchFallbacks");

    const rodinho = getSearchFallbacks("RODINHO DE PIA 0986333180612");
    expect(rodinho).toContain("RODINHO DE PIA 0986333180612");
    expect(rodinho).toContain("RODINHO DE PIA");
    expect(rodinho).toContain("RODO DE PIA");

    const farmax = getSearchFallbacks("PF.FARMAX ACETONA AZUL 100ML UN");
    expect(farmax).toContain("PF.FARMAX ACETONA AZUL 100ML UN");
    expect(farmax).toContain("FARMAX ACETONA AZUL 100ML");

    const presilha = getSearchFallbacks("GRAMPOS DE CABELO ESTRELA prisilia");
    expect(presilha).toContain("GRAMPOS DE CABELO ESTRELA prisilia");
    expect(presilha).toContain("GRAMPOS DE CABELO ESTRELA presilha");
  });
});
