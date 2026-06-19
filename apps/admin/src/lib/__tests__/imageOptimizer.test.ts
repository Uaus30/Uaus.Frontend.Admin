import { optimizeImage } from "../imageOptimizer";
import { vi, describe, it, expect } from "vitest";

describe("imageOptimizer", () => {
  it("deve pular otimização se o arquivo não for uma imagem", async () => {
    const file = new File(["dummy content"], "documento.pdf", { type: "application/pdf" });
    const result = await optimizeImage(file);
    expect(result.optimized).toBe(false);
    expect(result.file).toBe(file);
  });

  it("deve pular otimização se o arquivo for um GIF animado", async () => {
    const file = new File(["dummy content"], "animacao.gif", { type: "image/gif" });
    const result = await optimizeImage(file);
    expect(result.optimized).toBe(false);
    expect(result.file).toBe(file);
  });

  it("deve pular otimização se o tamanho do arquivo for menor que o limite (minSizeToCompress)", async () => {
    const file = new File([new ArrayBuffer(100 * 1024)], "foto-pequena.jpg", { type: "image/jpeg" });
    const result = await optimizeImage(file, { minSizeToCompress: 200 * 1024 });
    expect(result.optimized).toBe(false);
    expect(result.file).toBe(file);
  });

  it("deve pular otimização se o canvas não for suportado no ambiente", async () => {
    const file = new File([new ArrayBuffer(300 * 1024)], "foto.jpg", { type: "image/jpeg" });
    
    // Simular ambiente sem suporte a canvas
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tag) => {
      if (tag === "canvas") {
        return { getContext: () => null };
      }
      return originalCreateElement(tag);
    }) as any;

    const result = await optimizeImage(file, { minSizeToCompress: 200 * 1024 });
    expect(result.optimized).toBe(false);
    expect(result.file).toBe(file);

    document.createElement = originalCreateElement;
  });

  it("deve realizar a otimização com sucesso quando atendidas as condições", async () => {
    const originalFile = new File([new ArrayBuffer(300 * 1024)], "foto.png", { type: "image/png" });

    // Mock das URLs de objetos
    const createObjectURLMock = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Mock do Canvas
    const mockContext = {
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toBlob: vi.fn().mockImplementation((callback) => {
        const mockBlob = new Blob([new ArrayBuffer(150 * 1024)], { type: "image/jpeg" });
        callback(mockBlob);
      }),
    };

    const originalCreateElement = document.createElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") return mockCanvas as any;
      return originalCreateElement.call(document, tagName);
    });

    // Mock do construtor de Image
    class MockImage {
      naturalWidth = 2000;
      naturalHeight = 2000;
      onload: any = null;
      private _src = "";

      get src() {
        return this._src;
      }

      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    const originalImage = global.Image;
    global.Image = MockImage as any;

    const result = await optimizeImage(originalFile, {
      maxWidth: 1000,
      maxHeight: 1000,
      minSizeToCompress: 200 * 1024,
    });

    expect(result.optimized).toBe(true);
    expect(result.originalSize).toBe(300 * 1024);
    expect(result.optimizedSize).toBe(150 * 1024);
    expect(result.file.name).toBe("foto.jpg"); // png convertido para jpg
    expect(result.file.type).toBe("image/jpeg");
    expect(mockCanvas.width).toBe(1000); // Proporção 2000x2000 reduzida para 1000x1000
    expect(mockCanvas.height).toBe(1000);

    // Restaurar mocks
    createObjectURLMock.mockRestore();
    revokeObjectURLMock.mockRestore();
    createElementSpy.mockRestore();
    global.Image = originalImage;
  });
});
