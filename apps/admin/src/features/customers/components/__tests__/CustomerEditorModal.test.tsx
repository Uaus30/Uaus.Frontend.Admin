import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_CUSTOMER_FORM } from "../../hooks/useCustomers";
import { CustomerEditorModal } from "../CustomerEditorModal";

/**
 * O cadastro do programa de fidelidade (01/10/2026): o que a modal confere
 * antes de mandar, e o que ela manda. As regras em si (telefone, CPF, faixa)
 * têm teste no `@workspace/core`; aqui o que importa é a modal usá-las.
 */
function renderModal(overrides: Partial<Parameters<typeof CustomerEditorModal>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <CustomerEditorModal
      open
      onOpenChange={vi.fn()}
      editingId={null}
      initialForm={EMPTY_CUSTOMER_FORM}
      defaultAreaCode={44}
      defaultCity="Tapira"
      isSaving={false}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("CustomerEditorModal", () => {
  it("exige o telefone ou o CPF, e diz no campo", () => {
    const { onSubmit } = renderModal();

    type("Nome", "Ana do salão");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Informe o telefone ou o CPF/)).toBeTruthy();
  });

  it("manda o telefone com o DDD padrão, o CPF só com dígitos e a cidade da loja", () => {
    const { onSubmit } = renderModal();

    type("Nome", " Ana do salão ");
    type("Telefone", "99876-4321");
    type("CPF", "52998224725");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana do salão",
        phone: "44998764321",
        document: "52998224725",
        city: "Tapira",
        gender: 0,
        birthDate: null,
      }),
    );
  });

  it("mostra o DDD aplicado ao sair do telefone e marca o campo como preenchido", () => {
    renderModal();
    const phone = screen.getByLabelText("Telefone");

    type("Telefone", "99876-4321");
    fireEvent.blur(phone);

    expect((phone as HTMLInputElement).value).toBe("(44) 99876-4321");
    expect(phone.className).toContain("border-emerald-500");
    expect(screen.getByLabelText("CPF").className).not.toContain("border-emerald-500");
  });

  it("recusa o CPF com dígito verificador errado", () => {
    const { onSubmit } = renderModal();

    type("Nome", "Ana");
    type("CPF", "529.982.247-24");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/CPF inválido/)).toBeTruthy();
  });

  it("com o nascimento, a faixa de idade sai dele", () => {
    const { onSubmit } = renderModal();

    type("Nome", "Ana");
    type("Telefone", "44998764321");
    type("Nascimento", "01011950");
    expect((screen.getByLabelText("Nascimento") as HTMLInputElement).value).toBe("01/01/1950");
    expect(screen.getByText("Calculada pelo nascimento.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ birthDate: "1950-01-01", ageRange: 6 }));
  });

  it("na edição, não troca a cidade gravada pela da loja", () => {
    const { onSubmit } = renderModal({
      editingId: 7,
      initialForm: { ...EMPTY_CUSTOMER_FORM, name: "Bia", phone: "(44) 99876-4321", city: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ city: null, phone: "44998764321" }));
  });
});
