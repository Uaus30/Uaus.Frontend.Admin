import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import { ProductTable } from "../ProductTable";
import { productDetailPathname } from "../../product-detail-route";
import type { ProductTableRow } from "../../types";

/** Uma linha da listagem, no formato que a tabela consome. */
function row(overrides: Partial<ProductTableRow> = {}): ProductTableRow {
  return {
    id: 987,
    productGroupId: 825,
    name: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
    productName: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
    description: null,
    barcode: "7891234567890",
    price: 9.9,
    costPrice: 5,
    stock: 3,
    minStock: 0,
    status: PRODUCT_STATUS.Active,
    variationCount: 2,
    variations: [
      {
        id: 986,
        name: "COPO INFANTIL PLÁSTICO COM ESTAMPA [AZUL]",
        price: 9.9,
        stock: 3,
        status: PRODUCT_STATUS.Active,
      },
      {
        id: 987,
        name: "COPO INFANTIL PLÁSTICO COM ESTAMPA [VERDE]",
        price: 11.5,
        stock: 12,
        status: PRODUCT_STATUS.Inactive,
      },
    ],
    productGroup: {
      id: 825,
      name: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
      description: null,
      hasVariations: true,
      showOnSite: true,
    },
    category: { id: 5, name: "Utilidades" },
    department: { id: 2, name: "Casa" },
    tags: [],
    images: [],
    ...overrides,
  };
}

function renderTable(overrides: Partial<React.ComponentProps<typeof ProductTable>> = {}) {
  const onEdit = vi.fn();

  render(
    <ProductTable
      isLoading={false}
      search=""
      setSearch={vi.fn()}
      setDepartmentId={vi.fn()}
      departments={[]}
      setCategoryId={vi.fn()}
      categories={[]}
      setStatus={vi.fn()}
      statusOptions={[]}
      onResetFilters={vi.fn()}
      page={1}
      setPage={vi.fn()}
      limit={20}
      setLimit={vi.fn()}
      totalPages={1}
      productPageTotal={1}
      enrichedProducts={[row()]}
      onEdit={onEdit}
      onOpenStock={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

  return { onEdit };
}

describe("ProductTable — nome do produto", () => {
  afterEach(cleanup);

  it("o nome é um link para o detalhe do GRUPO", () => {
    // Regressão: o nome era um `<td onClick>`. Ctrl+clique, botão do meio e
    // "abrir em nova aba" do menu do navegador não passam por onClick — a
    // listagem prendia a pessoa numa aba só.
    renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });

    // O id da rota é o do GRUPO (825), não o do produto representante (987).
    // `getAttribute`, e não `toHaveAttribute`: este repo não carrega os matchers
    // do jest-dom.
    expect(link.getAttribute("href")).toBe(productDetailPathname(825));
  });

  it("clique simples abre pela SPA, sem deixar o navegador navegar", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    const evento = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(evento);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it("ctrl+clique NÃO abre na SPA — quem abre a nova aba é o navegador", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    fireEvent.click(link, { ctrlKey: true });

    // Chamar `onEdit` aqui trocaria a tela ANTES de a nova aba abrir, e o
    // `preventDefault` que vem junto cancelaria a aba que a pessoa pediu.
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("cmd+clique também é do navegador", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    fireEvent.click(link, { metaKey: true });

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("shift+clique abre em janela nova, também sem a SPA no caminho", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    fireEvent.click(link, { shiftKey: true });

    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("ProductTable — variações aninhadas", () => {
  afterEach(cleanup);

  it("o rótulo VARIAÇÕES abre a lista embaixo da linha, somente leitura", () => {
    // Pedido do dono (12/09/2026): a linha resume o grupo (preço de uma
    // variação, soma do estoque) e não dizia o que havia dentro. Abrir exigia
    // entrar no cadastro.
    // O estoque da linha é a SOMA (3 + 12), como o servidor manda desde
    // 12/09/2026 — por isso ele não colide com o de nenhuma variação.
    renderTable({ enrichedProducts: [row({ stock: 15 })] });

    // Duas entradas, no preço e no estoque — as duas colunas em que a linha
    // resume várias variações.
    const botoes = screen.getAllByRole("button", { name: /variações/i });
    expect(botoes.length).toBe(2);
    expect(screen.queryByRole("columnheader", { name: /^variação$/i })).toBeNull();

    fireEvent.click(botoes[0]);

    expect(screen.getByRole("columnheader", { name: /^variação$/i })).toBeTruthy();
    expect(screen.getByText("COPO INFANTIL PLÁSTICO COM ESTAMPA [AZUL]")).toBeTruthy();
    expect(screen.getByText("COPO INFANTIL PLÁSTICO COM ESTAMPA [VERDE]")).toBeTruthy();
    // O estoque da linha é a soma; o de cada variação vai na sublista.
    expect(screen.getByText("15 un")).toBeTruthy();
    expect(screen.getByText("3 un")).toBeTruthy();
    expect(screen.getByText("12 un")).toBeTruthy();
    // Categoria e etiquetas ficaram de fora da sublista a pedido do dono: a
    // categoria repetiria a da linha de cima em toda variação.
    const sublista = screen.getByRole("columnheader", { name: /^variação$/i }).closest("table")!;
    expect(
      within(sublista)
        .getAllByRole("columnheader")
        .map((coluna) => coluna.textContent),
    ).toEqual(["Variação", "Departamento", "Preço", "Estoque", "Status"]);
  });

  it("clicar de novo fecha", () => {
    renderTable();

    const botao = screen.getAllByRole("button", { name: /variações/i })[1];
    fireEvent.click(botao);
    expect(screen.getByText("COPO INFANTIL PLÁSTICO COM ESTAMPA [AZUL]")).toBeTruthy();

    fireEvent.click(botao);
    expect(screen.queryByText("COPO INFANTIL PLÁSTICO COM ESTAMPA [AZUL]")).toBeNull();
  });

  it("produto simples não tem o que abrir", () => {
    renderTable({
      enrichedProducts: [
        row({
          variationCount: 1,
          variations: [],
          productGroup: {
            id: 825,
            name: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
            description: null,
            hasVariations: false,
            showOnSite: true,
          },
        }),
      ],
    });

    expect(screen.queryByRole("button", { name: /variações/i })).toBeNull();
  });
});
