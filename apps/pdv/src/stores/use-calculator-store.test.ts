import { beforeEach, describe, expect, it } from "vitest";
import { useCalculatorStore } from "./use-calculator-store";

/** Digita uma sequência de caracteres na calculadora. */
function digitar(chars: string) {
  for (const char of chars) useCalculatorStore.getState().input(char);
}

describe("useCalculatorStore", () => {
  beforeEach(() => {
    useCalculatorStore.setState({
      open: false,
      expression: "",
      resultOnScreen: false,
      history: [],
      historyOpen: false,
      position: { x: 0, y: 0 },
    });
  });

  describe("digitação", () => {
    it("acumula dígitos e operadores", () => {
      digitar("2+9");
      expect(useCalculatorStore.getState().expression).toBe("2+9");
    });

    it("troca o operador quando o operador é digitado duas vezes seguidas", () => {
      digitar("2+");
      useCalculatorStore.getState().input("×");
      expect(useCalculatorStore.getState().expression).toBe("2×");
    });

    it("aceita o menos no vazio para abrir um número negativo", () => {
      useCalculatorStore.getState().input("−");
      expect(useCalculatorStore.getState().expression).toBe("−");
    });

    it("ignora os demais operadores no vazio", () => {
      useCalculatorStore.getState().input("×");
      expect(useCalculatorStore.getState().expression).toBe("");
    });

    it("completa o zero antes da vírgula solta", () => {
      useCalculatorStore.getState().input(",");
      expect(useCalculatorStore.getState().expression).toBe("0,");
    });

    it("recusa a segunda vírgula no mesmo número", () => {
      digitar("1,5");
      useCalculatorStore.getState().input(",");
      expect(useCalculatorStore.getState().expression).toBe("1,5");
    });
  });

  describe("depois do =", () => {
    it("guarda o cálculo no histórico e deixa o resultado na tela", () => {
      digitar("2+9");
      useCalculatorStore.getState().equals();

      const state = useCalculatorStore.getState();
      expect(state.expression).toBe("11");
      expect(state.resultOnScreen).toBe(true);
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toMatchObject({ expression: "2+9", result: 11 });
    });

    it("começa um cálculo novo quando o próximo toque é um número", () => {
      digitar("2+9");
      useCalculatorStore.getState().equals();

      useCalculatorStore.getState().input("5");

      const state = useCalculatorStore.getState();
      expect(state.expression).toBe("5");
      expect(state.resultOnScreen).toBe(false);
    });

    it("começa um cálculo novo quando o próximo toque é a vírgula", () => {
      digitar("2+9");
      useCalculatorStore.getState().equals();

      useCalculatorStore.getState().input(",");

      expect(useCalculatorStore.getState().expression).toBe("0,");
    });

    it("continua do resultado quando o próximo toque é um operador", () => {
      digitar("4×3");
      useCalculatorStore.getState().equals();

      digitar("+2");

      const state = useCalculatorStore.getState();
      expect(state.expression).toBe("12+2");
      expect(state.resultOnScreen).toBe(false);
    });

    it("não guarda nada quando a expressão não fecha", () => {
      digitar("5÷0");
      useCalculatorStore.getState().equals();

      const state = useCalculatorStore.getState();
      expect(state.expression).toBe("5÷0");
      expect(state.history).toHaveLength(0);
      expect(state.resultOnScreen).toBe(false);
    });
  });

  describe("histórico", () => {
    it("empilha o mais recente no topo", () => {
      digitar("1+1");
      useCalculatorStore.getState().equals();
      useCalculatorStore.getState().clear();
      digitar("2+2");
      useCalculatorStore.getState().equals();

      expect(useCalculatorStore.getState().history.map((item) => item.result)).toEqual([4, 2]);
    });

    it("traz um cálculo de volta para edição", () => {
      digitar("7+7");
      useCalculatorStore.getState().equals();
      const { id } = useCalculatorStore.getState().history[0];

      useCalculatorStore.getState().recall(id);

      const state = useCalculatorStore.getState();
      expect(state.expression).toBe("7+7");
      expect(state.resultOnScreen).toBe(false);
    });

    it("limpa o histórico", () => {
      digitar("1+1");
      useCalculatorStore.getState().equals();

      useCalculatorStore.getState().clearHistory();

      expect(useCalculatorStore.getState().history).toHaveLength(0);
    });
  });

  describe("teclas de ação", () => {
    it("AC limpa a expressão e o estado de resultado", () => {
      digitar("2+9");
      useCalculatorStore.getState().equals();

      useCalculatorStore.getState().clear();

      const state = useCalculatorStore.getState();
      expect(state.expression).toBe("");
      expect(state.resultOnScreen).toBe(false);
    });

    it("apagar remove o último caractere", () => {
      digitar("123");
      useCalculatorStore.getState().backspace();
      expect(useCalculatorStore.getState().expression).toBe("12");
    });

    it("porcentagem divide o número em edição por cem", () => {
      digitar("50");
      useCalculatorStore.getState().percent();
      expect(useCalculatorStore.getState().expression).toBe("0,5");
    });

    it("porcentagem preserva o que veio antes do número", () => {
      digitar("200+50");
      useCalculatorStore.getState().percent();
      expect(useCalculatorStore.getState().expression).toBe("200+0,5");
    });
  });
});
