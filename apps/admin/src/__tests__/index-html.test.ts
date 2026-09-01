import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O `index.html` do Admin não pode ser traduzido pelo navegador.
 *
 * Regressão de 01/09/2026, registrada em produção como crash crítico: o app
 * declarava `lang="en"` com conteúdo em português, o Chrome da loja (em pt-BR)
 * traduzia a página automaticamente e trocava os nós de texto por wrappers
 * `<font>`. O React, que ainda referencia os nós originais, estourou
 * `NotFoundError: Failed to execute 'removeChild' on 'Node'` ao abrir
 * `/produtos?id=709` — o select de categoria é refiltrado pelo departamento na
 * abertura, e os `SelectItem` do Radix que ele remove já não eram filhos dele.
 *
 * O teste existe porque as três linhas parecem decorativas: quem não conhece a
 * história tira o `notranslate` numa limpeza e o crash volta só na máquina de
 * quem tem o navegador em outro idioma — nunca na de quem programou.
 */
/**
 * O arquivo é lido do disco porque ele NÃO passa pelo bundler nos testes.
 * `import.meta.url` não serve: o vitest não o entrega como `file://`. O cwd
 * varia entre rodar a suíte do app e a do monorepo, então os dois caminhos são
 * tentados.
 */
function lerIndexHtml(app: string): string {
  const candidatos = [resolve(process.cwd(), "index.html"), resolve(process.cwd(), `apps/${app}/index.html`)];
  const encontrado = candidatos.find(existsSync);

  if (!encontrado) throw new Error(`index.html não encontrado em: ${candidatos.join(", ")}`);
  return readFileSync(encontrado, "utf-8");
}

const html = lerIndexHtml("admin");

describe("index.html do Admin", () => {
  it("declara o idioma real do conteúdo", () => {
    // `lang` errado é o que faz o Chrome OFERECER a tradução.
    expect(html).toMatch(/<html[^>]*\blang="pt-BR"/);
    expect(html).not.toMatch(/<html[^>]*\blang="en"/);
  });

  it("recusa tradução automática, inclusive para quem já marcou 'traduzir sempre'", () => {
    expect(html).toMatch(/<html[^>]*\btranslate="no"/);
    expect(html).toMatch(/<meta\s+name="google"\s+content="notranslate"/);
  });
});
