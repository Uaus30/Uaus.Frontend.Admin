import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { uppercaseKeepingCaret } from "../uppercase-input";

/** Campo controlado que guarda o texto em maiúsculas, como o nome do produto. */
function CampoMaiusculo({ inicial }: { inicial: string }) {
  const [valor, setValor] = useState(inicial);
  return (
    <input
      aria-label="nome"
      value={valor}
      onChange={(event) => setValor(uppercaseKeepingCaret(event.target))}
    />
  );
}

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

/**
 * Digita como o navegador: o texto novo entra no campo com o cursor logo depois
 * da letra, e só então o evento `input` chega ao React.
 */
function digitar(input: HTMLInputElement, texto: string, cursor: number) {
  setValue.call(input, texto);
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("uppercaseKeepingCaret", () => {
  afterEach(cleanup);

  it("digitar no meio do nome converte a letra e deixa o cursor depois dela", () => {
    render(<CampoMaiusculo inicial="COPO 500ML" />);
    const input = screen.getByLabelText<HTMLInputElement>("nome");

    // "COPO| 500ML" + "t" → o cursor tem que ficar entre o T e o espaço.
    digitar(input, "COPOt 500ML", 5);

    expect(input.value).toBe("COPOT 500ML");
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);

    // A letra seguinte entra no mesmo lugar, não no fim do nome.
    digitar(input, "COPOTe 500ML", 6);
    expect(input.value).toBe("COPOTE 500ML");
    expect(input.selectionStart).toBe(6);
  });

  it("colar uma palavra no começo mantém o cursor no fim do que foi colado", () => {
    render(<CampoMaiusculo inicial="500ML" />);
    const input = screen.getByLabelText<HTMLInputElement>("nome");

    digitar(input, "copo 500ML", 5);

    expect(input.value).toBe("COPO 500ML");
    expect(input.selectionStart).toBe(5);
  });

  it("texto que já está em maiúsculas passa sem ser reescrito", () => {
    const input = document.createElement("input");
    input.value = "CANECA 2026";
    input.setSelectionRange(3, 7);

    expect(uppercaseKeepingCaret(input)).toBe("CANECA 2026");
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 7]);
  });
});
