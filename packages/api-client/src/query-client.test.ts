import { describe, expect, it } from "vitest";
import { createQueryClient, STALE_TIME } from "./query-client";

describe("createQueryClient", () => {
  it("aplica a política padrão sem precisar de configuração", () => {
    const queries = createQueryClient().getDefaultOptions().queries;

    expect(queries?.retry).toBe(false);
    expect(queries?.staleTime).toBe(STALE_TIME.operacao);
  });

  it("deixa o app sobrescrever uma opção sem perder as outras", () => {
    // A mesclagem é rasa em `queries`: passar só o staleTime não pode apagar o
    // `retry: false`, ou o PDV voltaria a insistir na rede em vez de cair para a
    // base local.
    const queries = createQueryClient({
      defaultOptions: { queries: { staleTime: STALE_TIME.referencia } },
    }).getDefaultOptions().queries;

    expect(queries?.staleTime).toBe(STALE_TIME.referencia);
    expect(queries?.retry).toBe(false);
  });

  it("preserva as opções de mutation que o app declarar", () => {
    const client = createQueryClient({ defaultOptions: { mutations: { retry: 2 } } });

    expect(client.getDefaultOptions().mutations?.retry).toBe(2);
    expect(client.getDefaultOptions().queries?.retry).toBe(false);
  });

  it("cada chamada devolve um cliente próprio", () => {
    // Compartilhar instância entre apps (ou entre testes) vazaria cache de um
    // para o outro.
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});

describe("STALE_TIME", () => {
  it("as escalas crescem de operação para referência", () => {
    // A ordem é a garantia de que os nomes significam o que dizem: dado de
    // operação nunca pode envelhecer mais devagar que catálogo.
    expect(STALE_TIME.operacao).toBeLessThan(STALE_TIME.catalogo);
    expect(STALE_TIME.catalogo).toBeLessThan(STALE_TIME.referencia);
  });

  it("os valores estão em milissegundos", () => {
    // Trocar ms por segundos aqui deixaria todo o cache com 1/1000 da validade,
    // e o sintoma seria só "o app ficou lento".
    expect(STALE_TIME.operacao).toBe(30_000);
    expect(STALE_TIME.catalogo).toBe(300_000);
    expect(STALE_TIME.referencia).toBe(1_800_000);
  });
});
