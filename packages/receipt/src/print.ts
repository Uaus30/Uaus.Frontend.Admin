import { buildReceiptHtml } from "./render";
import type { ReceiptData } from "./types";

/** Um único iframe de impressão por vez; o anterior é descartado. */
const PRINT_FRAME_ID = "uaus-receipt-print-frame";

/** Rede de segurança para navegadores que não disparam `afterprint`. */
const CLEANUP_TIMEOUT_MS = 60_000;

/** Espera as imagens do cupom decodificarem antes de mandar imprimir. */
function waitForImages(doc: Document) {
  const pending = Array.from(doc.images).filter((image) => !image.complete);
  if (pending.length === 0) return Promise.resolve();

  return Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * Abre a caixa de impressão do navegador com o HTML informado.
 *
 * O cupom vai para um iframe fora da tela em vez de uma nova janela: não esbarra
 * em bloqueador de pop-up e o app continua montado por trás da impressão.
 *
 * @param html Documento completo do cupom.
 * @returns Promise resolvida quando a impressão termina (ou é cancelada).
 */
export function printReceiptHtml(html: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  document.getElementById(PRINT_FRAME_ID)?.remove();

  return new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.id = PRINT_FRAME_ID;
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    // Fora da tela em vez de escondido: navegador não imprime iframe sem layout.
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:80mm;height:100vh;border:0;";

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      iframe.remove();
      resolve();
    };

    iframe.addEventListener("load", () => {
      const frameWindow = iframe.contentWindow;
      const frameDocument = iframe.contentDocument ?? frameWindow?.document;
      if (!frameWindow || !frameDocument) {
        cleanup();
        return;
      }

      waitForImages(frameDocument).then(() => {
        frameWindow.addEventListener("afterprint", () => window.setTimeout(cleanup, 0), {
          once: true,
        });
        window.setTimeout(cleanup, CLEANUP_TIMEOUT_MS);

        try {
          frameWindow.focus();
          frameWindow.print();
        } catch {
          cleanup();
        }
      });
    });

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

/**
 * Monta e imprime o cupom da venda.
 *
 * @param data Venda, itens, pagamentos e dados da loja.
 * @returns Promise resolvida quando a impressão termina (ou é cancelada).
 */
export function printReceipt(data: ReceiptData): Promise<void> {
  return printReceiptHtml(buildReceiptHtml(data));
}
