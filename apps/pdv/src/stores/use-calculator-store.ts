import { create } from "zustand";
import { evaluate, isOperator, resultToExpression } from "@/lib/calculator";

/** Um cálculo já fechado, guardado no histórico da sessão. */
export interface CalculationEntry {
  id: string;
  expression: string;
  result: number;
}

/** Quantos cálculos o histórico guarda antes de descartar os mais antigos. */
const HISTORY_LIMIT = 30;

/**
 * Estado da calculadora flutuante do PDV.
 *
 * Vive fora da tela do PDV para que a expressão, o histórico e a posição da
 * janela sobrevivam a fechar e reabrir a calculadora durante o atendimento.
 */
interface CalculatorState {
  open: boolean;
  /** Expressão em edição, na notação de tela ("2+9×3"). */
  expression: string;
  /**
   * O resultado na tela veio de um "=" e ninguém digitou nada depois.
   *
   * Digitar um número nesse estado começa um cálculo novo; digitar um operador
   * continua a partir do resultado. É como toda calculadora de balcão se comporta.
   */
  resultOnScreen: boolean;
  history: CalculationEntry[];
  historyOpen: boolean;
  /** Deslocamento da janela em relação à posição inicial, em pixels. */
  position: { x: number; y: number };

  toggleOpen: () => void;
  close: () => void;
  toggleHistory: () => void;
  setPosition: (position: { x: number; y: number }) => void;

  /** Digita um caractere (dígito, vírgula ou operador) na expressão. */
  input: (char: string) => void;
  /** Apaga o último caractere digitado. */
  backspace: () => void;
  /** Limpa a expressão em edição. */
  clear: () => void;
  /** Divide o número em edição por 100. */
  percent: () => void;
  /** Fecha o cálculo, guarda no histórico e deixa o resultado pronto para continuar. */
  equals: () => void;
  /** Recupera um cálculo do histórico para a linha de edição. */
  recall: (id: string) => void;
  clearHistory: () => void;
}

const generateId = () => Math.random().toString(36).slice(2, 11);

export const useCalculatorStore = create<CalculatorState>((set, get) => ({
  open: false,
  expression: "",
  resultOnScreen: false,
  history: [],
  historyOpen: false,
  position: { x: 0, y: 0 },

  toggleOpen: () => set((state) => ({ open: !state.open })),

  close: () => set(() => ({ open: false })),

  toggleHistory: () => set((state) => ({ historyOpen: !state.historyOpen })),

  setPosition: (position) => set(() => ({ position })),

  input: (char) =>
    set((state) => {
      // Número logo depois de um "=" abre um cálculo novo, como se o operador
      // tivesse apertado AC. Operador continua de onde o resultado parou.
      const expression = state.resultOnScreen && !isOperator(char) ? "" : state.expression;
      const resultOnScreen = false;

      if (isOperator(char)) {
        // Operador no vazio só faz sentido para abrir um número negativo.
        if (expression === "") return { expression: char === "−" ? "−" : "", resultOnScreen };
        // Trocar de ideia sobre o operador substitui o anterior em vez de somar outro.
        if (isOperator(expression[expression.length - 1])) {
          return { expression: expression.slice(0, -1) + char, resultOnScreen };
        }
        return { expression: expression + char, resultOnScreen };
      }

      if (char === ",") {
        const currentNumber = expression.split(/[+−×÷]/).pop() ?? "";
        if (currentNumber.includes(",")) return { expression, resultOnScreen };
        if (currentNumber === "") return { expression: expression + "0,", resultOnScreen };
      }

      return { expression: expression + char, resultOnScreen };
    }),

  backspace: () => set((state) => ({ expression: state.expression.slice(0, -1), resultOnScreen: false })),

  clear: () => set(() => ({ expression: "", resultOnScreen: false })),

  percent: () =>
    set((state) => {
      const match = state.expression.match(/(\d+(?:,\d+)?)$/);
      if (!match) return { expression: state.expression, resultOnScreen: false };

      const value = Number(match[1].replace(",", "."));
      const divided = resultToExpression(value / 100);
      return {
        expression: state.expression.slice(0, -match[1].length) + divided,
        resultOnScreen: false,
      };
    }),

  equals: () => {
    const { expression, history } = get();
    const result = evaluate(expression);
    if (result === null) return;

    const entry: CalculationEntry = { id: generateId(), expression, result };

    set(() => ({
      expression: resultToExpression(result),
      resultOnScreen: true,
      history: [entry, ...history].slice(0, HISTORY_LIMIT),
    }));
  },

  recall: (id) =>
    set((state) => {
      const entry = state.history.find((item) => item.id === id);
      return entry ? { expression: entry.expression, resultOnScreen: false } : {};
    }),

  clearHistory: () => set(() => ({ history: [] })),
}));
