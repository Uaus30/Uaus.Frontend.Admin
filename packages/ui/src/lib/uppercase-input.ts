/**
 * Põe o texto de um campo em caixa alta SEM tirar o cursor do lugar, e devolve
 * o valor convertido — use no `onChange` de campo controlado que guarda o texto
 * em maiúsculas (nome de produto, código de cupom).
 *
 * O jeito ingênuo, `onChange={(e) => set(e.target.value.toUpperCase())}`, joga
 * o cursor para o FIM do campo a cada tecla quando se digita no meio do texto:
 * o React escreve no campo um valor diferente do que está nele (a letra recém
 * digitada era minúscula), e o navegador põe o cursor no fim sempre que o valor
 * é trocado por código. Para acrescentar uma palavra no meio de um nome era
 * preciso clicar de novo a cada letra (relatado pelo dono em 06/10/2026, no
 * nome da compra e no do cadastro de produto).
 *
 * Aqui a troca acontece no próprio campo, antes do React, e a seleção volta
 * para onde estava; quando o React renderiza, o valor já confere e ele não mexe
 * no campo. Texto que já está em maiúsculas não é tocado.
 *
 * Letra que muda de tamanho em maiúscula ("ß" → "SS") desloca o cursor em uma
 * posição naquele ponto — caso que o catálogo da loja não tem.
 */
export function uppercaseKeepingCaret(input: HTMLInputElement): string {
  const value = input.value;
  const upper = value.toUpperCase();
  if (upper === value) return value;

  const { selectionStart, selectionEnd, selectionDirection } = input;
  input.value = upper;
  if (selectionStart != null && selectionEnd != null) {
    input.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
  }
  return upper;
}
