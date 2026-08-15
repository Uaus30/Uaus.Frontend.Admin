import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "./index";

/**
 * Teste de CONTRATO da convenção de chaves de cache.
 *
 * A regra do pacote é uma só: a factory devolve apenas o PREFIXO do recurso e
 * quem consulta acrescenta os parâmetros — `[...getGetXQueryKey(), params ?? {}]`.
 *
 * O motivo é o `partialMatchKey` do React Query v5, que compara elemento a
 * elemento. Uma factory que embutisse os parâmetros faria
 * `invalidateQueries({ queryKey: getGetXQueryKey() })` produzir o filtro
 * `["X", undefined]`, que não casa com a query registrada como
 * `["X", { search, page }]`: o índice 1 diverge em tipo. O resultado é o pior
 * possível — compila, roda, não lança erro e a listagem simplesmente não
 * atualiza depois de salvar.
 *
 * Este arquivo trava a convenção para as factories atuais E para as futuras:
 * ele varre os exports do pacote, então uma factory nova fora do padrão
 * quebra o teste sem ninguém precisar lembrar de cobri-la.
 */

/** Nome + valor de cada export do pacote que representa uma chave de cache. */
const exports = Object.entries(api) as [string, unknown][];

/** Factories: funções cujo nome termina em QueryKey (ex.: getGetSalesQueryKey). */
const keyFactories = exports.filter(
  (entry): entry is [string, () => readonly unknown[]] =>
    typeof entry[1] === "function" && /QueryKey$/.test(entry[0]),
);

/** Chaves fixas exportadas como constante (ex.: COMPANY_SETTINGS_QUERY_KEY). */
const constantKeys = exports.filter(
  (entry): entry is [string, readonly unknown[]] =>
    Array.isArray(entry[1]) && /_QUERY_KEY$/.test(entry[0]),
);

describe("convenção de chaves de cache", () => {
  it("o pacote exporta factories de chave", () => {
    // Guarda contra o teste passar por vacuidade se um refactor renomear tudo.
    expect(keyFactories.length).toBeGreaterThanOrEqual(12);
  });

  it.each(keyFactories)("%s não recebe parâmetros", (_nome, factory) => {
    // Arity 0 é o que impede a variante que embute params de voltar a existir.
    expect(factory.length).toBe(0);
  });

  it.each(keyFactories)("%s devolve um prefixo só de strings", (_nome, factory) => {
    const key = factory();

    expect(Array.isArray(key)).toBe(true);
    expect(key.length).toBeGreaterThan(0);
    // Objeto ou undefined dentro do prefixo é exatamente o que quebra o
    // casamento parcial — o prefixo tem que ser estável e serializável.
    key.forEach((segment) => expect(typeof segment).toBe("string"));
  });

  it.each(constantKeys)("%s é um prefixo só de strings", (_nome, key) => {
    expect(key.length).toBeGreaterThan(0);
    key.forEach((segment) => expect(typeof segment).toBe("string"));
  });

  it.each(keyFactories)(
    "%s alcança a query parametrizada no cache real do React Query",
    (_nome, factory) => {
      // O teste que importa: não é sobre o formato da chave, é sobre o
      // comportamento do cache. Registra uma query como a aplicação registra
      // e confirma que o filtro construído pela factory a encontra.
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const prefix = factory();
      const params = { search: "teste", page: 2, limit: 20 };

      client.setQueryData([...prefix, params], { data: [] });
      client.setQueryData(["outro-recurso", params], { data: [] });

      const encontradas = client.getQueryCache().findAll({ queryKey: prefix });

      expect(encontradas).toHaveLength(1);
      client.clear();
    },
  );

  it("o filtro por prefixo alcança TODAS as páginas e buscas do mesmo recurso", () => {
    // Regressão do sintoma original: criar/editar/excluir invalidava só a
    // combinação de parâmetros da tela, deixando as demais páginas velhas.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const prefix = api.getGetPaymentMethodsQueryKey();

    client.setQueryData([...prefix, { page: 1, size: 10 }], { data: [] });
    client.setQueryData([...prefix, { page: 2, size: 10 }], { data: [] });
    client.setQueryData([...prefix, { search: "pix", page: 1, size: 10 }], { data: [] });

    expect(client.getQueryCache().findAll({ queryKey: prefix })).toHaveLength(3);
    client.clear();
  });

  it("prefixos de recursos diferentes não colidem entre si", () => {
    const prefixos = keyFactories.map(([, factory]) => JSON.stringify(factory()));

    expect(new Set(prefixos).size).toBe(prefixos.length);
  });
});
