import { buildReceiptHtml } from "./render";
import type { ReceiptData } from "./types";

/** Um único iframe de impressão por vez; o anterior é descartado. */
const PRINT_FRAME_ID = "uaus-receipt-print-frame";

/** Rede de segurança para navegadores que não disparam `afterprint`. */
const CLEANUP_TIMEOUT_MS = 60_000;

/**
 * Teto do quanto a impressão espera a tela assentar antes de travar a thread.
 *
 * As animações de diálogo do `packages/ui` duram 200 ms; 400 dá folga sem que
 * uma animação esquisita segure o cupom. Estourar o teto imprime assim mesmo —
 * papel atrasado é pior que um diálogo torto.
 */
const SETTLE_TIMEOUT_MS = 400;

/**
 * Espera as animações de SAÍDA da tela terminarem antes de imprimir.
 *
 * <b>Não é polimento: é correção.</b> `window.print()` bloqueia a thread
 * principal, e o `Presence` do Radix só desmonta um diálogo quando recebe o
 * `animationend` da animação de saída — sem prazo de segurança nenhum. Imprimir
 * no mesmo quadro em que um diálogo começa a fechar mata esse evento, e o nó
 * fica na tela **para sempre**: visível, com o ESC morto (o `DismissableLayer`
 * já foi desmontado junto com o React) e o clique de fora comido pelo overlay
 * órfão. Foi o que aconteceu no balcão ao finalizar uma venda — o `finishSale()`
 * fecha o diálogo de pagamento e a impressão sai na linha seguinte.
 *
 * O `setTimeout(0)` existe porque a animação de saída só entra em
 * `getAnimations()` DEPOIS de o React comitar o fechamento, e quem chama isto
 * chama na mesma volta em que pediu para fechar.
 *
 * Animações infinitas (o `animate-spin` do botão que está gravando, o
 * `animate-pulse`) ficam de fora: elas nunca terminam, e esperá-las seria
 * sempre esperar o teto inteiro.
 */
function waitForScreenToSettle(): Promise<void> {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const saindo = document.getAnimations().filter((animation) => {
        // "não terminou", e não "está exatamente em running": uma animação CSS
        // recém-atribuída ainda não teve o primeiro quadro, e depender do nome
        // exato do estado nesse instante é apostar de novo no que este conserto
        // existe para não apostar. O teto limita o pior caso.
        if (animation.playState === "finished" || animation.playState === "idle") return false;
        return animation.effect?.getComputedTiming().iterations !== Infinity;
      });

      if (saindo.length === 0) {
        resolve();
        return;
      }

      const teto = setTimeout(resolve, SETTLE_TIMEOUT_MS);

      // `allSettled`: `finished` REJEITA quando a animação é cancelada, e
      // cancelada também significa "a tela já assentou".
      void Promise.allSettled(saindo.map((animation) => animation.finished)).then(() => {
        clearTimeout(teto);
        resolve();
      });
    }, 0);
  });
}

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
 * <b>Espera a tela assentar primeiro</b> — ver `waitForScreenToSettle`, e o
 * porquê não é estético.
 *
 * @param html Documento completo do cupom.
 * @returns Promise resolvida quando a impressão termina (ou é cancelada).
 */
export async function printReceiptHtml(html: string): Promise<void> {
  if (typeof document === "undefined") return;

  // ANTES de montar o iframe: ver `waitForScreenToSettle`.
  await waitForScreenToSettle();

  document.getElementById(PRINT_FRAME_ID)?.remove();

  return new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.id = PRINT_FRAME_ID;
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    // Fora da tela em vez de escondido: navegador não imprime iframe sem layout.
    iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:100vh;border:0;";

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
