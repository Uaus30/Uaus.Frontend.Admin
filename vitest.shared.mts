/**
 * Configuração de cobertura compartilhada pelos seis workspaces.
 *
 * A extensão é `.mts`, e não `.ts`, por um motivo chato mas real: este arquivo
 * mora na raiz, e o `package.json` da raiz — ao contrário dos seis workspaces —
 * não declara `"type": "module"`. Como `.ts`, o carregador nativo de config do
 * Vite o trata como CommonJS e avisa em TODA execução de teste que o `import` da
 * primeira linha é sintaxe ESM em arquivo CJS. Seis workspaces × um aviso por
 * rodada é ruído que ninguém lê depois da segunda semana. `.mts` é ESM
 * independentemente do `package.json`, e o aviso some.
 *
 * Pelo mesmo carregador nativo, quem importa daqui precisa escrever a extensão
 * na mão: `import { ... } from "../../vitest.shared.mts"`.
 */
import type { TestUserConfig } from "vitest/config";

/** O bloco `coverage` que o Vitest aceita dentro de `test`, já sem o `undefined`. */
type CoverageOptions = NonNullable<TestUserConfig["coverage"]>;

/**
 * O que nunca entra na conta da cobertura.
 *
 * A lista é curta de propósito: cada exclusão esconde código do relatório, e
 * relatório que esconde código mente para quem decide o que testar em seguida.
 * Só sai daqui o que **não é código de produção**:
 *
 * - `dist`, `node_modules` e `coverage` são saída de build, não fonte;
 * - `*.config.*` é configuração de ferramenta — cobrir isso mediria o Vite;
 * - `*.d.ts` não gera uma única linha executável;
 * - teste, `__tests__` e `__mocks__` são o instrumento de medida. Incluí-los é
 *   o jeito clássico de a cobertura subir sem ninguém ter escrito um teste:
 *   o arquivo de teste sempre executa 100% de si mesmo.
 */
const SHARED_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "**/*.config.{ts,tsx,js,cjs,mjs}",
  "**/*.d.ts",
  "**/*.test.{ts,tsx}",
  "**/__tests__/**",
  "**/__mocks__/**",
];

/**
 * Monta o bloco `coverage` de um workspace.
 *
 * Existe um arquivo compartilhado, e não seis blocos copiados, porque cobertura
 * só serve para comparar se todos os workspaces mediram **a mesma coisa**. Com a
 * regra duplicada em seis lugares, bastaria um deles esquecer de excluir os
 * próprios testes para o número dele nascer inflado — e ninguém notaria, porque
 * cobertura errada não quebra build nenhum.
 *
 * Decisões que valem explicação:
 *
 * **`provider: "v8"`** — usa o contador nativo do V8 em vez de instrumentar o
 * código com Istanbul. Não reescreve o fonte antes de rodar, então o que o teste
 * executa é exatamente o que roda em produção, e o custo em tempo é quase zero.
 * Exige o pacote `@vitest/coverage-v8`, que é separado do vitest e **ainda não
 * está instalado neste monorepo** — sem ele, `vitest --coverage` para e pede a
 * instalação. `vitest run` normal, sem `--coverage`, ignora este bloco inteiro.
 *
 * **`include` explícito** — a partir do Vitest 4, quando `coverage.include` não
 * é informado, só entram na conta os arquivos que algum teste importou. Um
 * módulo sem nenhum teste simplesmente **some do relatório** em vez de aparecer
 * com 0%, e a média final vira a cobertura dos arquivos já testados: quanto
 * menos gente testa, melhor o número fica. Apontando para `src/**` o arquivo
 * intocado aparece com 0%, que é a informação que interessa.
 *
 * **`reportsDirectory` fora do workspace** — o relatório vai para
 * `<raiz>/coverage/<workspace>`, e não para `<workspace>/coverage`, por dois
 * motivos concretos. Primeiro, o `.gitignore` da raiz ignora `/coverage` e mais
 * nada; um relatório gerado dentro de `packages/core` apareceria como um monte
 * de arquivo novo no `git status`. Segundo, `npm test` roda os seis workspaces
 * em sequência e o Vitest **apaga** o `reportsDirectory` antes de cada execução:
 * com um diretório só, o sexto relatório seria o único a sobrar.
 *
 * **Sem `thresholds`** — de propósito. Nenhum limiar é honesto antes da primeira
 * medição, e um número chutado só tem dois destinos: reprovar o build hoje ou
 * ser tão baixo que não exige nada. O caminho é rodar `--coverage`, ler o
 * `coverage-summary.json` e só então travar o piso no valor que o repositório já
 * alcança — subindo-o a cada onda de testes, nunca baixando.
 *
 * @param workspace Nome da pasta do relatório em `<raiz>/coverage/`. Precisa ser
 *   único por workspace, senão dois relatórios se apagam.
 * @param extraExclude Exclusões específicas do workspace, somadas às padrão.
 *   Use para ponto de entrada (`main.tsx`) e afins — código que só existe para
 *   ligar o app no DOM e não tem o que asseverar.
 */
export function createCoverageOptions(workspace: string, extraExclude: string[] = []): CoverageOptions {
  return {
    provider: "v8",
    // `text` é o número na hora, no terminal; `html` é para navegar até a linha
    // descoberta; `json-summary` gera o coverage-summary.json, que é o que um
    // gate de CI lê sem precisar interpretar texto formatado.
    reporter: ["text", "html", "json-summary"],
    // Relativo à raiz do workspace — os seis ficam dois níveis abaixo da raiz do
    // repositório, então `../..` cai sempre no lugar certo.
    reportsDirectory: `../../coverage/${workspace}`,
    include: ["src/**/*.{ts,tsx}"],
    exclude: [...SHARED_EXCLUDE, ...extraExclude],
  };
}
