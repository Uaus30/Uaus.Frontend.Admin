import { round2 } from "./money";

/**
 * Fórmula em campo de valor — "=17,99*2".
 *
 * Existe porque a nota do fornecedor quase nunca traz o total já somado: vem
 * "12 unidades a 17,99" e quem digita fazia a conta na calculadora do celular
 * antes de escrever o resultado. Digitar a conta no próprio campo tira o passo
 * intermediário — e, principalmente, deixa o número CONFERÍVEL: um total de
 * R$ 215,88 não diz nada, "=17,99*12" diz de onde ele veio.
 *
 * O avaliador é escrito à mão (descida recursiva) e não usa `eval` nem
 * `new Function`: o texto vem de um campo de formulário, e transformar o que o
 * operador digita em código executável é a definição de injeção. Aqui, o que
 * não for número, operador ou parêntese simplesmente não é fórmula.
 */

/** O que marca o texto como fórmula. Sem ele, o campo se comporta como sempre. */
export const AMOUNT_FORMULA_PREFIX = "=";

/** O texto digitado é uma fórmula, e não um valor comum? */
export function isAmountFormula(text: string): boolean {
  return text.trimStart().startsWith(AMOUNT_FORMULA_PREFIX);
}

/**
 * Calcula uma fórmula digitada num campo de valor.
 *
 * Aceita `+`, `-`, `*`, `/`, parênteses, sinal unário e espaços. O separador
 * decimal pode ser vírgula ou ponto — "=17,99*2" e "=17.99*2" dão o mesmo
 * resultado, porque teclado numérico manda ponto e o resto do sistema fala
 * vírgula, e obrigar a escolher um dos dois seria transformar um atalho em
 * pegadinha. Num número com os DOIS ("1.234,50"), o último separador é o
 * decimal e os anteriores são de milhar, que é a leitura pt-BR.
 *
 * @param text O conteúdo do campo, com ou sem o `=` inicial.
 * @returns O valor em reais, arredondado ao centavo, ou `null` quando o texto
 *   não é uma conta válida — divisão por zero e sobra de caracteres incluídas.
 *   `null` é "não entendi", e quem chama decide o que fazer; devolver zero
 *   apagaria silenciosamente o valor que já estava no campo.
 */
export function evaluateAmountFormula(text: string): number | null {
  const expression = text.trim().replace(/^=/, "");
  if (!expression.trim()) return null;

  const parser = new FormulaParser(expression);
  const value = parser.parseExpression();

  // Sobra depois do fim da conta ("=2*3 abc") é erro, não resultado parcial.
  if (value === null || !parser.atEnd()) return null;
  if (!Number.isFinite(value)) return null;

  return round2(value);
}

/**
 * Descida recursiva sobre a expressão, com a precedência de sempre:
 * `expressão := termo (('+' | '-') termo)*` e `termo := fator (('*' | '/') fator)*`.
 *
 * Qualquer passo que não reconheça o que vem a seguir devolve `null`, e o
 * `null` sobe até o topo — não há erro parcial, ou a conta inteira vale ou não
 * vale.
 */
class FormulaParser {
  private position = 0;
  private readonly source: string;

  // Campo explícito, e não parâmetro de construtor: o PDV compila com
  // `erasableSyntaxOnly`, que recusa a forma abreviada.
  constructor(source: string) {
    this.source = source;
  }

  atEnd(): boolean {
    this.skipSpaces();
    return this.position >= this.source.length;
  }

  parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;

    for (;;) {
      const operator = this.peekOperator("+-");
      if (operator === null) return left;

      this.position++;
      const right = this.parseTerm();
      if (right === null) return null;

      left = operator === "+" ? left + right : left - right;
    }
  }

  private parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;

    for (;;) {
      const operator = this.peekOperator("*/");
      if (operator === null) return left;

      this.position++;
      const right = this.parseFactor();
      if (right === null) return null;

      // Divisão por zero daria Infinity, que viraria um total sem sentido no
      // campo. Recusar devolve o valor anterior, que é o desfecho honesto.
      if (operator === "/" && right === 0) return null;

      left = operator === "*" ? left * right : left / right;
    }
  }

  private parseFactor(): number | null {
    this.skipSpaces();

    const sign = this.peekOperator("+-");
    if (sign !== null) {
      this.position++;
      const value = this.parseFactor();
      return value === null ? null : sign === "-" ? -value : value;
    }

    if (this.source[this.position] === "(") {
      this.position++;
      const value = this.parseExpression();
      if (value === null) return null;

      this.skipSpaces();
      if (this.source[this.position] !== ")") return null;
      this.position++;
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number | null {
    this.skipSpaces();

    const start = this.position;
    while (this.position < this.source.length && /[\d.,]/.test(this.source[this.position])) this.position++;

    const raw = this.source.slice(start, this.position);
    if (!raw || !/\d/.test(raw)) return null;

    const value = Number(normalizeSeparators(raw));
    return Number.isFinite(value) ? value : null;
  }

  /** O próximo caractere não-espaço, se for um dos operadores pedidos. */
  private peekOperator(operators: string): string | null {
    this.skipSpaces();
    const char = this.source[this.position];
    return char !== undefined && operators.includes(char) ? char : null;
  }

  private skipSpaces(): void {
    while (this.position < this.source.length && /\s/.test(this.source[this.position])) this.position++;
  }
}

/**
 * "1.234,50" → "1234.50"; "17,99" → "17.99"; "17.99" → "17.99".
 *
 * O ÚLTIMO separador é o decimal e os demais são de milhar. Com um separador
 * só, ele é o decimal — inclusive o ponto, para "=17.99*2" (teclado numérico)
 * dar 35,98 e não 1798.
 */
function normalizeSeparators(raw: string): string {
  const lastSeparator = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  if (lastSeparator === -1) return raw;

  const integerPart = raw.slice(0, lastSeparator).replace(/[.,]/g, "");
  const decimalPart = raw.slice(lastSeparator + 1);
  return `${integerPart}.${decimalPart}`;
}
