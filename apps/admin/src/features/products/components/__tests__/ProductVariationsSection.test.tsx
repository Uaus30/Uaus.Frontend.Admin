import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { ProductVariationsSection } from "../ProductVariationsSection";
import type { ProductGrade, VariationDraft } from "../../types";

/** Uma variação já gravada, com a grade que a importação trouxe como "Modelo". */
function draft(id: number, valor: string, barcode: string): VariationDraft {
  return {
    id,
    key: `product-${id}`,
    name: "BACIA COM TAMPA TRITEC",
    description: "",
    price: 14.9,
    stock: 0,
    minStock: 0,
    status: "2",
    tagIds: [],
    barcode,
    images: [],
    canDelete: true,
    values: [{ gradeType: GRADE_TYPE.Model, value: valor }],
  };
}

const GRADES: ProductGrade[] = [{ type: GRADE_TYPE.Model, values: ["Azul", "Preto"] }];

function renderSection(overrides: Partial<React.ComponentProps<typeof ProductVariationsSection>> = {}) {
  const changeGradeType = vi.fn();

  render(
    <ProductVariationsSection
      variationDrafts={[draft(1, "Azul", "789"), draft(2, "Preto", "790")]}
      selectedGrades={GRADES}
      productGroupName="BACIA COM TAMPA TRITEC"
      isFetchingGroupProducts={false}
      selectableStatusOptions={[{ id: 2, name: "Ativo" }]}
      validationErrors={{}}
      updateVariationDraft={vi.fn()}
      setVariationToDelete={vi.fn()}
      handleDeleteVariation={vi.fn()}
      addVariationDraft={vi.fn()}
      changeGradeType={changeGradeType}
      {...overrides}
    />,
  );

  return { changeGradeType };
}

afterEach(() => {
  cleanup();
});

describe("ProductVariationsSection", () => {
  it("o título da coluna de grade é um seletor com o tipo atual", () => {
    renderSection();

    const titulo = screen.getByRole("combobox", { name: /trocar o tipo desta grade/i });

    expect(titulo.textContent).toContain("Modelo");
  });

  it("escolher outro tipo troca a grade de todas as linhas de uma vez", () => {
    // A importação do sistema anterior trouxe centenas de produtos com "Modelo"
    // onde o valor é cor. Pela modal de configuração não dava para corrigir sem
    // mandar as variações com código de barras para a exclusão.
    const { changeGradeType } = renderSection();

    fireEvent.click(screen.getByRole("combobox", { name: /trocar o tipo desta grade/i }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Cor"));

    expect(changeGradeType).toHaveBeenCalledWith(GRADE_TYPE.Model, GRADE_TYPE.Color);
  });

  it("tipo já usado por outra coluna não pode ser escolhido", () => {
    // Duas grades do mesmo tipo na mesma variação não têm representação: a
    // tabela do banco tem uma linha por grade.
    renderSection({
      selectedGrades: [
        { type: GRADE_TYPE.Color, values: ["Azul"] },
        { type: GRADE_TYPE.Model, values: ["Com alça"] },
      ],
    });

    const [colunaCor] = screen.getAllByRole("combobox", { name: /trocar o tipo desta grade/i });
    fireEvent.click(colunaCor);

    const opcaoModelo = within(screen.getByRole("listbox")).getByRole("option", { name: "Modelo" });

    expect(opcaoModelo.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("ProductVariationsSection — coluna de estoque", () => {
  it("mostra o saldo de cada variação, sem deixar editar", () => {
    // Relato do dono (12/09/2026, grupo 168): ao converter um produto simples em
    // produto com variações, o estoque continuou na variação mais antiga — mas a
    // tabela não mostrava saldo nenhum, e parecia que ele tinha sumido.
    renderSection({
      variationDrafts: [
        { ...draft(213, "Slip", "789"), stock: 3 },
        { ...draft(1077, "Boxer", "790"), stock: 0 },
      ],
    });

    const linhas = screen.getAllByRole("row");

    expect(within(linhas[1]).getByText("3 un")).toBeTruthy();
    expect(within(linhas[2]).getByText("0 un")).toBeTruthy();
    // Nada de campo: estoque é a soma dos lotes, não um número digitado aqui.
    expect(within(linhas[1]).queryByDisplayValue("3")).toBeNull();
  });

  it("linha ainda não salva mostra travessão, não zero", () => {
    // Ela não existe no banco: "0 un" seria um saldo inventado.
    renderSection({
      variationDrafts: [{ ...draft(0, "Slip", ""), id: null, key: "temp-1" }],
    });

    const linhas = screen.getAllByRole("row");

    expect(within(linhas[1]).getByText("—")).toBeTruthy();
  });
});

describe("ProductVariationsSection — no celular (cartões)", () => {
  const larguraOriginal = window.innerWidth;

  function naLargura(largura: number) {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: largura });
  }

  afterEach(() => naLargura(larguraOriginal));

  it("abaixo do lg cada variação vira um cartão com o nome em cima e os campos rotulados", () => {
    // A tabela pedia ~900px: no celular eram três telas de rolagem lateral, e no
    // preço já não se sabia de qual variação era a linha.
    naLargura(375);
    renderSection();

    expect(screen.queryByRole("table")).toBeNull();
    const cartao = screen.getByTestId("variation-card-product-1");
    expect(within(cartao).getByText(/BACIA COM TAMPA TRITEC.*AZUL/i)).toBeTruthy();
    expect(within(cartao).getByLabelText(/preço/i)).toBeTruthy();
    expect(within(cartao).getByLabelText(/status/i)).toBeTruthy();
    expect(within(cartao).getByLabelText(/modelo/i)).toBeTruthy();
  });

  it("cada campo existe uma vez só — o foco no erro procura pelo id", () => {
    naLargura(375);
    renderSection();

    expect(document.querySelectorAll("#input-price-product-1")).toHaveLength(1);
    expect(document.querySelectorAll("#select-status-product-1")).toHaveLength(1);
  });

  it("o tipo da grade continua trocável, num seletor acima dos cartões", () => {
    naLargura(375);
    const { changeGradeType } = renderSection();

    fireEvent.click(screen.getByRole("combobox", { name: /trocar o tipo desta grade/i }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Cor"));

    expect(changeGradeType).toHaveBeenCalledWith(GRADE_TYPE.Model, GRADE_TYPE.Color);
  });

  it("código inválido mostra o motivo por extenso, sem depender do mouse", () => {
    naLargura(375);
    renderSection({ variationDrafts: [draft(1, "Azul", "7891234567890")] });

    expect(screen.getByText(/não é um EAN-13 válido/i)).toBeTruthy();
  });

  it("a lixeira do cartão pede a confirmação da variação já gravada", () => {
    naLargura(375);
    const setVariationToDelete = vi.fn();
    renderSection({ setVariationToDelete });

    const cartao = screen.getByTestId("variation-card-product-2");
    fireEvent.click(within(cartao).getByRole("button", { name: "Excluir variação" }));

    expect(setVariationToDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });
});
