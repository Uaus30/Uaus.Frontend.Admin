import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SupplierDto } from "@workspace/api-client-react";
import { PurchasesTable } from "../PurchasesTable";
import type { PurchaseDto } from "../../types";

/** Uma compra na listagem; `status` no formato que a API manda. */
function compra(overrides: Record<string, unknown> = {}): PurchaseDto {
  return {
    id: 7,
    createdAt: "2026-09-12T10:00:00",
    supplierId: 1,
    supplierName: "Shopee",
    productId: 963,
    productGroupId: 805,
    productName: "SACOLA KRAFT GRANDE",
    purchaseDate: "2026-09-12T00:00:00",
    quantity: 20,
    grossTotal: 90,
    finalTotal: 90,
    unitGross: 4.5,
    unitFinal: 4.5,
    adjustmentPercent: 0,
    status: "InTransit",
    images: [],
    items: [],
    costSplitManual: false,
    ...overrides,
  } as unknown as PurchaseDto;
}

const FORNECEDORES = [
  { id: 1, name: "Shopee" },
  { id: 4, name: "Atacado" },
] as unknown as SupplierDto[];

function renderTable(items: PurchaseDto[], onEdit = vi.fn(), supplierFilter = "all") {
  render(
    <PurchasesTable
      items={items}
      isLoading={false}
      searchValue=""
      setSearch={vi.fn()}
      statusFilter="open"
      setStatusFilter={vi.fn()}
      supplierFilter={supplierFilter}
      setSupplierFilter={vi.fn()}
      suppliers={FORNECEDORES}
      page={1}
      totalPages={1}
      setPage={vi.fn()}
      onEdit={onEdit}
      onDelete={vi.fn()}
      onSetStatus={vi.fn()}
      onReceive={vi.fn()}
      mutatingId={null}
    />,
  );
  return { onEdit };
}

describe("PurchasesTable — no celular (06/10/2026)", () => {
  it("fornecedor, quantidade e situação vêm embaixo do nome", () => {
    // Eram cinco colunas rolando de lado, com a situação e o menu fora da tela.
    renderTable([compra()]);

    const linha = screen.getByTestId("purchase-row");
    const resumo = within(linha).getByText("· 20 un").parentElement!;
    expect(resumo.className).toContain("lg:hidden");
    expect(within(resumo).getByText("Shopee")).toBeTruthy();
    expect(within(resumo).getByText("A caminho")).toBeTruthy();
  });

  it("o recebimento travado diz o motivo por extenso — no toque não há title", () => {
    renderTable([compra({ status: "Pending" })]);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Opções da compra 7" }), {
      button: 0,
      ctrlKey: false,
    });

    const item = screen.getByRole("menuitem", { name: /lançar recebimento/i });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(within(item).getByText("Marque como a caminho antes")).toBeTruthy();
  });
});

describe("PurchasesTable — instruções de recebimento (22/10/2026)", () => {
  it("a compra com instruções mostra o ícone pulsando; sem instruções, nada", () => {
    renderTable([compra({ receivingInstructions: "Vender avulso" }), compra({ id: 8 })]);

    const icones = screen.getAllByTestId("receiving-instructions-icon");
    expect(icones).toHaveLength(1);
    expect(icones[0].getAttribute("aria-label")).toBe("Instruções de recebimento: Vender avulso");
    expect(icones[0].querySelector("svg")?.getAttribute("class")).toContain("animate-pulse");
  });

  it("o clique no ícone mostra o texto e NÃO abre a compra", async () => {
    const { onEdit } = renderTable([compra({ receivingInstructions: "Atualizar o código de barras" })]);

    fireEvent.click(screen.getByTestId("receiving-instructions-icon"));

    expect(onEdit).not.toHaveBeenCalled();
    const textos = await screen.findAllByText("Atualizar o código de barras");
    expect(textos.length).toBeGreaterThan(0);

    // O conteúdo do tooltip vai para um portal, mas o clique nele sobe pela
    // árvore do React: sem o bloqueio, tocar no texto abria a compra.
    fireEvent.click(textos[0]);
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("PurchasesTable — filtro de fornecedor (22/10/2026)", () => {
  it("sem filtro, o select diz todos os fornecedores", () => {
    renderTable([compra()]);
    expect(
      within(screen.getByRole("combobox", { name: "Fornecedor" })).getByText("Todos os fornecedores"),
    ).toBeTruthy();
  });

  it("com filtro lembrado, o select mostra o fornecedor e fica destacado", () => {
    renderTable([compra()], vi.fn(), "4");
    const select = screen.getByRole("combobox", { name: "Fornecedor" });
    expect(within(select).getByText("Atacado")).toBeTruthy();
    expect(select.className).toContain("border-primary/60");
  });
});

describe("PurchasesTable — cor da margem em quatro faixas (22/10/2026)", () => {
  // Custo 4,50: a 7,50 a margem é 40%; a 6,80, 33,8%; a 5,80, 22,4%; a 5,00, 10%.
  it.each([
    [7.5, "text-emerald-600"],
    [6.8, "text-lime-600"],
    [5.8, "text-orange-600"],
    [5, "text-red-600"],
  ])("custo 4,50 vendido a %s pinta %s", (preco, cor) => {
    renderTable([compra({ suggestedPrice: preco })]);
    expect(screen.getByTitle(/Sobre o preço sugerido/).className).toContain(cor);
  });
});

describe("PurchasesTable — Custo, Preço e Margem (22/10/2026)", () => {
  it("o cabeçalho diz Custo e Preço, nessa ordem, antes da Margem", () => {
    renderTable([compra()]);
    const cabecalhos = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(cabecalhos.slice(3, 6)).toEqual(["Custo", "Preço", "Margem"]);
    expect(cabecalhos).not.toContain("Unit. final");
  });

  it("o custo não mostra mais o percentual de desconto ou acréscimo", () => {
    renderTable([compra({ grossTotal: 100, adjustmentPercent: -10 })]);
    // O `Intl` separa "R$" do número com espaço não separável.
    expect(screen.getByTestId("purchase-cost").textContent?.replace(/\s/g, " ")).toBe("R$ 4,50");
  });

  it("o preço é o sugerido na compra e, sem ele, o atual do produto", () => {
    renderTable([compra({ suggestedPrice: 7.5, productPrice: 9 }), compra({ id: 8, productPrice: 9 })]);
    const precos = screen.getAllByTestId("purchase-price").map((td) => td.textContent?.replace(/\s/g, " "));
    expect(precos).toEqual(["R$ 7,50", "R$ 9,00"]);
  });

  it("sem preço nenhum, traço — nunca R$ 0,00", () => {
    renderTable([compra()]);
    expect(screen.getByTestId("purchase-price").textContent).toBe("—");
  });
});
