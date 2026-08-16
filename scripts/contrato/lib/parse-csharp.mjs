import { lineAt, matchBrace, stripCommentsAndStrings } from "./source-text.mjs";

/**
 * Leitura das classes DTO do backend .NET.
 *
 * Só interessa aqui o que muda o JSON que chega no navegador: nome da
 * propriedade depois da política camelCase, tipo, e — o ponto de tudo — se o
 * tipo é ANULÁVEL. Com `JsonIgnoreCondition.WhenWritingNull` ligado, propriedade
 * nula não vira `null` no JSON: ela some. O front recebe `undefined`, e um tipo
 * TypeScript que promete `number | null` está mentindo.
 */

/** Coleções que o System.Text.Json serializa como array JSON. */
const COLECOES =
  /^(?:List|IList|ICollection|IEnumerable|IReadOnlyList|IReadOnlyCollection|HashSet|ISet|Collection|Queue|Stack)\s*<([\s\S]+)>$/;

/** Dicionários viram objeto JSON, não array — e o parser não confere o miolo. */
const DICIONARIOS = /^(?:Dictionary|IDictionary|IReadOnlyDictionary|SortedDictionary)\s*</;

/** Modificadores que podem aparecer entre `public` e o tipo da propriedade. */
const MODIFICADORES = new Set(["required", "virtual", "override", "new", "sealed", "readonly"]);

/**
 * Reproduz a `JsonNamingPolicy.CamelCase` do .NET, inclusive no caso das siglas.
 *
 * Não basta minusculizar a primeira letra: o .NET minusculiza a sequência
 * INTEIRA de maiúsculas iniciais, parando uma antes da que começa a próxima
 * palavra. `PdvId` vira `pdvId`, `URL` vira `url`, `IPAddress` vira `ipAddress`.
 * Uma implementação ingênua devolveria `pDVId` e o comparador acusaria campo
 * ausente em todo DTO que tem sigla no nome.
 */
export function toCamelCase(nome) {
  if (!nome || nome[0] !== nome[0].toUpperCase() || !/[A-Z]/.test(nome[0])) return nome;

  const chars = [...nome];
  for (let i = 0; i < chars.length; i += 1) {
    const maiuscula = /[A-Z]/.test(chars[i]);
    if (i === 1 && !maiuscula) break;
    const proxima = chars[i + 1];
    if (i > 0 && proxima !== undefined && !/[A-Z]/.test(proxima)) break;
    if (!maiuscula) break;
    chars[i] = chars[i].toLowerCase();
  }
  return chars.join("");
}

/**
 * Desmonta o tipo declarado em C#.
 *
 * @param {string} bruto texto do tipo, como está no arquivo
 */
export function analyzeCSharpType(bruto) {
  let texto = bruto.trim().replace(/\s+/g, " ");
  let nullable = false;

  if (texto.endsWith("?")) {
    nullable = true;
    texto = texto.slice(0, -1).trim();
  }
  // `Nullable<decimal>` é a forma longa de `decimal?`.
  const longa = /^(?:System\.)?Nullable\s*<([\s\S]+)>$/.exec(texto);
  if (longa) {
    nullable = true;
    texto = longa[1].trim();
  }

  const semNamespace = texto.replace(/^(?:[A-Za-z_]\w*\.)+/, "");
  let collection = false;
  let element = null;

  if (semNamespace.endsWith("[]")) {
    collection = true;
    element = semNamespace.slice(0, -2).trim();
  } else {
    const generica = COLECOES.exec(semNamespace);
    if (generica) {
      collection = true;
      element = generica[1].trim();
    }
  }

  return {
    raw: bruto.trim(),
    base: semNamespace,
    nullable,
    collection,
    element,
    dictionary: DICIONARIOS.test(semNamespace),
  };
}

/** Localiza as declarações de classe de um arquivo já limpo, com o corpo de cada uma. */
function findClasses(limpo) {
  const re =
    /(?:^|[\s;}])(?:public|internal|protected|private)\s+(?:(?:abstract|sealed|static|partial)\s+)*class\s+([A-Za-z_]\w*)\s*(<[^>{]*>)?\s*(?::\s*([^{]+?))?\s*\{/g;
  const achados = [];
  let m;

  while ((m = re.exec(limpo)) !== null) {
    const abertura = limpo.indexOf("{", m.index + m[0].length - 1);
    const fechamento = matchBrace(limpo, abertura);
    if (fechamento === -1) continue;
    achados.push({
      nome: m[1],
      generica: Boolean(m[2]),
      herda: (m[3] ?? "").trim() || null,
      abstrata: /\babstract\b/.test(m[0]),
      inicio: abertura,
      fim: fechamento,
      linha: lineAt(limpo, m.index),
    });
    re.lastIndex = abertura + 1;
  }
  return achados;
}

/** Extrai as propriedades públicas de um corpo de classe, sem as das classes aninhadas. */
function findProperties(limpo, classe, aninhadas) {
  let corpo = limpo.slice(classe.inicio, classe.fim + 1);

  // Classe aninhada dentro desta: apaga o corpo dela para que as propriedades
  // da filha não sejam contadas como da mãe.
  for (const outra of aninhadas) {
    if (outra === classe) continue;
    if (outra.inicio > classe.inicio && outra.fim <= classe.fim) {
      const de = outra.inicio - classe.inicio;
      const ate = outra.fim - classe.inicio + 1;
      corpo = corpo.slice(0, de) + " ".repeat(ate - de) + corpo.slice(ate);
    }
  }

  // `public <modificadores> <tipo> <Nome> { get; ... } = <valor>;`
  // O `(` fora da classe de caracteres exclui método e construtor; o `=` fora
  // exclui campo com inicializador, que não é propriedade.
  const re = /\bpublic\s+([^;{}=()]+?)\s*\{\s*get\s*;([^}]*)\}\s*(=\s*[^;]+;)?/g;
  const props = [];
  let m;

  while ((m = re.exec(corpo)) !== null) {
    const prefixo = m[1].trim();
    const separado = /^([\s\S]*?)\s+([A-Za-z_]\w*)$/.exec(prefixo);
    if (!separado) continue;

    const tokens = separado[1].trim().split(/\s+/);
    const modificadores = [];
    while (tokens.length > 1 && MODIFICADORES.has(tokens[0])) modificadores.push(tokens.shift());
    if (tokens[0] === "static" || tokens[0] === "const") continue;

    const tipo = analyzeCSharpType(tokens.join(" "));
    const nomeCSharp = separado[2];

    props.push({
      nome: toCamelCase(nomeCSharp),
      nomeCSharp,
      tipo: tipo.raw,
      tipoBase: tipo.base,
      anulavel: tipo.nullable,
      colecao: tipo.collection,
      elemento: tipo.element,
      dicionario: tipo.dictionary,
      // `= null!;` é promessa do desenvolvedor, não garantia do compilador: o
      // campo é declarado não-anulável e recebe nulo com a checagem desligada.
      // Se o serviço esquecer de preencher, o campo some do JSON exatamente como
      // um anulável — e o tipo do front não avisa.
      nuloPerdoado: /=\s*null!\s*;/.test(m[3] ?? ""),
      somenteLeitura: !/\bset\s*;|\binit\s*;/.test(m[2] ?? ""),
      // Contado no texto original: apagar a classe aninhada troca as quebras de
      // linha por espaço, e contar dentro do corpo recortado erraria a linha.
      linha: lineAt(limpo, classe.inicio + m.index),
    });
  }

  return props;
}

/**
 * Lê um arquivo `.cs` e devolve as classes DTO que ele declara.
 *
 * @param {string} conteudo texto do arquivo
 * @param {string} arquivo caminho para o relatório citar
 */
export function parseCSharpFile(conteudo, arquivo) {
  const limpo = stripCommentsAndStrings(conteudo);
  const classes = findClasses(limpo);

  return classes.map((classe) => ({
    nome: classe.nome,
    arquivo,
    linha: classe.linha,
    herda: classe.herda,
    abstrata: classe.abstrata,
    // Classe genérica só é conferida no que não depende do parâmetro; o
    // comparador registra a limitação em vez de fingir que confere.
    generica: classe.generica,
    campos: findProperties(limpo, classe, classes),
  }));
}

/** Nomes dos `enum` públicos declarados no texto. */
export function parseEnums(conteudo) {
  const limpo = stripCommentsAndStrings(conteudo);
  const re = /\b(?:public|internal)\s+enum\s+([A-Za-z_]\w*)/g;
  const nomes = [];
  let m;
  while ((m = re.exec(limpo)) !== null) nomes.push(m[1]);
  return nomes;
}
