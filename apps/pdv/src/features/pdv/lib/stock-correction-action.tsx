import { ToastAction, type ToastActionElement } from "@workspace/ui";
import { canCorrectStock, openStockCorrection, type StockCorrectionTarget } from "./stock-correction";

/**
 * O botão "Corrigir estoque" dentro do aviso de recusa — "Produto sem estoque" e
 * "Estoque insuficiente", do bipe, da lista e do "+" do carrinho.
 *
 * O aviso é onde o operador está olhando quando o caixa recusa: no bipe não há
 * linha na lista para pôr o atalho, porque o campo já foi limpo para o próximo
 * código. Sem internet, ou sem saber onde o admin está, o aviso sai sem o botão
 * (ver `canCorrectStock`).
 *
 * @returns O botão para o `action` do toast, ou `undefined` quando o atalho não
 *   pode abrir.
 */
export function stockCorrectionToastAction(
  target: StockCorrectionTarget,
  online: boolean,
): ToastActionElement | undefined {
  if (!canCorrectStock(online)) return undefined;

  return (
    <ToastAction
      altText="Corrigir estoque no painel administrativo"
      onClick={() => openStockCorrection(target)}
    >
      Corrigir estoque
    </ToastAction>
  );
}
