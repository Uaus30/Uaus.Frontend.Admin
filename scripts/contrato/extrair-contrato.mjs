#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatarJson } from "./lib/json-formatado.mjs";
import { dataDeHoje } from "./lib/hoje.mjs";
import { parseCSharpFile, parseEnums } from "./lib/parse-csharp.mjs";
import { stripCommentsAndStrings } from "./lib/source-text.mjs";

/**
 * Copia o contrato do backend .NET para dentro deste repositório.
 *
 * Os dois repositórios são separados, então o CI do front NÃO tem o código C# à
 * disposição. Sem um retrato commitado aqui, a conferência de contrato só
 * rodaria na máquina de quem tem os dois clones — ou seja, não rodaria. O
 * retrato é lido pelo `conferir-contrato.mjs` e revisado como qualquer outro
 * arquivo: quando ele muda no PR, a mudança de contrato aparece no diff.
 *
 * Uso:
 *   node scripts/contrato/extrair-contrato.mjs [--backend <caminho>] [--out <arquivo>]
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const SAIDA_PADRAO = path.join(AQUI, "contrato-backend.json");
const IGNORAR = new Set(["bin", "obj", "node_modules", ".git", ".vs", ".idea"]);

/** Pastas do backend que contêm resposta de API. Requisição fica de fora — ver o README. */
const PASTAS_PADRAO = ["Uaus.Application/DTOs"];

/** Onde procurar `enum`: o serializador manda o NOME do membro, e isso muda a conferência de tipo. */
const PASTAS_ENUM = ["Uaus.Domain", "Uaus.Application"];

/** Onde procurar a configuração do `System.Text.Json`. */
const PASTA_SERIALIZACAO = "Uaus.Api";

function lerArgumentos(argv) {
  const opcoes = {
    backend: process.env.UAUS_BACKEND ?? path.resolve(RAIZ, "..", "Uaus.Backend.Api"),
    out: SAIDA_PADRAO,
    pastas: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--backend") opcoes.backend = path.resolve(argv[++i] ?? "");
    else if (arg === "--out") opcoes.out = path.resolve(argv[++i] ?? "");
    else if (arg === "--pasta") opcoes.pastas.push(argv[++i] ?? "");
    else if (arg === "--stdout") opcoes.stdout = true;
    else if (arg === "--help" || arg === "-h") opcoes.ajuda = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (opcoes.pastas.length === 0) opcoes.pastas = PASTAS_PADRAO;
  return opcoes;
}

/** Lista recursivamente os `.cs` de uma pasta, pulando saída de build. */
function listarCs(raiz) {
  const encontrados = [];
  if (!fs.existsSync(raiz)) return encontrados;

  const pilha = [raiz];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    for (const entrada of fs.readdirSync(atual, { withFileTypes: true })) {
      const caminho = path.join(atual, entrada.name);
      if (entrada.isDirectory()) {
        if (!IGNORAR.has(entrada.name)) pilha.push(caminho);
      } else if (entrada.name.endsWith(".cs")) {
        encontrados.push(caminho);
      }
    }
  }
  return encontrados.sort();
}

const paraPosix = (base, arquivo) => path.relative(base, arquivo).split(path.sep).join("/");

/**
 * Descobre como a API serializa hoje.
 *
 * Não é firula: a regra `nulo-sem-opcional` só vale enquanto o
 * `DefaultIgnoreCondition` for `WhenWritingNull`. No dia em que alguém trocar
 * para `Never`, o campo nulo passa a viajar como `null` e o `T | null` sem `?`
 * deixa de ser defeito. O retrato guarda o que estava valendo, e o comparador
 * obedece ao retrato em vez de a uma verdade decorada.
 */
function lerSerializacao(backend) {
  const arquivos = listarCs(path.join(backend, PASTA_SERIALIZACAO));
  let ignoreCondition = null;
  let enumConverter = false;
  let namingPolicy = null;
  const onde = [];

  for (const arquivo of arquivos) {
    const texto = stripCommentsAndStrings(fs.readFileSync(arquivo, "utf8"));
    const condicao = /DefaultIgnoreCondition\s*=\s*JsonIgnoreCondition\.(\w+)/.exec(texto);
    if (condicao) {
      ignoreCondition = condicao[1];
      onde.push(paraPosix(backend, arquivo));
    }
    if (/JsonStringEnumConverter/.test(texto)) enumConverter = true;
    const politica = /PropertyNamingPolicy\s*=\s*JsonNamingPolicy\.(\w+)/.exec(texto);
    if (politica) namingPolicy = politica[1];
  }

  return {
    ignoreCondition,
    // ASP.NET Core usa `JsonSerializerDefaults.Web`, cujo padrão é camelCase.
    // Só registramos outra coisa se o projeto tiver trocado explicitamente.
    namingPolicy: namingPolicy ?? "CamelCase (padrão Web)",
    ignoraNulos: ignoreCondition === "WhenWritingNull",
    enumComoTexto: enumConverter,
    declaradoEm: onde,
  };
}

/** SHA e data do commit do backend, para o retrato dizer de quando ele é. */
function lerCommit(backend) {
  try {
    const executar = (...args) =>
      execFileSync("git", ["-C", backend, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    return { commit: executar("rev-parse", "HEAD"), commitData: executar("log", "-1", "--format=%cI") };
  } catch {
    return { commit: null, commitData: null };
  }
}

function extrair(opcoes) {
  const tipos = [];
  const arquivosLidos = [];

  for (const pasta of opcoes.pastas) {
    const raiz = path.join(opcoes.backend, pasta);
    if (!fs.existsSync(raiz)) throw new Error(`Pasta não encontrada no backend: ${raiz}`);
    for (const arquivo of listarCs(raiz)) {
      const relativo = paraPosix(opcoes.backend, arquivo);
      arquivosLidos.push(relativo);
      tipos.push(...parseCSharpFile(fs.readFileSync(arquivo, "utf8"), relativo));
    }
  }

  const enums = new Set();
  for (const pasta of PASTAS_ENUM) {
    for (const arquivo of listarCs(path.join(opcoes.backend, pasta))) {
      for (const nome of parseEnums(fs.readFileSync(arquivo, "utf8"))) enums.add(nome);
    }
  }

  tipos.sort((a, b) => a.nome.localeCompare(b.nome));

  return {
    versao: 1,
    geradoEm: dataDeHoje(),
    origem: {
      repositorio: path.basename(opcoes.backend),
      ...lerCommit(opcoes.backend),
      pastas: opcoes.pastas,
      arquivos: arquivosLidos.length,
    },
    serializacao: lerSerializacao(opcoes.backend),
    enums: [...enums].sort(),
    tipos,
  };
}

async function principal() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  if (opcoes.ajuda) {
    console.log(
      "uso: node scripts/contrato/extrair-contrato.mjs [--backend <caminho>] [--out <arquivo>] [--pasta <relativa>] [--stdout]",
    );
    return;
  }

  const contrato = extrair(opcoes);
  const json = await formatarJson(contrato, opcoes.out);

  if (opcoes.stdout) {
    process.stdout.write(json);
    return;
  }

  fs.mkdirSync(path.dirname(opcoes.out), { recursive: true });
  fs.writeFileSync(opcoes.out, json);

  const campos = contrato.tipos.reduce((total, tipo) => total + tipo.campos.length, 0);
  console.log(`Contrato extraído de ${opcoes.backend}`);
  console.log(`  ${contrato.tipos.length} classes, ${campos} campos, ${contrato.enums.length} enums`);
  console.log(
    `  serialização: ignora nulos = ${contrato.serializacao.ignoraNulos}, enum como texto = ${contrato.serializacao.enumComoTexto}`,
  );
  console.log(`  gravado em ${path.relative(RAIZ, opcoes.out)}`);
}

await principal();
