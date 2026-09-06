import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariableCostsTable } from "../VariableCostsTable";

const freezer = { description: "Conserto do freezer", amount: 300 };

const descriptionInput = () => screen.getByLabelText("Descrição do custo variável") as HTMLInputElement;
const amountInput = () => screen.getByLabelText("Valor do custo variável") as HTMLInputElement;
const addButton = () => screen.getByRole("button", { name: /adicionar/i }) as HTMLButtonElement;

/** Preenche o formulário de lançamento com o que for passado. */
function fillForm({ description, amount }: { description?: string; amount?: string }) {
  if (description !== undefined) fireEvent.change(descriptionInput(), { target: { value: description } });
  if (amount !== undefined) fireEvent.change(amountInput(), { target: { value: amount } });
}

describe("VariableCostsTable", () => {
  it("deve lançar o gasto com a descrição sem espaços das pontas e limpar o formulário", () => {
    const onAdd = vi.fn();
    render(<VariableCostsTable items={[]} total={0} onAdd={onAdd} onRemove={vi.fn()} />);

    fillForm({ description: "  Conserto do freezer  ", amount: "300" });
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith(freezer);
    expect(descriptionInput().value).toBe("");
    expect(amountInput().value).toBe("");
  });

  it.each([
    ["sem descrição", { description: "   ", amount: "300" }],
    ["sem valor", { description: "Conserto", amount: "" }],
    ["com valor zero", { description: "Conserto", amount: "0" }],
    ["com valor negativo", { description: "Conserto", amount: "-10" }],
  ])("não deve lançar %s", (_caso, form) => {
    // Valor negativo entraria como receita disfarçada de custo, e o documento
    // diria que o mês foi melhor do que foi. O backend também recusa.
    const onAdd = vi.fn();
    render(<VariableCostsTable items={[]} total={0} onAdd={onAdd} onRemove={vi.fn()} />);

    fillForm(form);

    expect(addButton().disabled).toBe(true);
    fireEvent.click(addButton());
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("deve remover pela posição — duas linhas iguais são registros diferentes", () => {
    const onRemove = vi.fn();
    render(<VariableCostsTable items={[freezer, freezer]} total={600} onAdd={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getAllByRole("button", { name: /remover conserto do freezer/i })[1]);

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("deve travar a edição durante o recálculo", () => {
    // Lançar outra linha com o recálculo em voo mandaria a lista sem a anterior.
    render(
      <VariableCostsTable items={[freezer]} total={300} onAdd={vi.fn()} onRemove={vi.fn()} isRecalculating />,
    );

    const remove = screen.getByRole("button", { name: /remover conserto do freezer/i }) as HTMLButtonElement;
    expect(addButton().disabled).toBe(true);
    expect(remove.disabled).toBe(true);
  });

  it("deve sumir no documento confirmado sem gasto eventual", () => {
    // Sem handlers a tabela é só de leitura: tabela vazia num fechamento
    // confirmado seria ruído, porque ali não há nada a lançar.
    const { container } = render(<VariableCostsTable items={[]} total={0} />);

    expect(container.innerHTML).toBe("");
  });

  it("deve listar sem formulário no documento confirmado", () => {
    render(<VariableCostsTable items={[freezer]} total={300} />);

    expect(screen.queryByText("Conserto do freezer")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /adicionar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remover/i })).toBeNull();
  });
});
