import { ToastAction, type ToastActionElement } from "@workspace/ui";

/**
 * O botão "Desfazer" do aviso de concluir e de reabrir. Mora num `.tsx` próprio
 * porque o hook (`.ts`) não escreve JSX, e o tipo do `action` do aviso só aceita o
 * elemento como o JSX o cria.
 *
 * @param altText O que o leitor de tela lê ("Reabrir a tarefa").
 */
export function undoAction(altText: string, onClick: () => void): ToastActionElement {
  return (
    <ToastAction altText={altText} onClick={onClick}>
      Desfazer
    </ToastAction>
  );
}
