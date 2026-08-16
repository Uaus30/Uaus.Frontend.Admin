import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { CATALOG_KEYS, RESOURCE_KEYS } from "../use-catalog";

/**
 * Contrato das chaves de cache do admin.
 *
 * O que está sendo protegido: invalidar o PREFIXO de um recurso alcança tudo que
 * depende dele — a listagem paginada da feature, o catálogo completo lido pelas
 * outras telas e a busca do autocomplete.
 *
 * Antes, cada consumidor batizava sua própria chave: o mesmo
 * `getAllDepartments()` vivia sob três chaves e `getAllCategories()` sob quatro.
 * A feature que mantinha o recurso invalidava só algumas — criar um departamento
 * e ir para o editor de produtos mostrava a lista antiga.
 */

/** Registra no cache as três formas em que um recurso costuma aparecer. */
function popular(client: QueryClient, prefixo: readonly string[]) {
  client.setQueryData([...prefixo, "all"], []);
  client.setQueryData([...prefixo, "page", { page: 1 }], []);
  client.setQueryData([...prefixo, "page", { page: 2, search: "x" }], []);
  client.setQueryData([...prefixo, "search", "term"], []);
}

describe("chaves de recurso", () => {
  it("o catálogo de cada recurso vive sob o prefixo dele", () => {
    for (const [nome, catalogo] of Object.entries(CATALOG_KEYS)) {
      const prefixo = RESOURCE_KEYS[nome as keyof typeof RESOURCE_KEYS];

      expect(catalogo.slice(0, prefixo.length)).toEqual([...prefixo]);
    }
  });

  it("cada recurso tem um prefixo distinto", () => {
    const prefixos = Object.values(RESOURCE_KEYS).map((p) => p.join("/"));

    expect(new Set(prefixos).size).toBe(prefixos.length);
  });

  it("nenhum prefixo é sufixo de outro", () => {
    // `["tags"]` e `["tags","x"]` fariam a invalidação de um pegar o outro sem
    // querer. Todos os prefixos têm um segmento só, mas a regra fica travada.
    const prefixos = Object.values(RESOURCE_KEYS);

    for (const a of prefixos) {
      for (const b of prefixos) {
        if (a === b) continue;
        expect(a.join("/").startsWith(`${b.join("/")}/`)).toBe(false);
      }
    }
  });
});

describe("invalidação por prefixo", () => {
  it("alcança catálogo, listagem paginada e busca de uma vez", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    popular(client, RESOURCE_KEYS.tags);

    const encontradas = client.getQueryCache().findAll({ queryKey: RESOURCE_KEYS.tags });

    expect(encontradas).toHaveLength(4);
    client.clear();
  });

  it("não alcança outro recurso", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    popular(client, RESOURCE_KEYS.tags);
    popular(client, RESOURCE_KEYS.categories);

    expect(client.getQueryCache().findAll({ queryKey: RESOURCE_KEYS.tags })).toHaveLength(4);
    client.clear();
  });

  it("o catálogo lido por OUTRA feature é invalidado junto com a listagem", () => {
    // O sintoma original: criar um departamento atualizava a tela de
    // departamentos e deixava o editor de produtos com a lista velha.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    client.setQueryData([...RESOURCE_KEYS.departments, "page", { page: 1 }], []);
    client.setQueryData(CATALOG_KEYS.departments, []);

    client.invalidateQueries({ queryKey: RESOURCE_KEYS.departments });

    expect(client.getQueryState(CATALOG_KEYS.departments)?.isInvalidated).toBe(true);
    expect(client.getQueryState([...RESOURCE_KEYS.departments, "page", { page: 1 }])?.isInvalidated).toBe(
      true,
    );
    client.clear();
  });

  it("a busca do autocomplete é invalidada junto", () => {
    // `tags-search` não era invalidada por NINGUÉM: criar uma etiqueta pelo
    // editor de produtos não a fazia aparecer na busca da mesma tela.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const buscaKey = [...RESOURCE_KEYS.tags, "search", "caf"];

    client.setQueryData(buscaKey, []);
    client.invalidateQueries({ queryKey: RESOURCE_KEYS.tags });

    expect(client.getQueryState(buscaKey)?.isInvalidated).toBe(true);
    client.clear();
  });
});
