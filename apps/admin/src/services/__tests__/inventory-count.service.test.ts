import { beforeEach, describe, expect, it, vi } from "vitest";

const downloadInventoryCountSheet = vi.fn();
const previewInventoryCount = vi.fn();
const applyInventoryCount = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  downloadInventoryCountSheet: (...args: unknown[]) => downloadInventoryCountSheet(...args),
  previewInventoryCount: (...args: unknown[]) => previewInventoryCount(...args),
  applyInventoryCount: (...args: unknown[]) => applyInventoryCount(...args),
}));

const {
  canApplyInventoryCount,
  exportInventorySheet,
  validateInventoryFile,
} = await import("../inventory-count.service");

/** Arquivo falso com nome e tamanho controlados. */
function fakeFile(name: string, size = 10): File {
  return { name, size } as File;
}

/** Resultado de contagem mínimo, sobrescrito por teste. */
function result(overrides: Record<string, unknown> = {}) {
  return {
    inventoryImportId: null,
    fileName: "contagem.xlsx",
    countedRows: 3,
    notCountedRows: 0,
    shortages: [{ productId: 1 }],
    surpluses: [],
    issues: [],
    shortageQuantity: 2,
    surplusQuantity: 0,
    hasNoChanges: false,
    isBlocked: false,
    blockReason: null,
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("validateInventoryFile", () => {
  it("aceita .xlsx", () => {
    expect(validateInventoryFile(fakeFile("contagem.xlsx"))).toBeNull();
  });

  it("aceita extensão em caixa alta", () => {
    // O Windows costuma devolver a extensão como o usuário salvou.
    expect(validateInventoryFile(fakeFile("CONTAGEM.XLSX"))).toBeNull();
  });

  it("recusa outra extensão", () => {
    // A conferência é por extensão, não por MIME: o Windows reporta o tipo de
    // .xlsx de formas diferentes dependendo de haver Excel instalado.
    expect(validateInventoryFile(fakeFile("contagem.csv"))).toContain(".xlsx");
  });

  it("recusa arquivo vazio", () => {
    expect(validateInventoryFile(fakeFile("contagem.xlsx", 0))).toContain("vazio");
  });

  it("recusa ausência de arquivo", () => {
    expect(validateInventoryFile(null)).toContain("Escolha");
  });
});

describe("canApplyInventoryCount", () => {
  it("permite aplicar quando há diferença", () => {
    expect(canApplyInventoryCount(result())).toBe(true);
  });

  it("não permite aplicar sem prévia", () => {
    expect(canApplyInventoryCount(null)).toBe(false);
  });

  it("não permite aplicar planilha sem diferença", () => {
    expect(canApplyInventoryCount(result({ hasNoChanges: true }))).toBe(false);
  });

  it("não permite aplicar planilha bloqueada mesmo com diferença", () => {
    // Produto duplicado bloqueia: somar as linhas ou usar a última seriam dois
    // palpites, e o dono não teria como saber qual valeu.
    expect(canApplyInventoryCount(result({ isBlocked: true }))).toBe(false);
  });
});

describe("exportInventorySheet", () => {
  it("dispara o download com o nome que o servidor mandou", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const createObjectURL = vi.fn().mockReturnValue("blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    downloadInventoryCountSheet.mockResolvedValue({
      blob: new Blob(["x"]),
      fileName: "contagem-de-estoque-2026-07-27-0900.xlsx",
    });

    const fileName = await exportInventorySheet();

    expect(fileName).toBe("contagem-de-estoque-2026-07-27-0900.xlsx");
    expect(anchor.download).toBe("contagem-de-estoque-2026-07-27-0900.xlsx");
    expect(click).toHaveBeenCalled();
    // Sem revogar, o blob fica preso na memória da aba até o recarregamento.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
