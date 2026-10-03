import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canShareFile, pieceFileName, shareFile } from "../share";

const file = new File(["x"], "uaus-teste.jpg", { type: "image/jpeg" });

/** Troca `navigator.share`/`canShare` só durante o teste. */
function stubShare(share: unknown, canShare: unknown) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true });
}

describe("pieceFileName", () => {
  it("vira nome de arquivo sem acento, espaço nem símbolo, com o dia local", () => {
    // Meio-dia local: longe da virada, o teste não depende do fuso da máquina.
    expect(pieceFileName("Novidades e promoções", new Date(2026, 9, 3, 12), "jpg")).toBe(
      "uaus-novidades-e-promocoes-2026-10-03.jpg",
    );
  });

  it("título só de símbolos cai num nome genérico", () => {
    expect(pieceFileName("!!!", new Date(2026, 9, 3, 12), "pdf")).toBe("uaus-catalogo-2026-10-03.pdf");
  });
});

describe("compartilhar o arquivo", () => {
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // O jsdom não baixa nada: o que se observa é o clique no link de download.
    click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:teste");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    click.mockRestore();
    stubShare(undefined, undefined);
  });

  it("sem a folha de compartilhamento (computador), baixa", async () => {
    stubShare(undefined, undefined);

    expect(canShareFile(file)).toBe(false);
    await expect(shareFile(file)).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("o aparelho tem a folha mas não aceita arquivo: baixa", async () => {
    stubShare(vi.fn(), () => false);

    await expect(shareFile(file)).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("no celular abre a folha com o arquivo e não baixa", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubShare(share, () => true);

    await expect(shareFile(file)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(click).not.toHaveBeenCalled();
  });

  it("fechar a folha sem escolher é desistência: nem erro, nem download", async () => {
    stubShare(vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError")), () => true);

    await expect(shareFile(file)).resolves.toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });

  it("qualquer outra falha da folha cai no download", async () => {
    stubShare(vi.fn().mockRejectedValue(new DOMException("sem gesto", "NotAllowedError")), () => true);

    await expect(shareFile(file)).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
