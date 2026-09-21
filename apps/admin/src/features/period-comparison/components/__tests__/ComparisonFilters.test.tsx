import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COMPARISON_DIMENSION } from "@workspace/api-client-react";
import { ComparisonFilters } from "../ComparisonFilters";
import { ChangeTable } from "../ChangeTable";
import { ComparisonHelp } from "../ComparisonHelp";
import type { ComparisonRange } from "../../lib/comparison";
import { RELATORIO_DE_TESTE, linhaDeTeste } from "./fixtures";

const RANGE: ComparisonRange = {
  previousStartDate: "2026-07-24",
  previousEndDate: "2026-08-22",
  currentStartDate: "2026-08-23",
  currentEndDate: "2026-09-21",
  label: "30 dias vs 30 anteriores",
};

function renderFilters(overrides: Partial<React.ComponentProps<typeof ComparisonFilters>> = {}) {
  const props = {
    range: RANGE,
    preset: "30d" as const,
    isCustom: false,
    onSelectPreset: vi.fn(),
    onApplyCustom: vi.fn(),
    onClearCustom: vi.fn(),
    dimension: COMPARISON_DIMENSION.Category,
    onDimensionChange: vi.fn(),
    isFetching: false,
    onRefresh: vi.fn(),
    resetToken: 0,
    ...overrides,
  };

  return { props, ...render(<ComparisonFilters {...props} />) };
}

describe("ComparisonFilters", () => {
  it("mostra os dois intervalos nos gatilhos", () => {
    renderFilters();

    expect(screen.getByText("24/07/2026 → 22/08/2026")).toBeTruthy();
    expect(screen.getByText("23/08/2026 → 21/09/2026")).toBeTruthy();
  });

  it("o X avisa o pai mesmo quando já se está no preset", () => {
    // O clique zera o estado INTERNO do picker. Se o pai não for avisado, o
    // gatilho passa a dizer "Selecionar período" sobre uma consulta que não
    // mudou — e só se cura ao reabrir o calendário.
    const { props } = renderFilters();

    fireEvent.click(screen.getAllByLabelText("Limpar período")[0]);

    expect(props.onClearCustom).toHaveBeenCalled();
  });

  it("o resetToken remonta os calendários, devolvendo o rótulo ao intervalo em vigor", () => {
    const { rerender } = renderFilters();

    // Simula o que o X faz por dentro do picker: zera o rótulo sem mexer no range.
    fireEvent.click(screen.getAllByLabelText("Limpar período")[0]);
    expect(screen.getAllByText("Selecionar período").length).toBe(1);

    // O pai responde incrementando o token; a key muda e o picker remonta com o
    // `value` de verdade.
    rerender(
      <ComparisonFilters
        range={RANGE}
        preset="30d"
        isCustom={false}
        onSelectPreset={vi.fn()}
        onApplyCustom={vi.fn()}
        onClearCustom={vi.fn()}
        dimension={COMPARISON_DIMENSION.Category}
        onDimensionChange={vi.fn()}
        isFetching={false}
        onRefresh={vi.fn()}
        resetToken={1}
      />,
    );

    expect(screen.queryByText("Selecionar período")).toBeNull();
    expect(screen.getByText("24/07/2026 → 22/08/2026")).toBeTruthy();
  });
});

describe("ChangeTable", () => {
  function renderTable(changes = [linhaDeTeste({})]) {
    return render(
      <ChangeTable
        changes={changes}
        dimension={COMPARISON_DIMENSION.Category}
        search=""
        onSearchChange={vi.fn()}
        sort={{ coluna: "delta", ordem: "asc" }}
        onSort={vi.fn()}
        periodKey="a|b|c|d"
      />,
    );
  }

  it("promete a soma do período quando não há busca", () => {
    renderTable();

    expect(screen.getByText(/a soma da coluna Δ é a diferença do período/)).toBeTruthy();
  });

  it("para de prometer a soma com a busca ativa", () => {
    render(
      <ChangeTable
        changes={[linhaDeTeste({})]}
        dimension={COMPARISON_DIMENSION.Category}
        search="pot"
        onSearchChange={vi.fn()}
        sort={{ coluna: "delta", ordem: "asc" }}
        onSort={vi.fn()}
        periodKey="a|b|c|d"
      />,
    );

    // Filtrada, a coluna soma um subconjunto — e é justamente aí que alguém confere.
    expect(screen.queryByText(/a soma da coluna Δ é a diferença do período/)).toBeNull();
    expect(screen.getByText(/filtrado: a coluna Δ soma só o que está na busca/)).toBeTruthy();
  });

  it("não conta os baldes como linhas da dimensão", () => {
    renderTable([
      linhaDeTeste({ id: 1, name: "Utilidades" }),
      linhaDeTeste({ id: 2, name: "Vestuário" }),
      linhaDeTeste({ id: null, name: "Outras 45 linhas", isBucket: true }),
      linhaDeTeste({ id: null, name: "Sem item identificado", isBucket: true }),
    ]);

    expect(screen.getByText(/^2 linhas por categoria/)).toBeTruthy();
  });

  it("distingue o balde da linha de verdade", () => {
    renderTable([
      linhaDeTeste({ id: 1, name: "Utilidades" }),
      linhaDeTeste({ id: null, name: "Outras 45 linhas", isBucket: true }),
    ]);

    // Sem marca, "Outras 45 linhas" ordenado por faturamento sobe ao topo com a
    // cara da maior categoria da loja.
    expect(screen.getByText("Outras 45 linhas").className).toContain("italic");
    expect(screen.getByText("Utilidades").className).not.toContain("italic");
  });

  it("a paginação reinicia quando o período muda", () => {
    const muitas = Array.from({ length: 60 }, (_, i) => linhaDeTeste({ id: i + 1, name: `LINHA ${i}` }));

    const { rerender } = render(
      <ChangeTable
        changes={muitas}
        dimension={COMPARISON_DIMENSION.Category}
        search=""
        onSearchChange={vi.fn()}
        sort={{ coluna: "delta", ordem: "asc" }}
        onSort={vi.fn()}
        periodKey="jul|ago"
      />,
    );

    fireEvent.click(screen.getByText(/Mostrar mais/));
    expect(screen.queryByText(/Mostrar mais/)).toBeNull();

    // Trocar só as datas traz outro conjunto: sem o período na chave de reset, a
    // tabela continuava expandida no limite do conjunto anterior.
    rerender(
      <ChangeTable
        changes={muitas}
        dimension={COMPARISON_DIMENSION.Category}
        search=""
        onSearchChange={vi.fn()}
        sort={{ coluna: "delta", ordem: "asc" }}
        onSort={vi.fn()}
        periodKey="mai|jun"
      />,
    );

    expect(screen.getByText(/Mostrar mais/)).toBeTruthy();
  });
});

describe("ComparisonHelp", () => {
  it("ensina os dois limiares que o backend usa de verdade", () => {
    render(<ComparisonHelp report={RELATORIO_DE_TESTE} />);

    fireEvent.click(screen.getByText("Como ler esta tela"));

    const dialogo = screen.getByRole("dialog");

    // `EventItemDto.MinimumShare = 5` e `ResidualShare = 2`. O manual já ensinou
    // "menos da metade disso" (2,5%), que não é regra nenhuma do código.
    expect(within(dialogo).getByText(/5%/)).toBeTruthy();
    expect(within(dialogo).getByText(/abaixo de 2%/)).toBeTruthy();
  });

  it("sobrevive a um fator que o front ainda não conhece", () => {
    // Um valor novo no enum do backend não pode derrubar a rota.
    const acao = () =>
      render(
        <ComparisonHelp
          report={{
            ...RELATORIO_DE_TESTE,
            bridge: [
              {
                factor: "Discount" as never,
                previousValue: 1,
                currentValue: 2,
                changePercentage: 100,
                amount: 9999,
                shareOfMovement: 50,
              },
            ],
          }}
        />,
      );

    expect(acao).not.toThrow();
  });
});
