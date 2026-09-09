import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Toaster } from "../toaster";
import { toast } from "../../hooks/use-toast";

/**
 * O que estes testes protegem.
 *
 * Copiar o toast com um clique já existiu neste repositório e se perdeu numa
 * limpeza — o código lia props de erro que nenhuma tela produzia, então parecia
 * morto. O que faz a função existir é o relato de problema chegar completo:
 * clicar copia o que está escrito na tela MAIS o detalhe técnico que a frase
 * descarta, e o toast espera na tela tempo suficiente para quem clicou ver que
 * copiou. Some qualquer uma das duas metades e a função vira enfeite.
 */
describe("Toaster", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copia o que esta na tela junto com o detalhe da excecao", async () => {
    render(<Toaster appVersion="3.0.2" />);
    act(() => {
      toast({
        title: "Erro ao salvar o cupom",
        description: "Código já utilizado",
        variant: "destructive",
        error: Object.assign(new Error("Conflito"), {
          name: "ApiError",
          status: 409,
          method: "post",
          url: "/api/coupons",
          payload: { message: "Código já utilizado" },
        }),
      });
    });

    fireEvent.click(screen.getByText("Erro ao salvar o cupom"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const relatorio = writeText.mock.calls[0][0] as string;

    expect(relatorio).toContain("[ERRO] Erro ao salvar o cupom");
    expect(relatorio).toContain("Mensagem: Código já utilizado");
    expect(relatorio).toContain("Requisição: POST /api/coupons");
    expect(relatorio).toContain("Status HTTP: 409");
    expect(relatorio).toContain("Versão: 3.0.2");
  });

  it("avisa na propria marca d'agua que copiou", async () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "Cupom salvo." });
    });

    expect(screen.queryByText("Copiado")).toBeNull();
    fireEvent.click(screen.getByText("Cupom salvo."));

    await waitFor(() => expect(screen.getByText("Copiado")).toBeTruthy());
  });

  it("avisa quando a copia falha, em vez de dizer que copiou", async () => {
    // Contexto não seguro com o plano B também barrado. Mentir aqui é pior que
    // não copiar: o usuário fecha o toast achando que tem o relatório colado.
    writeText.mockRejectedValue(new Error("denied"));
    // O jsdom não implementa `execCommand`: sem defini-lo, o plano B falharia
    // por TypeError em vez de pelo motivo que o teste quer exercitar.
    Object.defineProperty(document, "execCommand", { value: vi.fn(() => false), configurable: true });

    render(<Toaster />);
    act(() => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    });

    fireEvent.click(screen.getByText("Erro ao salvar"));

    await waitFor(() => expect(screen.getByText("Falha ao copiar")).toBeTruthy());
    expect(screen.queryByText("Copiado")).toBeNull();
  });

  it("le o texto do DOM, e nao a prop — a descricao nem sempre e string", async () => {
    render(<Toaster />);
    act(() => {
      toast({
        title: "Estoque insuficiente",
        description: (
          <span>
            Restam <strong>3</strong> unidades.
          </span>
        ),
        variant: "warning",
      });
    });

    fireEvent.click(screen.getByText("Estoque insuficiente"));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain("Mensagem: Restam 3 unidades.");
  });

  it("o X fecha sem copiar — um clique nao pode fazer duas coisas", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "Cupom salvo." });
    });

    const fechar = document.querySelector("[toast-close]");
    expect(fechar).toBeTruthy();
    fireEvent.click(fechar as Element);

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText("Copiado")).toBeNull();
  });

  it("segura o toast por pelo menos 3 segundos depois do clique", async () => {
    // O toast de sucesso dura 3s. Clicando perto do fim, sem a retenção ele
    // sumiria junto com o clique e ninguém veria a confirmação.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    render(<Toaster />);
    act(() => {
      toast({ title: "Cupom salvo." });
    });

    await act(async () => {
      vi.advanceTimersByTime(2800);
    });
    expect(screen.queryByText("Cupom salvo.")).toBeTruthy();

    fireEvent.click(screen.getByText("Cupom salvo."));

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByText("Cupom salvo.")).toBeTruthy();

    // 3s de retenção + os 500ms entre fechar e sair da fila.
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByText("Cupom salvo.")).toBeNull();
  });

  it("a retencao vale tambem para o toast com duracao propria e curta", async () => {
    // O PDV passa `duration` em vários toasts. Enquanto o Radix mantinha um
    // cronômetro paralelo alimentado por essa prop, um toast de 2s fechava no
    // meio da retenção e a marca d'água sumia antes de ser lida.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    render(<Toaster />);
    act(() => {
      toast({ title: "Desconto aplicado", duration: 2000 });
    });

    fireEvent.click(screen.getByText("Desconto aplicado"));

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByText("Desconto aplicado")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByText("Desconto aplicado")).toBeNull();
  });

  it("fecha mesmo sem quadro de animacao", async () => {
    // `requestAnimationFrame` NÃO é falsificado aqui de propósito: o tempo do
    // teste avança sem que nenhum quadro seja pintado, que é o que acontece numa
    // aba em segundo plano. Enquanto o fechamento dependia do quadro, o toast
    // levantado ali ficava na tela para sempre — e no PDV isso é um aviso
    // cobrindo o caixa até alguém clicar no X.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    render(<Toaster />);
    act(() => {
      toast({ title: "Venda registrada." });
    });

    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    expect(screen.queryByText("Venda registrada.")).toBeNull();
  });

  it("sem clique, o toast respeita a duracao que o chamador pediu", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    render(<Toaster />);
    act(() => {
      toast({ title: "Desconto removido", duration: 2000 });
    });

    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(screen.queryByText("Desconto removido")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.queryByText("Desconto removido")).toBeNull();
  });
});
