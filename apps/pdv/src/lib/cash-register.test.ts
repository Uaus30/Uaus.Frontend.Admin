import { describe, expect, it } from "vitest";
import { canCloseRegister, parseCashAmount } from "./cash-register";

describe("canCloseRegister", () => {
  it("permite fechar com sessão aberta e fila vazia", () => {
    expect(canCloseRegister({ sessionId: 7, queuedCount: 0 })).toEqual({ allowed: true });
  });

  it("BLOQUEIA com movimento pendente na fila", () => {
    // REGRESSÃO: esta regra existia só num JSDoc órfão, sem implementação
    // nenhuma. Fechar com venda na fila produz conferência de gaveta que não
    // fecha, e o backend recusa depois a venda numa sessão já encerrada — o
    // dinheiro entrou e a venda não existe em lugar nenhum.
    expect(canCloseRegister({ sessionId: 7, queuedCount: 1 })).toEqual({
      allowed: false,
      reason: "fila-pendente",
    });
  });

  it("bloqueia com muitos movimentos pendentes", () => {
    expect(canCloseRegister({ sessionId: 7, queuedCount: 42 })).toEqual({
      allowed: false,
      reason: "fila-pendente",
    });
  });

  it("bloqueia sem sessão aberta — não há o que fechar", () => {
    expect(canCloseRegister({ sessionId: null, queuedCount: 0 })).toEqual({
      allowed: false,
      reason: "sem-sessao",
    });
  });

  it("a ausência de sessão vence a fila pendente", () => {
    // Sem sessão não faz sentido falar de fechamento; a mensagem tem que ser
    // essa, não "resolva a fila".
    expect(canCloseRegister({ sessionId: null, queuedCount: 3 })).toEqual({
      allowed: false,
      reason: "sem-sessao",
    });
  });
});

describe("parseCashAmount", () => {
  it("trata campo vazio como zero", () => {
    // Abrir o caixa sem fundo de troco é legítimo — obrigar a digitar "0" só
    // atrasaria o balcão.
    expect(parseCashAmount("")).toEqual({ value: 0 });
    expect(parseCashAmount("   ")).toEqual({ value: 0 });
  });

  it("lê o formato pt-BR", () => {
    expect(parseCashAmount("150,00")).toEqual({ value: 150 });
    expect(parseCashAmount("1.234,56")).toEqual({ value: 1234.56 });
  });

  it("recusa texto ilegível em vez de mandar NaN para a API", () => {
    // REGRESSÃO: os dois diálogos de caixa chamavam parseAmount direto, e
    // parseAmount("abc") devolve NaN — que ia inteiro para o servidor.
    expect(parseCashAmount("abc")).toEqual({ error: "invalido" });
    expect(parseCashAmount("R$")).toEqual({ error: "invalido" });
  });

  it("recusa valor negativo", () => {
    expect(parseCashAmount("-10,00")).toEqual({ error: "negativo" });
  });

  it("aceita zero explícito", () => {
    expect(parseCashAmount("0")).toEqual({ value: 0 });
    expect(parseCashAmount("0,00")).toEqual({ value: 0 });
  });

  it("arredonda para duas casas", () => {
    expect(parseCashAmount("10,005")).toEqual({ value: 10.01 });
  });
});
