/** Operadores aceitos pela calculadora, na notação que aparece na tela. */
export type CalculatorOperator = "+" | "−" | "×" | "÷";

const OPERATORS: CalculatorOperator[] = ["+", "−", "×", "÷"];

/** Casas decimais mostradas no resultado antes de cortar o rabo do float. */
const MAX_DECIMALS = 8;

const resultFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: MAX_DECIMALS,
});

/** Verifica se o caractere é um dos operadores da calculadora. */
export function isOperator(char: string): char is CalculatorOperator {
  return (OPERATORS as string[]).includes(char);
}

/**
 * Quebra a expressão em números e operadores.
 *
 * O sinal de menos logo no começo, ou logo depois de outro operador, faz parte
 * do número seguinte — é negativo, não subtração.
 *
 * @param expression Expressão como aparece na tela, com "," decimal.
 * @returns Números (como string) e operadores intercalados.
 */
export function tokenize(expression: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];

    if (!isOperator(char)) {
      current += char;
      continue;
    }

    const isSign =
      char === "−" && current === "" && (tokens.length === 0 || isOperator(tokens[tokens.length - 1]));
    if (isSign) {
      current = "-";
      continue;
    }

    if (current !== "") tokens.push(current);
    current = "";
    tokens.push(char);
  }

  if (current !== "") tokens.push(current);

  return tokens;
}

/** Converte o número digitado ("1.234,5" ou "-2,5") em número de verdade. */
function parseNumber(token: string) {
  const normalized = token.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Aplica um operador a dois valores. Divisão por zero devolve null. */
function apply(left: number, operator: string, right: number): number | null {
  switch (operator) {
    case "+":
      return left + right;
    case "−":
      return left - right;
    case "×":
      return left * right;
    case "÷":
      return right === 0 ? null : left / right;
    default:
      return null;
  }
}

/**
 * Calcula a expressão respeitando a precedência de × e ÷ sobre + e −.
 *
 * Um operador solto no fim é ignorado, para a prévia continuar mostrando um
 * resultado enquanto o operador ainda está sendo digitado.
 *
 * @param expression Expressão como aparece na tela.
 * @returns O resultado, ou null quando a expressão ainda não fecha.
 */
export function evaluate(expression: string): number | null {
  const tokens = tokenize(expression.trim());
  if (tokens.length === 0) return null;

  // Operador pendente no fim: calcula só o que já está completo.
  if (isOperator(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 0) return null;

  // Primeira passada resolve × e ÷, deixando só somas e subtrações.
  const reduced: (number | string)[] = [];
  let pending = parseNumber(tokens[0] as string);
  if (pending === null) return null;

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const rightToken = tokens[index + 1];
    if (rightToken === undefined) return null;

    const right = parseNumber(rightToken);
    if (right === null) return null;

    if (operator === "×" || operator === "÷") {
      const result = apply(pending, operator, right);
      if (result === null) return null;
      pending = result;
      continue;
    }

    reduced.push(pending, operator);
    pending = right;
  }

  reduced.push(pending);

  let total = reduced[0] as number;
  for (let index = 1; index < reduced.length; index += 2) {
    const result = apply(total, reduced[index] as string, reduced[index + 1] as number);
    if (result === null) return null;
    total = result;
  }

  return Number.isFinite(total) ? total : null;
}

/** Formata o resultado no padrão brasileiro, sem casas decimais sobrando. */
export function formatResult(value: number) {
  // Corta o resíduo de ponto flutuante (0.1 + 0.2) antes de formatar.
  return resultFormatter.format(Number(value.toPrecision(12)));
}

/** Converte um resultado de volta em texto editável na calculadora. */
export function resultToExpression(value: number) {
  return String(Number(value.toPrecision(12)))
    .replace("-", "−")
    .replace(".", ",");
}
