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
 * Os seis workspaces que medem cobertura.
 *
 * É uma união fechada, e não `string`, porque o nome faz duas coisas ao mesmo
 * tempo: escolhe a pasta do relatório e escolhe o piso na tabela abaixo. Com
 * `string`, um erro de digitação (`"api_client"`) geraria um relatório numa
 * pasta órfã e — pior — leria um piso `undefined`, desligando o portão daquele
 * workspace em silêncio. Fechada a união, o typecheck reprova o typo.
 */
export type CoverageWorkspace = "core" | "api-client" | "ui" | "receipt" | "admin" | "pdv";

/** Piso de cada métrica, em porcentagem do total do workspace. */
type CoverageFloor = {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
};

/**
 * O piso de cobertura de cada workspace — a catraca.
 *
 * **De onde saem estes números.** Da primeira medição real, feita em 15/08/2026
 * rodando `vitest run --coverage` em cada workspace e lendo o `total` do
 * `coverage/<workspace>/coverage-summary.json`. Nenhum deles foi escolhido a
 * dedo: o comentário ao lado de cada linha traz o valor medido, e o piso é o
 * menor valor observado, **arredondado para baixo**.
 *
 * **Por que o medido, e não uma meta.** Piso acima do que o repositório alcança
 * hoje nasce vermelho, e portão que nasce vermelho é desligado na primeira
 * sexta-feira — aí some também a proteção contra regressão, que é a parte que
 * valia. O limiar aqui não diz "queremos 80%": diz "não pode piorar".
 *
 * **A folga é fina de propósito.** Arredondar para o inteiro deixa menos de um
 * ponto percentual de sobra. Isso é o que faz a catraca acusar a tela nova sem
 * teste no PR em que ela entrou, e não três ondas depois, quando ninguém mais
 * lembra de quem era o código. Quando o portão fechar, a correção é **escrever o
 * teste**. Baixar o número é uma decisão a ser defendida na revisão do PR, com
 * justificativa — nunca o conserto rápido para o build ficar verde.
 *
 * **Três pisos estão abaixo do medido, e não é descuido.** `ui`, `admin` e `pdv`
 * foram medidos duas vezes durante a mesma sessão e deram valores diferentes:
 * havia código entrando na workspace enquanto a medição rodava. O piso deles é o
 * **menor** dos valores observados, não o último, porque a medição alta dependia
 * de arquivo que ainda podia mudar — travar no pico faria o portão reprovar por
 * causa de trabalho de terceiro, que é o jeito mais rápido de a regra virar
 * ruído. O comentário de cada linha traz o valor mais recente; a diferença entre
 * ele e o piso é justamente o que a próxima remedição tem para colher.
 *
 * **Como subir (e o número só sobe).** Depois de uma onda de testes:
 * 1. rode a cobertura do workspace (`vitest run --coverage` dentro dele);
 * 2. leia `total.<métrica>.pct` no `coverage/<workspace>/coverage-summary.json`;
 * 3. arredonde para baixo e troque a linha aqui, atualizando o comentário com o
 *    novo valor medido.
 *
 * O passo 3 é uma linha de diff e é o registro de que o ganho foi travado. Sem
 * ele, a onda de testes vira folga: a cobertura sobe, o piso continua onde
 * estava, e o próximo PR pode desfazer o ganho sem o CI reclamar.
 *
 * **`core` está em 100% de linhas e funções, e isso não é enfeite.** Quer dizer
 * que uma função nova ali sem teste reprova o build. É o efeito desejado: `core`
 * é dinheiro, data e validação, não tem tela nem rede para dificultar o teste, e
 * o CLAUDE.md já manda cobrir exatamente esse tipo de código. O custo de manter
 * o 100 é um `it()`; o custo de perdê-lo é um erro de arredondamento que os dois
 * apps executam igual.
 */
const COVERAGE_FLOOR: Record<CoverageWorkspace, CoverageFloor> = {
  // medido 97.93 / 94.02 / 100 / 100 — 88 testes, o único workspace no teto
  core: { statements: 97, branches: 94, functions: 100, lines: 100 },
  // medido 41.68 / 35.19 / 20.40 / 37.81 — o mais descoberto do repositório
  "api-client": { statements: 41, branches: 35, functions: 20, lines: 37 },
  // medido 19.71 / 25.23 / 16.73 / 19.38 — 40 componentes, 4 arquivos de teste
  ui: { statements: 14, branches: 19, functions: 12, lines: 14 },
  // medido 67.97 / 82.14 / 68.08 / 70.07 — `print.ts` não roda em jsdom
  receipt: { statements: 67, branches: 82, functions: 68, lines: 70 },
  // medido 40.69 / 25.62 / 29.67 / 42.07 — 348 testes para 25 features
  admin: { statements: 40, branches: 25, functions: 29, lines: 41 },
  // medido 54.95 / 41.71 / 49.42 / 55.33 — 449 testes
  pdv: { statements: 52, branches: 41, functions: 45, lines: 52 },
};

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
 * Exige o pacote `@vitest/coverage-v8`, que é separado do vitest e já está
 * instalado. `vitest run` normal, sem `--coverage`, ignora este bloco inteiro —
 * inclusive os limiares.
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
 * **`thresholds` global, e não `perFile`** — a conta que precisa não piorar é a
 * do workspace inteiro. Com `perFile: true` o portão reprovaria em cima do
 * primeiro arquivo legado descoberto, que é a maioria deles em quatro dos seis
 * workspaces, e o único jeito de voltar ao verde seria desligar a regra. A
 * catraca global permite o movimento normal de um repositório vivo — um arquivo
 * novo pouco coberto passa se outro subiu — e ainda assim impede o saldo cair.
 *
 * **Sem `autoUpdate`** — o Vitest sabe reescrever sozinho o limiar quando a
 * cobertura sobe, e isso parece o sonho da catraca automática. Só que aí rodar
 * teste vira alteração de fonte: quem só queria ver se algo quebrou termina com
 * arquivo modificado na workspace, e o ganho entra sem ninguém decidir. Fora
 * que o `autoUpdate` procura o número literal dentro do arquivo de config, e
 * aqui ele mora numa tabela compartilhada. Subir o piso é um ato deliberado, com
 * diff e revisor.
 *
 * @param workspace Nome do workspace: escolhe a pasta do relatório em
 *   `<raiz>/coverage/` e o piso em {@link COVERAGE_FLOOR}.
 * @param extraExclude Exclusões específicas do workspace, somadas às padrão.
 *   Use para ponto de entrada (`main.tsx`) e afins — código que só existe para
 *   ligar o app no DOM e não tem o que asseverar.
 */
export function createCoverageOptions(
  workspace: CoverageWorkspace,
  extraExclude: string[] = [],
): CoverageOptions {
  return {
    provider: "v8",
    // Cópia, não a referência: entregar o objeto da tabela deixaria o Vitest com
    // uma alça para a constante compartilhada, e qualquer escrita dele (hoje só
    // o `autoUpdate`, que está desligado) vazaria de um workspace para o outro.
    thresholds: { ...COVERAGE_FLOOR[workspace] },
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
