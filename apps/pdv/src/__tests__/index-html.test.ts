import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O `index.html` do PDV não pode ser traduzido pelo navegador.
 *
 * Mesma armadilha que derrubou o Admin em 01/09/2026: com `lang="en"` e
 * conteúdo em português, o Chrome traduz sozinho, troca os nós de texto por
 * wrappers `<font>` e o React estoura `removeChild` na primeira lista que muda.
 * No balcão o custo é maior — a tela que quebra é a da venda.
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

const html = lerIndexHtml("pdv");

describe("index.html do PDV", () => {
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
