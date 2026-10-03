import { toDateKey } from "@workspace/core";

/** O que aconteceu com o arquivo depois do toque em "Compartilhar". */
export type ShareOutcome = "shared" | "cancelled" | "downloaded";

/** Nome do arquivo: `uaus-novidades-e-promocoes-2026-10-03.jpg`. */
export function bannerFileName(title: string, date: Date): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `uaus-${slug || "catalogo"}-${toDateKey(date)}.jpg`;
}

/**
 * O aparelho abre a folha de compartilhamento com ARQUIVO?
 *
 * Celular abre (é o caminho para o WhatsApp e o Instagram); a maior parte dos
 * navegadores de computador não, e aí o botão vira download.
 */
export function canShareFile(file: File): boolean {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function"
    ? navigator.canShare({ files: [file] })
    : false;
}

/** Salva o arquivo pelo navegador. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // O clique só agenda o download; soltar a URL na mesma volta o cancelaria.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Compartilha o arquivo pela folha do aparelho, ou baixa quando ela não existe.
 *
 * Fechar a folha sem escolher nada é `AbortError` — desistência, não falha.
 * Qualquer outro erro cai no download: o dono tocou porque quer o arquivo, e
 * devolver só uma mensagem de erro o deixaria sem ele.
 */
export async function shareFile(file: File): Promise<ShareOutcome> {
  if (!canShareFile(file)) {
    downloadFile(file);
    return "downloaded";
  }

  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";

    downloadFile(file);
    return "downloaded";
  }
}
