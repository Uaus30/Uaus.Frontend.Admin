import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@workspace/ui";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { VariationColumnsForm } from "../VariationColumnsForm";
import type { ProductGrade } from "../../../types";

/** O produto do relato: três variações distinguidas só pelo Tamanho. */
const SO_TAMANHO: ProductGrade[] = [{ type: GRADE_TYPE.Size, values: ["10L", "6L", "3,6L"] }];

function renderForm(selectedGrades = SO_TAMANHO, variationCount = 3) {
  const onConfirm = vi.fn();

  render(
    <Dialog open>
      <VariationColumnsForm
        selectedGrades={selectedGrades}
        variationCount={variationCount}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    </Dialog>,
  );

  return { onConfirm };
}

afterEach(() => {
  cleanup();
});

describe("VariationColumnsForm", () => {
  it("não pede valor nenhum — só marca a grade", () => {
    // É a simplificação de 01/09/2026: em produto já cadastrado a modal não
    // cruza grades, então não tem o que perguntar além de QUAIS colunas existem.
    renderForm();

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/Em uso: 10L · 6L · 3,6L/)).toBeTruthy();
  });

  it("marcar uma grade nova devolve a coluna a mais, sem valores", () => {
    const { onConfirm } = renderForm();

    fireEvent.click(screen.getByRole("checkbox", { name: /cor/i }));
    fireEvent.click(screen.getByRole("button", { name: /aplicar colunas/i }));

    expect(onConfirm).toHaveBeenCalledWith([
      { type: GRADE_TYPE.Size, values: ["10L", "6L", "3,6L"] },
      { type: GRADE_TYPE.Color, values: [] },
    ]);
  });

  it("desmarcar avisa que a coluna e os valores dela somem", () => {
    // A variação continua no cadastro — some a coluna, não a linha. Sem o
    // aviso, apagar o Tamanho de três variações pareceria uma troca inofensiva.
    renderForm();

    fireEvent.click(screen.getByRole("checkbox", { name: /tamanho/i }));

    expect(screen.getByText(/apaga a coluna e o valor dela em todas as variações/i)).toBeTruthy();
  });

  it("produto ainda sem variação: só o tipo, e o aviso da linha que vai nascer", () => {
    // REGRESSÃO (produção, 12/09/2026 — produto 897): aqui a modal pedia os
    // VALORES de cada grade, cruzava tudo e o resultado era descartado logo
    // depois. Agora ela pergunta só o tipo, e a tabela nasce com o próprio
    // produto para o operador preencher.
    const { onConfirm } = renderForm([], 0);

    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /cor/i }));

    expect(screen.getByText(/preenchimento obrigatório para salvar/i)).toBeTruthy();
    expect(screen.getByText(/a tabela nasce com uma linha: o produto atual/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /criar variações/i }));

    expect(onConfirm).toHaveBeenCalledWith([{ type: GRADE_TYPE.Color, values: [] }]);
  });

  it("não deixa aplicar sem grade nenhuma", () => {
    // Variação sem valor de grade é recusada no salvar: o produto precisa de
    // ao menos uma coluna.
    renderForm();

    fireEvent.click(screen.getByRole("checkbox", { name: /tamanho/i }));

    expect(screen.getByRole("button", { name: /aplicar colunas/i }).hasAttribute("disabled")).toBe(true);
  });
});
