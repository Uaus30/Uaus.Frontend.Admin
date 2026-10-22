/**
 * Aplica uma máscara de dígitos ao campo SEM jogar o cursor para o fim, e devolve
 * o valor formatado — use no `onChange` de campo controlado com máscara
 * progressiva (CPF "000.000.000-00", data "dd/mm/aaaa").
 *
 * É o irmão do `uppercaseKeepingCaret` (22/10/2026, "bug reincidente" relatado
 * pelo dono). Com `onChange={(e) => set(formatCpf(e.target.value))}`, inserir ou
 * apagar um dígito no MEIO desloca os dígitos sobre os pontos e o hífen: o valor
 * formatado fica diferente do que está no campo, o React o reescreve, e o
 * navegador põe o cursor no fim. O dígito seguinte entra no fim — e o CPF que o
 * operador estava corrigindo vira outro.
 *
 * Aqui a máscara é aplicada no próprio campo, antes do React, e o cursor volta
 * para logo depois do MESMO número de dígitos que havia antes dele — os
 * separadores não contam, porque são eles que andam. Quando o React renderiza,
 * o valor já confere e ele não mexe no campo.
 *
 * @param input O campo do evento (`event.target`).
 * @param format A máscara (`formatCpf`, `formatDateBr`).
 * @returns O valor formatado, para gravar no estado.
 */
export function formatDigitsKeepingCaret(input: HTMLInputElement, format: (value: string) => string): string {
  const value = input.value;
  const formatted = format(value);
  if (formatted === value) return value;

  const cursor = input.selectionStart ?? value.length;
  const digitosAntes = countDigits(value.slice(0, cursor));

  input.value = formatted;
  const posicao = positionAfterDigits(formatted, digitosAntes);
  input.setSelectionRange(posicao, posicao);
  return formatted;
}

function countDigits(text: string): number {
  let total = 0;
  for (const char of text) if (char >= "0" && char <= "9") total++;
  return total;
}

/** A posição logo depois do n-ésimo dígito; o fim, se o texto tem menos que isso. */
function positionAfterDigits(text: string, digits: number): number {
  if (digits <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char >= "0" && char <= "9" && ++vistos === digits) return i + 1;
  }
  return text.length;
}
