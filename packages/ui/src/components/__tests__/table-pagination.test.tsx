import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { TablePagination } from "../table-pagination";

/**
 * O que estes testes protegem.
 *
 * O componente nasceu para unificar três rodapés de paginação que discordavam
 * entre si. O teste que mais importa é o do múltiplo exato: o formato antigo
 * decidia o "Próxima" por `data.length < limit`, e com 40 itens em páginas de
 * 20 a última página vinha cheia — o botão continuava clicável e levava a uma
 * página vazia. Se essa regra voltar a ser palpite sobre o tamanho do array em
 * vez de aritmética sobre o total, é aqui que aparece.
 */
describe("TablePagination", () => {
  beforeAll(() => {
    // O Radix Select usa APIs de ponteiro e rolagem que o jsdom não implementa.
    // Sem estes dublês, abrir o seletor de itens por página estoura antes de o
    // teste chegar à asserção.
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => undefined;
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => undefined;
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => undefined;
    }
  });

  const label = { singular: "custo fixo", plural: "custos fixos" };

  it("resume o intervalo visível, o total e o nome do que está sendo contado", () => {
    render(<TablePagination page={2} pageSize={10} total={43} onPageChange={vi.fn()} itemLabel={label} />);

    expect(screen.getByText("Mostrando 11–20 de 43 custos fixos")).toBeTruthy();
    expect(screen.getByText("Página 2 de 5")).toBeTruthy();
  });

  it("usa o singular quando existe apenas um item", () => {
    render(<TablePagination page={1} pageSize={10} total={1} onPageChange={vi.fn()} itemLabel={label} />);

    expect(screen.getByText("Mostrando 1–1 de 1 custo fixo")).toBeTruthy();
  });

  it("fecha o intervalo no total na última página parcial", () => {
    render(<TablePagination page={5} pageSize={10} total={43} onPageChange={vi.fn()} itemLabel={label} />);

    expect(screen.getByText("Mostrando 41–43 de 43 custos fixos")).toBeTruthy();
  });

  it("desabilita Próxima na última página mesmo quando ela está cheia", () => {
    // 40 itens em páginas de 20: a página 2 vem com 20 linhas, exatamente o
    // caso em que a heurística antiga liberava o botão para uma página vazia.
    const onPageChange = vi.fn();
    render(<TablePagination page={2} pageSize={20} total={40} onPageChange={onPageChange} />);

    const next = screen.getByRole("button", { name: "Próxima" });
    expect(next.hasAttribute("disabled")).toBe(true);

    fireEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("desabilita Anterior na primeira página e avança pela Próxima", () => {
    const onPageChange = vi.fn();
    render(<TablePagination page={1} pageSize={10} total={43} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("volta uma página pelo Anterior", () => {
    const onPageChange = vi.fn();
    render(<TablePagination page={3} pageSize={10} total={43} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("continua visível com uma única página, porque o total é a informação da linha", () => {
    render(<TablePagination page={1} pageSize={10} total={4} onPageChange={vi.fn()} itemLabel={label} />);

    expect(screen.getByText("Mostrando 1–4 de 4 custos fixos")).toBeTruthy();
    expect(screen.getByText("Página 1 de 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Próxima" }).hasAttribute("disabled")).toBe(true);
  });

  it("trava a página no intervalo em vez de anunciar 'Página 7 de 3'", () => {
    // Acontece ao excluir o último item da última página: o total encolhe antes
    // de o hook recuar a página.
    render(<TablePagination page={7} pageSize={10} total={25} onPageChange={vi.fn()} />);

    expect(screen.getByText("Página 3 de 3")).toBeTruthy();
    expect(screen.getByText("Mostrando 21–25 de 25")).toBeTruthy();
  });

  it("não renderiza nada quando não há itens nem seletor de tamanho", () => {
    const { container } = render(<TablePagination page={1} pageSize={10} total={0} onPageChange={vi.fn()} />);

    expect(container.querySelector("nav")).toBeNull();
  });

  it("mantém o rodapé sem itens quando há seletor, para o tamanho voltar a ser editável", () => {
    render(
      <TablePagination
        page={1}
        pageSize={100}
        total={0}
        onPageChange={vi.fn()}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Nenhum resultado")).toBeTruthy();
    expect(screen.getByLabelText("Itens por página")).toBeTruthy();
  });

  it("não mostra o seletor de tamanho sem quem trate a troca", () => {
    render(
      <TablePagination page={1} pageSize={20} total={43} onPageChange={vi.fn()} pageSizeOptions={[20, 50]} />,
    );

    expect(screen.queryByLabelText("Itens por página")).toBeNull();
  });

  it("informa o novo tamanho de página escolhido no seletor", () => {
    const onPageSizeChange = vi.fn();
    render(
      <TablePagination
        page={1}
        pageSize={20}
        total={430}
        onPageChange={vi.fn()}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Itens por página"));
    fireEvent.click(screen.getByRole("option", { name: "50" }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("não divide por zero quando o tamanho de página ainda não chegou", () => {
    render(<TablePagination page={1} pageSize={0} total={12} onPageChange={vi.fn()} />);

    // Sem a trava, `Math.ceil(12 / 0)` daria Infinity e a tela mostraria
    // "Página 1 de Infinity".
    expect(screen.getByText("Página 1 de 12")).toBeTruthy();
  });
});
