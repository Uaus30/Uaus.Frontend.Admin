import { describe, it, expect, vi, afterEach } from "vitest";
import { buildToastReport, copyTextToClipboard, describeCurrentScreen } from "../toast-report";

/**
 * O que estes testes protegem.
 *
 * O relatório existe para encurtar o relato de problema: quem clica no toast
 * cola num card o que o suporte precisaria perguntar — rota, horário local,
 * status HTTP e resposta do servidor. O que quebra o valor dele não é a
 * aparência, é perder um desses campos em silêncio, ou travar a cópia por causa
 * de um payload que não serializa.
 */
describe("buildToastReport", () => {
  const quando = new Date(2026, 8, 9, 15, 32, 10);

  it("copia o que esta na tela, sem bloco tecnico, quando nao houve excecao", () => {
    // Recusa de validação ("selecione um fornecedor") não tem exceção nenhuma:
    // inventar linhas técnicas vazias faria o relatório parecer truncado.
    const texto = buildToastReport({
      variant: "warning",
      title: "Selecione um fornecedor",
      description: "A compra precisa de um fornecedor para ser salva.",
      screen: "admin-dev.uaus.com.br/compras/nova",
      appVersion: "3.0.2",
      occurredAt: quando,
    });

    expect(texto).toBe(
      [
        "[AVISO] Selecione um fornecedor",
        "Mensagem: A compra precisa de um fornecedor para ser salva.",
        "Quando: 09/09/2026, 15:32:10",
        "Tela: admin-dev.uaus.com.br/compras/nova",
        "Versão: 3.0.2",
      ].join("\n"),
    );
  });

  it("anexa requisicao, status e resposta quando o erro veio da API", () => {
    const erro = Object.assign(new Error("Conflito"), {
      name: "ApiError",
      status: 409,
      method: "post",
      url: "/api/coupons",
      payload: { message: "Código já utilizado" },
    });

    const texto = buildToastReport({
      variant: "destructive",
      title: "Erro ao salvar o cupom",
      description: "Código já utilizado",
      error: erro,
      occurredAt: quando,
    });

    expect(texto).toContain("[ERRO] Erro ao salvar o cupom");
    expect(texto).toContain("Requisição: POST /api/coupons");
    expect(texto).toContain("Status HTTP: 409");
    expect(texto).toContain("Exceção: ApiError: Conflito");
    expect(texto).toContain('Resposta: {"message":"Código já utilizado"}');
  });

  it("data e hora sao locais, nunca UTC", () => {
    // O horário do relatório é comparado com o do WhatsApp da loja. Em ISO, um
    // erro das 15h apareceria como 18h e ninguém acharia o registro.
    const texto = buildToastReport({ title: "Falhou", occurredAt: quando });

    expect(texto).toContain("Quando: 09/09/2026");
    expect(texto).not.toContain("2026-09-09T");
  });

  it("guarda a pilha do erro de runtime, e nao a do erro HTTP", () => {
    // Em ApiError a pilha aponta sempre para a mesma linha do cliente HTTP e não
    // diz nada; num erro de tela ela é a única pista que existe.
    const runtime = new Error("x is not a function");
    runtime.stack = "Error: x is not a function\n    at Tela (tela.tsx:42:7)";

    const doRuntime = buildToastReport({ title: "Quebrou", error: runtime, occurredAt: quando });
    expect(doRuntime).toContain("Pilha:");
    expect(doRuntime).toContain("at Tela (tela.tsx:42:7)");

    const doHttp = buildToastReport({
      title: "Quebrou",
      error: Object.assign(new Error("Erro"), { status: 500, stack: "Error\n    at client.ts:1:1" }),
      occurredAt: quando,
    });
    expect(doHttp).not.toContain("Pilha:");
  });

  it("trunca resposta gigante em vez de encher a area de transferencia", () => {
    const texto = buildToastReport({
      title: "Falhou",
      error: { status: 500, payload: "x".repeat(5000) },
      occurredAt: quando,
    });

    expect(texto).toContain("… (truncado)");
    expect(texto.length).toBeLessThan(1500);
  });

  it("nao deixa payload circular impedir a copia", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const texto = buildToastReport({
      title: "Falhou",
      error: { status: 500, payload: circular },
      occurredAt: quando,
    });

    expect(texto).toContain("Resposta: (resposta não serializável)");
  });

  it("aceita erro que nao e objeto", () => {
    expect(buildToastReport({ title: "Falhou", error: "deu ruim", occurredAt: quando })).toContain(
      "Exceção: deu ruim",
    );
  });
});

describe("describeCurrentScreen", () => {
  it("junta host, caminho e busca — o host separa producao de dev e admin de PDV", () => {
    expect(describeCurrentScreen()).toBe(
      `${window.location.host}${window.location.pathname}${window.location.search}`,
    );
  });
});

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("usa a area de transferencia do navegador quando ela existe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard("relatório")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("relatório");
  });

  it("cai para o campo oculto sem a API de clipboard", async () => {
    // Um terminal alcançado pelo IP da rede da loja roda em contexto não seguro,
    // onde `navigator.clipboard` simplesmente não existe — e é onde a cópia mais
    // serve. Sem o plano B, clicar no toast não faria nada ali.
    vi.stubGlobal("navigator", {});
    const execCommand = stubExecCommand();

    await expect(copyTextToClipboard("relatório")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("recorre ao campo oculto quando o navegador recusa a permissao", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const execCommand = stubExecCommand();

    await expect(copyTextToClipboard("relatório")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalled();
  });
});

/**
 * O jsdom não implementa `execCommand`.
 *
 * Sem defini-lo, o plano B falharia por TypeError — que o `catch` do
 * `copyTextToClipboard` engole — e o teste passaria sem exercitar nada.
 */
function stubExecCommand() {
  const execCommand = vi.fn().mockReturnValue(true);
  Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
  return execCommand;
}
