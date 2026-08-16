import { lineAt, matchBrace, splitTopLevel, stripCommentsAndStrings } from "./source-text.mjs";

/**
 * Leitura das interfaces de `packages/api-client/src/models.ts`.
 *
 * O que importa de cada campo é o par (opcional, aceita nulo). São coisas
 * diferentes e é justamente aí que mora o defeito: `campo?: T` diz "pode não
 * vir"; `campo: T | null` diz "vem sempre, às vezes valendo nulo". O backend com
 * `WhenWritingNull` produz o primeiro caso, nunca o segundo.
 */

/** Alias do repositório para enum serializado pelo nome (`number | string | null | undefined`). */
export const ALIAS_ENUM = "EnumValue";

/**
 * Quebra uma união de topo em partes, respeitando genérico e objeto literal.
 *
 * `Record<string, number> | null` tem que virar duas partes, e
 * `{ a: string | null }` tem que continuar sendo uma só.
 */
function splitUnion(texto) {
  const partes = [];
  let atual = "";
  let profundidade = 0;

  for (const c of texto) {
    if (c === "{" || c === "[" || c === "(" || c === "<") profundidade += 1;
    else if (c === "}" || c === "]" || c === ")" || c === ">") profundidade -= 1;

    if (c === "|" && profundidade <= 0) {
      partes.push(atual.trim());
      atual = "";
      continue;
    }
    atual += c;
  }
  partes.push(atual.trim());
  return partes.filter(Boolean);
}

/**
 * Desmonta o tipo declarado no TypeScript.
 *
 * @param {string} bruto texto do tipo
 */
export function analyzeTsType(bruto) {
  const texto = bruto.trim().replace(/\s+/g, " ");
  const partes = splitUnion(texto);
  const aceitaNull = partes.includes("null");
  const aceitaUndefined = partes.includes("undefined");
  const uteis = partes.filter((p) => p !== "null" && p !== "undefined");
  const base = uteis.length === 1 ? uteis[0] : uteis.join(" | ");

  let colecao = false;
  let elemento = null;
  const semReadonly = base.replace(/^readonly\s+/, "");
  if (semReadonly.endsWith("[]")) {
    colecao = true;
    elemento = semReadonly
      .slice(0, -2)
      .replace(/^\((.*)\)$/, "$1")
      .trim();
  } else {
    const generica = /^(?:Array|ReadonlyArray)\s*<([\s\S]+)>$/.exec(semReadonly);
    if (generica) {
      colecao = true;
      elemento = generica[1].trim();
    }
  }

  return {
    raw: texto,
    base,
    aceitaNull,
    aceitaUndefined,
    colecao,
    elemento,
    uniao: uteis.length > 1,
    registro: /^(?:Record|Partial|Pick|Omit)\s*</.test(base) || base.startsWith("{"),
  };
}

/**
 * Lê um arquivo `.ts` e devolve as interfaces exportadas.
 *
 * Só `export interface` entra. `export type X = Omit<Y, ...>` fica de fora de
 * propósito: resolver um tipo utilitário exige o compilador do TypeScript, e um
 * comparador que adivinha o resultado do `Omit` erra em silêncio — pior do que
 * declarar que não confere.
 *
 * @param {string} conteudo texto do arquivo
 * @param {string} arquivo caminho para o relatório citar
 */
export function parseTypeScriptFile(conteudo, arquivo) {
  const limpo = stripCommentsAndStrings(conteudo);
  const re = /export\s+interface\s+([A-Za-z_$][\w$]*)\s*(<[^>{]*>)?\s*(?:extends\s+([^{]+?))?\s*\{/g;
  const tipos = [];
  let m;

  while ((m = re.exec(limpo)) !== null) {
    const abertura = limpo.indexOf("{", m.index + m[0].length - 1);
    const fechamento = matchBrace(limpo, abertura);
    if (fechamento === -1) continue;

    const corpo = limpo.slice(abertura + 1, fechamento);
    const campos = [];
    // Cursor porque os pedaços saem na ordem do arquivo: procurar sempre do
    // começo faria dois campos com o mesmo texto apontarem para a mesma linha.
    let cursor = 0;

    for (const bruto of splitTopLevel(corpo, ";")) {
      const pedaco = bruto.trim();
      const posicao = corpo.indexOf(pedaco, cursor);
      if (posicao >= 0) cursor = posicao + pedaco.length;

      const campo = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*([\s\S]+)$/.exec(pedaco);
      if (!campo) continue;
      const tipo = analyzeTsType(campo[3]);
      campos.push({
        nome: campo[1],
        opcional: Boolean(campo[2]),
        tipo: tipo.raw,
        tipoBase: tipo.base,
        aceitaNull: tipo.aceitaNull,
        aceitaUndefined: tipo.aceitaUndefined,
        colecao: tipo.colecao,
        elemento: tipo.elemento,
        uniao: tipo.uniao,
        registro: tipo.registro,
        linha: lineAt(limpo, abertura + 1 + Math.max(posicao, 0)),
      });
    }

    tipos.push({
      nome: m[1],
      arquivo,
      linha: lineAt(limpo, m.index),
      generica: Boolean(m[2]),
      estende: (m[3] ?? "").trim() || null,
      campos,
    });
    re.lastIndex = fechamento;
  }

  return tipos;
}
