#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEVERIDADES_DO_PORTAO, compararContrato } from "./lib/comparar.mjs";
import { formatarJson } from "./lib/json-formatado.mjs";
import { dataDeHoje } from "./lib/hoje.mjs";
import { formatarConsole, formatarMarkdown } from "./lib/relatorio.mjs";
import { parseTypeScriptFile } from "./lib/parse-typescript.mjs";

/**
 * Confere os DTOs escritos à mão em `packages/api-client/src/models.ts` contra o
 * retrato do contrato do backend.
 *
 * O portão é por BASELINE, e isso é uma decisão, não uma preguiça. Hoje o
 * `models.ts` já nasce com dezenas de campos `T | null` sem `?` — herança de
 * quando ninguém sabia do `WhenWritingNull`. Um portão que reprovasse tudo isso
 * nasceria vermelho, seria marcado como "não obrigatório" na primeira semana e
 * deixaria de existir. Com baseline, ele nasce VERDE e reprova só o que for
 * escrito de errado a partir de agora — que é o comportamento que faz um portão
 * sobreviver.
 *
 * Saída: 0 tudo certo · 1 divergência nova · 2 erro de uso.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const MODELS = path.join(RAIZ, "packages", "api-client", "src", "models.ts");
const CONTRATO = path.join(AQUI, "contrato-backend.json");
const BASELINE = path.join(AQUI, "divergencias-conhecidas.json");

function lerArgumentos(argv) {
  const opcoes = { contrato: CONTRATO, models: MODELS, baseline: BASELINE, limite: 10 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--contrato") opcoes.contrato = path.resolve(argv[++i] ?? "");
    else if (arg === "--models") opcoes.models = path.resolve(argv[++i] ?? "");
    else if (arg === "--baseline") opcoes.baseline = path.resolve(argv[++i] ?? "");
    else if (arg === "--limite") opcoes.limite = Number(argv[++i] ?? 10);
    else if (arg === "--todos") opcoes.limite = Number.MAX_SAFE_INTEGER;
    else if (arg === "--atualizar-baseline") opcoes.atualizar = true;
    else if (arg === "--sem-portao") opcoes.semPortao = true;
    else if (arg === "--json") opcoes.json = true;
    else if (arg === "--help" || arg === "-h") opcoes.ajuda = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return opcoes;
}

const AJUDA = `uso: node scripts/contrato/conferir-contrato.mjs [opções]

  --contrato <arquivo>     retrato do backend (padrão: scripts/contrato/contrato-backend.json)
  --models <arquivo>       DTOs do front (padrão: packages/api-client/src/models.ts)
  --baseline <arquivo>     divergências já conhecidas (padrão: scripts/contrato/divergencias-conhecidas.json)
  --atualizar-baseline     regrava o baseline com o estado atual
  --sem-portao             só relata, sempre sai 0
  --todos                  lista todas as divergências, não só as 10 piores
  --limite <n>             quantas divergências listar (padrão: 10)
  --json                   despeja o resultado completo em JSON`;

/** Baseline ausente vale como vazio: o portão passa a exigir contrato limpo. */
function lerBaseline(arquivo) {
  if (!fs.existsSync(arquivo)) return { chaves: new Set(), existe: false };
  const bruto = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  return { chaves: new Set(bruto.chaves ?? []), existe: true };
}

async function gravarBaseline(arquivo, achados) {
  const doPortao = achados.filter((a) => SEVERIDADES_DO_PORTAO.has(a.severidade));
  const totalPorRegra = {};
  for (const achado of doPortao) totalPorRegra[achado.regra] = (totalPorRegra[achado.regra] ?? 0) + 1;

  const conteudo = {
    versao: 1,
    geradoEm: dataDeHoje(),
    explicacao:
      "Divergências de contrato que já existiam quando o portão foi criado. O arquivo só encolhe: " +
      "chave nova aqui significa que alguém suprimiu um defeito em vez de consertá-lo. " +
      "Depois de corrigir campos no models.ts, rode `--atualizar-baseline` para travar o ganho.",
    totalPorRegra: Object.fromEntries(Object.entries(totalPorRegra).sort((a, b) => b[1] - a[1])),
    chaves: [...new Set(doPortao.map((a) => a.chave))].sort(),
  };
  // Só o caminho `--atualizar-baseline` toca no Prettier, e ele é opcional; o
  // caminho que o CI percorre continua sem dependência nenhuma.
  fs.writeFileSync(arquivo, await formatarJson(conteudo, arquivo));
  return conteudo;
}

async function principal() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  if (opcoes.ajuda) {
    console.log(AJUDA);
    return 0;
  }

  for (const [rotulo, arquivo] of [
    ["retrato do contrato", opcoes.contrato],
    ["models.ts", opcoes.models],
  ]) {
    if (!fs.existsSync(arquivo)) {
      console.error(`Não encontrei o ${rotulo}: ${arquivo}`);
      if (arquivo === opcoes.contrato) {
        console.error("Gere com: node scripts/contrato/extrair-contrato.mjs --backend <caminho do backend>");
      }
      return 2;
    }
  }

  const contrato = JSON.parse(fs.readFileSync(opcoes.contrato, "utf8"));
  const modelsRelativo = path.relative(RAIZ, opcoes.models).split(path.sep).join("/");
  const tiposTs = parseTypeScriptFile(fs.readFileSync(opcoes.models, "utf8"), modelsRelativo);

  if (tiposTs.length === 0) {
    // Parser que não acha nada devolveria "zero divergências" e passaria o
    // portão exatamente quando está quebrado. Reprovar aqui é obrigatório.
    console.error(`Nenhuma interface exportada encontrada em ${modelsRelativo}. O parser quebrou?`);
    return 2;
  }

  const resultado = compararContrato(contrato, tiposTs);

  if (opcoes.atualizar) {
    const gravado = await gravarBaseline(opcoes.baseline, resultado.achados);
    console.log(`Baseline regravado: ${gravado.chaves.length} divergências conhecidas.`);
  }

  const baseline = lerBaseline(opcoes.baseline);
  const doPortao = resultado.achados.filter((a) => SEVERIDADES_DO_PORTAO.has(a.severidade));
  const chavesAtuais = new Set(doPortao.map((a) => a.chave));
  const portao = opcoes.semPortao
    ? null
    : {
        novas: doPortao.filter((a) => !baseline.chaves.has(a.chave)),
        conhecidas: baseline.chaves.size,
        resolvidas: [...baseline.chaves].filter((c) => !chavesAtuais.has(c)),
      };

  const dados = { contrato, resultado, portao, modelsRelativo, limite: opcoes.limite };

  if (opcoes.json) {
    process.stdout.write(`${JSON.stringify({ ...resultado, portao }, null, 2)}\n`);
  } else {
    console.log(formatarConsole(dados));
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${formatarMarkdown(dados)}\n`);
  }

  if (!portao || portao.novas.length === 0) return 0;

  console.error("");
  console.error("Divergência de contrato NOVA. O tipo do front promete algo que a API não entrega.");
  console.error("Se o backend mudou, rode `extrair-contrato.mjs` e ajuste o models.ts no mesmo PR.");
  console.error("Suprimir com `--atualizar-baseline` sem consertar é escolher a próxima tela preta.");
  return 1;
}

process.exitCode = await principal();
