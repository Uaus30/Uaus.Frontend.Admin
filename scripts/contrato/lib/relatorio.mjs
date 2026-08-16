import { PESO_REGRA, SEVERIDADES } from "./comparar.mjs";

/**
 * Apresentação do resultado: console para quem roda na mão, Markdown para o
 * resumo do GitHub Actions.
 *
 * O relatório abre pelo que a ferramenta NÃO confere. Detector que se anuncia
 * completo é pior do que detector que declara o limite: o primeiro faz o
 * revisor confiar num verde que não cobre o caso dele.
 */

/** O que este comparador não tem como conferir — sempre impresso, nunca escondido. */
export const LIMITES_CONHECIDOS = [
  "Genérico: `BackendPagedResult<T>` e afins só são conferidos no que não depende do parâmetro.",
  "Polimorfismo: `object`, `dynamic` e `JsonElement` são tratados como desconhecidos e pulados.",
  "Tipo utilitário: `Omit`, `Pick` e `Partial` do TypeScript não são resolvidos — exigiria o compilador.",
  "Payload de requisição não entra: a direção do nulo se inverte e a validação mora em atributo, não no tipo.",
  "Endpoint que devolve objeto anônimo montado no controller não tem classe para comparar.",
  "`[JsonPropertyName]`, `[JsonIgnore]` e conversor customizado por propriedade não são lidos.",
  "Só `export interface` é comparado; `export type` com união ou utilitário fica de fora.",
];

/**
 * "As dez piores" precisa ser útil, não alfabética.
 *
 * Ordena por severidade, depois pela regra mais silenciosa e depois pelo TIPO
 * que acumula mais divergências: um DTO que mente em sete campos é um problema
 * maior do que sete DTOs que mentem em um — e é nele que a próxima tela preta
 * vai aparecer.
 */
function ordenar(achados) {
  const porTipo = new Map();
  for (const a of achados) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);

  return [...achados].sort(
    (a, b) =>
      SEVERIDADES[b.severidade] - SEVERIDADES[a.severidade] ||
      (PESO_REGRA[b.regra] ?? 0) - (PESO_REGRA[a.regra] ?? 0) ||
      porTipo.get(b.tipo) - porTipo.get(a.tipo) ||
      a.tipo.localeCompare(b.tipo) ||
      a.campo.localeCompare(b.campo),
  );
}

/** Conta os achados por regra, por severidade e por tipo. */
export function resumir(achados) {
  const porRegra = new Map();
  const porSeveridade = new Map();
  const porTipo = new Map();
  for (const achado of achados) {
    porRegra.set(achado.regra, (porRegra.get(achado.regra) ?? 0) + 1);
    porSeveridade.set(achado.severidade, (porSeveridade.get(achado.severidade) ?? 0) + 1);
    porTipo.set(achado.tipo, (porTipo.get(achado.tipo) ?? 0) + 1);
  }
  return {
    porRegra: [...porRegra.entries()].sort((a, b) => b[1] - a[1]),
    porSeveridade: [...porSeveridade.entries()].sort((a, b) => SEVERIDADES[b[0]] - SEVERIDADES[a[0]]),
    porTipo: [...porTipo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}

const local = (achado, modelsRelativo) =>
  `${modelsRelativo}:${achado.linha} · ${achado.arquivoCs}:${achado.linhaCs}`;

/**
 * Texto para o terminal.
 *
 * @param {object} dados resultado da comparação, já com o veredito do baseline
 */
export function formatarConsole(dados) {
  const { contrato, resultado, portao, modelsRelativo, limite } = dados;
  const { porRegra, porSeveridade, porTipo } = resumir(resultado.achados);
  const linhas = [];

  linhas.push("Conferência de contrato — classes do backend × packages/api-client/src/models.ts");
  linhas.push(
    `Retrato: ${contrato.geradoEm}${contrato.origem.commit ? ` (commit ${contrato.origem.commit.slice(0, 7)})` : ""} · ` +
      `${contrato.tipos.length} classes · ${contrato.enums.length} enums`,
  );
  linhas.push(
    `Serialização: ${contrato.serializacao.ignoraNulos ? "nulo OMITIDO do JSON (WhenWritingNull)" : `nulo enviado (${contrato.serializacao.ignoreCondition ?? "padrão"})`}` +
      ` · enum ${contrato.serializacao.enumComoTexto ? "pelo NOME" : "pelo número"}`,
  );
  linhas.push("");
  linhas.push(
    `Pares conferidos: ${resultado.pares.length} · só no backend: ${resultado.semParNoFront.length} · só no front: ${resultado.semParNoBackend.length}`,
  );
  linhas.push(
    `Divergências: ${resultado.achados.length}` +
      (porSeveridade.length ? ` (${porSeveridade.map(([s, n]) => `${s} ${n}`).join(" · ")})` : ""),
  );
  for (const [regra, total] of porRegra) linhas.push(`  ${String(total).padStart(4)}  ${regra}`);

  // A lista campo a campo cansa; a lista por tipo diz qual arquivo abrir.
  if (porTipo.length > 0) {
    const topo = porTipo.slice(0, 8).map(([tipo, total]) => `${tipo} ${total}`);
    linhas.push(`Tipos com mais divergências: ${topo.join(" · ")}`);
  }

  const piores = ordenar(resultado.achados).slice(0, limite);
  if (piores.length > 0) {
    linhas.push("");
    linhas.push(`Piores ${piores.length} de ${resultado.achados.length}:`);
    piores.forEach((achado, i) => {
      linhas.push(
        `  ${String(i + 1).padStart(2)}. [${achado.severidade}] ${achado.regra}  ${achado.tipo}.${achado.campo}`,
      );
      linhas.push(`      ${achado.texto}`);
      linhas.push(`      ${local(achado, modelsRelativo)}`);
      linhas.push(`      conserto: ${achado.conserto}`);
    });
  }

  if (portao) {
    linhas.push("");
    linhas.push(
      `Portão: ${portao.novas.length} divergência(s) nova(s), ${portao.conhecidas} conhecida(s) no baseline, ` +
        `${portao.resolvidas.length} do baseline já resolvida(s).`,
    );
    for (const achado of portao.novas.slice(0, limite)) {
      linhas.push(`  NOVA  [${achado.severidade}] ${achado.tipo}.${achado.campo} — ${achado.texto}`);
    }
  }

  linhas.push("");
  linhas.push("O que esta conferência NÃO cobre:");
  for (const item of LIMITES_CONHECIDOS) linhas.push(`  - ${item}`);
  for (const item of resultado.limites.slice(0, 10)) linhas.push(`  - ${item}`);

  return linhas.join("\n");
}

/** Resumo em Markdown para o painel do GitHub Actions. */
export function formatarMarkdown(dados) {
  const { contrato, resultado, portao, modelsRelativo, limite } = dados;
  const { porRegra } = resumir(resultado.achados);
  const piores = ordenar(resultado.achados).slice(0, limite);

  const linhas = [
    "### Contrato do backend × models.ts",
    "",
    `Retrato de **${contrato.geradoEm}**${contrato.origem.commit ? ` (\`${contrato.origem.commit.slice(0, 7)}\`)` : ""} · ` +
      `${resultado.pares.length} classes pareadas · **${resultado.achados.length}** divergências`,
    "",
  ];

  if (porRegra.length > 0) {
    linhas.push("| Regra | Ocorrências |", "| --- | ---: |");
    for (const [regra, total] of porRegra) linhas.push(`| \`${regra}\` | ${total} |`);
    linhas.push("");
  }

  if (portao) {
    linhas.push(
      portao.novas.length === 0
        ? `Nenhuma divergência nova. Baseline: ${portao.conhecidas}${portao.resolvidas.length ? ` (${portao.resolvidas.length} já resolvidas — dá para encolher o arquivo)` : ""}.`
        : `**${portao.novas.length} divergência(s) nova(s)** fora do baseline.`,
      "",
    );
    if (portao.novas.length > 0) {
      linhas.push("| Tipo.campo | Regra | O que está errado |", "| --- | --- | --- |");
      for (const a of portao.novas.slice(0, limite)) {
        linhas.push(`| \`${a.tipo}.${a.campo}\` | \`${a.regra}\` | ${a.texto} |`);
      }
      linhas.push("");
    }
  }

  if (piores.length > 0) {
    linhas.push("<details><summary>Piores divergências do retrato atual</summary>", "");
    linhas.push("| # | Sev. | Tipo.campo | O que está errado | Onde |", "| ---: | --- | --- | --- | --- |");
    piores.forEach((a, i) => {
      linhas.push(
        `| ${i + 1} | ${a.severidade} | \`${a.tipo}.${a.campo}\` | ${a.texto} | ${local(a, modelsRelativo)} |`,
      );
    });
    linhas.push("", "</details>", "");
  }

  linhas.push("<details><summary>O que esta conferência NÃO cobre</summary>", "");
  for (const item of LIMITES_CONHECIDOS) linhas.push(`- ${item}`);
  linhas.push("", "</details>", "");

  return linhas.join("\n");
}
