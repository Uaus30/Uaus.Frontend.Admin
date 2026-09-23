import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductAnomalyTypeName } from "@workspace/api-client-react";
import { AnomalyRow } from "../AnomalyRow";
import { AnomalyTag } from "../AnomalyTag";
import { AnomalyFilters } from "../AnomalyFilters";
import { AnomalyList } from "../AnomalyList";
import { AnomaliesHelp } from "../AnomaliesHelp";
import { bexiga, cumbuca, jarra, relatorio } from "../../__tests__/fixtures";

afterEach(() => cleanup());

describe("AnomalyTag", () => {
  it("sai com ícone e texto — cor nunca sozinha", () => {
    const { container } = render(<AnomalyTag type="PhantomStock" />);

    expect(screen.getByText("Estoque fantasma")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("tipo desconhecido vira etiqueta neutra em vez de quebrar", () => {
    render(<AnomalyTag type="AlgoNovoDoBackend" />);

    expect(screen.getByText("Anomalia")).toBeTruthy();
  });
});

describe("AnomalyRow", () => {
  it("o nome leva ao cadastro do GRUPO, em nova aba", () => {
    render(
      <ul>
        <AnomalyRow row={cumbuca} />
      </ul>,
    );

    const link = screen.getByRole("link", { name: /Abrir CUMBUCA .* no cadastro, em nova aba/ });
    expect(link.getAttribute("href")).toMatch(/produtos\/851\/detalhes$/);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("cada anomalia vem com a evidência e o que fazer", () => {
    render(
      <ul>
        <AnomalyRow row={cumbuca} />
      </ul>,
    );

    expect(screen.getByText("Estoque fantasma")).toBeTruthy();
    expect(screen.getByText(/a loja fez 31 vendas sem ele/)).toBeTruthy();
    expect(screen.getAllByText(/Contagem Física/).length).toBeGreaterThan(0);
    expect(screen.getByText("Sem foto")).toBeTruthy();
  });

  it("o estoque fantasma e o custo zerado levam à aba Estoque da variação", () => {
    render(
      <ul>
        <AnomalyRow row={cumbuca} />
        <AnomalyRow row={bexiga} />
      </ul>,
    );

    const contar = screen.getByRole("link", { name: /Contar: abrir a aba Estoque/ });
    expect(contar.getAttribute("href")).toMatch(/produtos\/851\/detalhes\?aba=estoque&variacao=1021$/);

    const custo = screen.getByRole("link", {
      name: /Corrigir custo: abrir a aba Estoque de BEXIGA \[AZUL\]/,
    });
    expect(custo.getAttribute("href")).toMatch(/produtos\/1\/detalhes\?aba=estoque&variacao=10$/);
  });

  it("nome repetido leva aos outros cadastros, e a variação aparece quando há variações", () => {
    render(
      <ul>
        <AnomalyRow row={bexiga} />
      </ul>,
    );

    expect(screen.getByRole("link", { name: /o outro cadastro de mesmo nome, #935/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /o outro cadastro de mesmo nome, #936/ })).toBeTruthy();
    expect(screen.getByText("BEXIGA [AZUL]")).toBeTruthy();
  });

  it("sem foto no cadastro, mostra o marcador em vez de imagem quebrada", () => {
    const { container } = render(
      <ul>
        <AnomalyRow row={cumbuca} />
      </ul>,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("3 em estoque")).toBeTruthy();
  });

  it("custo zero numa entrada anterior não oferece 'Corrigir custo', que levaria a um lápis que não existe", () => {
    const escondido = {
      ...bexiga,
      anomalies: [
        {
          type: "ZeroCost" as const,
          productId: 10,
          productName: "BEXIGA [AZUL]",
          costPrice: 0.03,
          stock: 70,
          zeroCostUnits: 50,
          lastEntryId: 1200,
          zeroCostEntryId: 1011,
        },
      ],
    };
    render(
      <ul>
        <AnomalyRow row={escondido} />
      </ul>,
    );

    expect(screen.getByText("Custo zerado")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Corrigir custo/ })).toBeNull();
  });
});

describe("AnomalyFilters", () => {
  const counts = new Map<ProductAnomalyTypeName, number>(relatorio.counts.map((c) => [c.type, c.groups]));

  function renderFilters(overrides: Partial<Parameters<typeof AnomalyFilters>[0]> = {}) {
    const props = {
      counts,
      total: 3,
      type: null,
      onToggleType: vi.fn(),
      onClearType: vi.fn(),
      search: "",
      onSearchChange: vi.fn(),
      isFetching: false,
      onRefresh: vi.fn(),
      ...overrides,
    };
    render(<AnomalyFilters {...props} />);
    return props;
  }

  it("uma pastilha por tipo com ocorrência, na ordem da gravidade", () => {
    renderFilters();

    const pastilhas = screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent);
    expect(pastilhas).toEqual([
      "Preço abaixo do custo1",
      "Estoque fantasma1",
      "Custo zerado1",
      "Sem foto1",
      "Nome repetido1",
    ]);
    expect(screen.queryByText("Fora do site")).toBeNull();
  });

  it("clicar na pastilha filtra; 'Todas' limpa", () => {
    const props = renderFilters({ type: "ZeroCost" });

    fireEvent.click(screen.getByRole("button", { name: /Estoque fantasma/ }));
    expect(props.onToggleType).toHaveBeenCalledWith("PhantomStock");

    fireEvent.click(screen.getByRole("button", { name: /Todas/ }));
    expect(props.onClearType).toHaveBeenCalled();
  });

  it("a pastilha ATIVA continua na tela quando o tipo zera, para o filtro poder ser desligado", () => {
    // Corrigido o último cadastro do tipo e recarregada a lista, a contagem some;
    // sem a pastilha, a lista ficaria vazia sem nada aceso que explicasse por quê.
    const props = renderFilters({ type: "HiddenFromStorefront" });

    const ativa = screen.getByRole("button", { name: /Fora do site/, pressed: true });
    expect(ativa.textContent).toBe("Fora do site0");

    fireEvent.click(ativa);
    expect(props.onToggleType).toHaveBeenCalledWith("HiddenFromStorefront");
  });

  it("o botão de recarregar recarrega, e gira enquanto busca", () => {
    const props = renderFilters({ isFetching: true });

    const botao = screen.getByRole("button", { name: "Recarregar as anomalias" });
    fireEvent.click(botao);

    expect(props.onRefresh).toHaveBeenCalled();
    expect(botao.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
  });
});

describe("AnomalyList", () => {
  it("lista as linhas e conta os cadastros", () => {
    render(<AnomalyList items={[jarra, cumbuca]} isFiltered={false} filterKey="" />);

    // Um link "no cadastro" por linha — as anomalias da linha também são itens de lista.
    expect(screen.getAllByRole("link", { name: /no cadastro, em nova aba/ })).toHaveLength(2);
    expect(screen.getByText("2 cadastros para corrigir")).toBeTruthy();
  });

  it("filtro sem resultado diz que é o filtro", () => {
    render(<AnomalyList items={[]} isFiltered filterKey="x" />);

    expect(screen.getByText("Nenhum cadastro corresponde ao filtro.")).toBeTruthy();
  });

  it("mostra 30 e oferece o resto", () => {
    const muitas = Array.from({ length: 35 }, (_, i) => ({ ...jarra, productGroupId: i + 1 }));
    render(<AnomalyList items={muitas} isFiltered={false} filterKey="" />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais 5" }));

    expect(screen.getByText("35 cadastros para corrigir")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mostrar mais/ })).toBeNull();
  });
});

describe("AnomaliesHelp", () => {
  it("o manual fala com os números da regra que o servidor mandou", () => {
    render(<AnomaliesHelp rules={{ ...relatorio.rules, lowStockMinUnits: 7, phantomMinWindowSales: 4 }} />);

    fireEvent.click(screen.getByRole("button", { name: /Como ler esta tela/ }));
    const dialogo = screen.getByRole("dialog");

    expect(within(dialogo).getByText(/menos de 7/)).toBeTruthy();
    expect(within(dialogo).getByText(/ao menos/).textContent).toContain("4");
    expect(within(dialogo).getByText(/Produto inativo com estoque zerado não aparece/)).toBeTruthy();
  });
});
