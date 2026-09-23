import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockCountModal } from "../StockCountModal";

/** O `useStockCount` aberto, com o que a modal lê. */
function contagem(counted = "") {
  return {
    open: true,
    setOpen: vi.fn(),
    form: { counted, supplierId: "", unitCost: "", notes: "" },
    updateForm: vi.fn(),
    openCount: vi.fn(),
    counted: counted === "" ? null : Number(counted),
    countedIsValid: counted !== "",
    difference: null,
    isSaving: false,
    submit: vi.fn(),
  };
}

/** O campo do número contado. Por id: o título da modal tem o mesmo texto do rótulo. */
function campoDaContagem() {
  return document.getElementById("contagem-fisica") as HTMLInputElement;
}

function renderModal(props: { ready?: boolean; counted?: string; header?: React.ReactNode }) {
  render(
    <StockCountModal
      count={contagem(props.counted)}
      productName="COPO"
      barcode={null}
      currentStock={null}
      suppliers={[]}
      header={props.header}
      ready={props.ready}
    />,
  );
}

describe("StockCountModal — contagem aberta pela listagem", () => {
  afterEach(cleanup);

  it("sem SKU escolhido, o campo e o Registrar ficam travados", () => {
    renderModal({ ready: false, counted: "3", header: <p>escolha a variação</p> });

    expect(screen.getByText("escolha a variação")).toBeTruthy();
    expect(campoDaContagem().disabled).toBe(true);
    expect((screen.getByRole("button", { name: /registrar contagem/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("a aba Estoque não passa `ready` — continua liberada como sempre", () => {
    renderModal({ counted: "3" });

    expect(campoDaContagem().disabled).toBe(false);
    expect((screen.getByRole("button", { name: /registrar contagem/i }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
