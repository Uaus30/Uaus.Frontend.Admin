import { StickyNote } from "lucide-react";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductNotesAlertProps = {
  editor: ReturnType<typeof useProductEditor>;
};

/**
 * Aviso de observação interna, no topo da aba Dados.
 *
 * O campo em si mora na aba Opcionais (junto com descrição, tags e
 * visibilidade) — mas uma observação que só aparece para quem pensa em abrir
 * Opcionais é uma observação que ninguém lê. Preenchida, ela precisa aparecer
 * onde o olho já está: assim que o cadastro abre.
 *
 * <b>Âmbar mais forte, e não uma quinta cor.</b> O vocabulário deste repositório
 * é fixo (verde/âmbar/vermelho/cinza — ver
 * `Uaus.Docs/dominio/convencoes-de-interface.md`) e "observação interna" não é
 * negativo nem bloqueado, então não é vermelho. É "atenção, tem algo para
 * saber antes de mexer" — o mesmo âmbar do resto do sistema, só que mais
 * saturado que o de costume: é o pedido explícito do dono, e é o que separa
 * "existe uma observação" de "existe uma observação que muda a decisão".
 *
 * Só renderiza com o campo preenchido — sem isso, todo cadastro sem observação
 * ganharia uma faixa vazia acima dos campos, virando ruído em 90% das aberturas.
 */
export function ProductNotesAlert({ editor }: ProductNotesAlertProps) {
  const notes = editor.form.notes.trim();
  if (!notes) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-amber-500 bg-amber-500/20 px-4 py-3">
      <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Observação interna</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-800/90 dark:text-amber-200/90">{notes}</p>
      </div>
    </div>
  );
}
