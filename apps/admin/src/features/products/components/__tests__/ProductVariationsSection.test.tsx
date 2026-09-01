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
      handlePrintBarcode={vi.fn()}
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
