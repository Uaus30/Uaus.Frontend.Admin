import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdvMainMenu } from "../pdv-main-menu";

describe("PdvMainMenu", () => {
  const defaultProps = {
    usesCashRegister: true,
    sessionId: 1,
    onCloseRegister: vi.fn(),
    onStockWriteOff: vi.fn(),
    onSalesHistory: vi.fn(),
    onPerformance: vi.fn(),
    onHeldSales: vi.fn(),
    onPreferences: vi.fn(),
    onExit: vi.fn(),
  };

  beforeEach(() => {
    vi.stubEnv("VITE_APP_VERSION", "1.8.9");
    vi.stubEnv("VITE_BUILD_TIME", "2026-08-22T15:45:12Z");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Rótulos dos itens do menu aberto, na ordem da tela; o botão sanduíche (sem texto) fica de fora. */
  function itensDoMenu() {
    return screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.trim())
      .filter((rotulo): rotulo is string => Boolean(rotulo));
  }

  it("lista os itens na ordem de uso do balcão, sem o relatório", () => {
    // Ordem pedida pelo dono em 02/09/2026. O relatório saiu do menu: ele
    // continua no rodapé do histórico de vendas, que é onde o operador está
    // quando precisa dele. Com VITE_ADMIN_URL o "Painel Administrativo" aparece.
    vi.stubEnv("VITE_ADMIN_URL", "https://admin-dev.uaus.com.br");
    render(<PdvMainMenu {...defaultProps} usesCashRegister={false} />);
    fireEvent.click(screen.getByRole("button"));

    expect(itensDoMenu()).toEqual([
      "Desempenho",
      "Histórico de Vendas",
      "Vendas em Espera",
      "Baixa de Estoque",
      "Preferências",
      "Painel Administrativo",
      "Sair",
    ]);
    expect(screen.queryByRole("button", { name: /Relatório/i })).toBeNull();
  });

  it("mantém Fechar Caixa no topo na loja com controle de caixa", () => {
    render(<PdvMainMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button"));

    expect(itensDoMenu()[0]).toBe("Fechar Caixa");
    expect(itensDoMenu()[1]).toBe("Desempenho");
    expect(screen.queryByRole("button", { name: /Relatório/i })).toBeNull();
  });

  it("abre o menu ao clicar no botão e dispara a ação escolhida", () => {
    render(<PdvMainMenu {...defaultProps} />);

    // Clica no botão sanduíche para abrir o menu
    const menuButton = screen.getByRole("button");
    fireEvent.click(menuButton);

    const preferencias = screen.getByRole("button", { name: /Preferências/i });
    expect(preferencias).toBeDefined();

    fireEvent.click(preferencias);
    expect(defaultProps.onPreferences).toHaveBeenCalledTimes(1);
  });

  it("mostra versão e data de atualização no rodapé do próprio menu", () => {
    // Elas moravam num diálogo "Sobre", removido em 01/09/2026: abrir uma modal
    // para ler dois campos era um clique a mais na pergunta que o suporte faz
    // por telefone. A data vem em UTC e sai no fuso de Brasília.
    render(<PdvMainMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button"));

    // Só o número: o rótulo "Versão" já está na própria linha, à esquerda.
    expect(screen.getByTestId("menu-version").textContent).toBe("1.8.9");
    expect(screen.getByTestId("menu-updated-at").textContent).toBe("Atualizado em 22/08/2026 às 12:45:12");
    expect(screen.queryByRole("button", { name: /^Sobre$/i })).toBeNull();
  });

  it("fecha ao apontar para fora do menu", async () => {
    // Regressão de 01/09/2026: o clique-fora era uma camada `fixed inset-0`
    // dentro do cabeçalho, que tem `backdrop-blur`. Filtro de fundo cria
    // containing block para `fixed`, então a camada cobria só a faixa do
    // cabeçalho — clicar na área da venda deixava o menu aberto para sempre.
    render(
      <div>
        <PdvMainMenu {...defaultProps} />
        <main data-testid="fora">área da venda</main>
      </div>,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByRole("button", { name: /Preferências/i })).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("fora"));

    // `waitFor` porque a saída é animada (AnimatePresence): o nó só deixa o DOM
    // quando a animação termina.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Preferências/i })).toBeNull());
  });

  it("fecha com Escape", async () => {
    render(<PdvMainMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("button", { name: /Preferências/i })).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: /Preferências/i })).toBeNull());
  });

  it("não reabre ao apontar para o próprio botão que fecha", async () => {
    // O `pointerdown` global fecharia e o `click` do botão reabriria: sem a
    // guarda do container, o menu nunca fecharia pelo próprio botão.
    render(<PdvMainMenu {...defaultProps} />);

    const botao = screen.getByRole("button");
    fireEvent.click(botao);
    expect(screen.queryByRole("button", { name: /Preferências/i })).not.toBeNull();

    fireEvent.pointerDown(botao);
    fireEvent.click(botao);

    await waitFor(() => expect(screen.queryByRole("button", { name: /Preferências/i })).toBeNull());
  });
});
