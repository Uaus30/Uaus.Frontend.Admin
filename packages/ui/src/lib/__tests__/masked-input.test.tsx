import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatDigitsKeepingCaret } from "../masked-input";

// As máscaras progressivas do cadastro de cliente (`formatCpf` e `formatDateBr`
// do `packages/core`), repetidas aqui porque o `ui` não depende do `core`.
const digitsOf = (value: string) => value.replace(/\D/g, "");
function formatCpf(value: string): string {
  const d = digitsOf(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatDateBr(value: string): string {
  const d = digitsOf(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Campo controlado com máscara, como o CPF e o nascimento do cadastro de cliente. */
function CampoComMascara({ inicial, mascara }: { inicial: string; mascara: (value: string) => string }) {
  const [valor, setValor] = useState(inicial);
  return (
    <input
      aria-label="campo"
      value={valor}
      onChange={(event) => setValor(formatDigitsKeepingCaret(event.target, mascara))}
    />
  );
}

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

/** Digita como o navegador: o texto entra com o cursor no lugar, e só então vem o `input`. */
function digitar(input: HTMLInputElement, texto: string, cursor: number) {
  setValue.call(input, texto);
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("formatDigitsKeepingCaret", () => {
  afterEach(cleanup);

  it("apagar um dígito no meio do CPF deixa o cursor onde ele estava, e o seguinte entra ali", () => {
    // O cenário da revisão de 22/10/2026: o "4" estava errado.
    render(<CampoComMascara inicial="123.456.789-01" mascara={formatCpf} />);
    const input = screen.getByLabelText<HTMLInputElement>("campo");

    // Backspace depois do "4": "123.|56.789-01" — os dígitos andam sobre o ponto,
    // e o cursor fica logo depois do terceiro dígito, como antes da tecla.
    digitar(input, "123.56.789-01", 4);
    expect(input.value).toBe("123.567.890-1");
    expect(input.selectionStart).toBe(3);

    // O dígito certo entra no mesmo lugar, e o CPF volta a ser o pretendido.
    digitar(input, "1239.567.890-1", 4);
    expect(input.value).toBe("123.956.789-01");
    expect(input.selectionStart).toBe(5);
  });

  it("corrigir o mês da data no meio não manda o cursor para o fim", () => {
    render(<CampoComMascara inicial="15/03/1990" mascara={formatDateBr} />);
    const input = screen.getByLabelText<HTMLInputElement>("campo");

    // Apaga o "3": "15/0|/1990" → "15/01/990", com o cursor depois do "0".
    digitar(input, "15/0/1990", 4);
    expect(input.value).toBe("15/01/990");
    expect(input.selectionStart).toBe(4);

    digitar(input, "15/041/990", 5);
    expect(input.value).toBe("15/04/1990");
    expect(input.selectionStart).toBe(5);
  });

  it("digitando no fim, o cursor acompanha a máscara, passando o separador", () => {
    render(<CampoComMascara inicial="123" mascara={formatCpf} />);
    const input = screen.getByLabelText<HTMLInputElement>("campo");

    digitar(input, "1234", 4);
    expect(input.value).toBe("123.4");
    expect(input.selectionStart).toBe(5);
  });

  it("valor já formatado passa sem ser reescrito", () => {
    const input = document.createElement("input");
    input.value = "123.456";
    input.setSelectionRange(2, 2);

    expect(formatDigitsKeepingCaret(input, formatCpf)).toBe("123.456");
    expect(input.selectionStart).toBe(2);
  });
});
