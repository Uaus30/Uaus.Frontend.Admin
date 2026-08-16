/**
 * Preparo de texto-fonte para os dois parsers (C# e TypeScript).
 *
 * Parser de contrato é análise léxica ingênua de propósito: trazer um compilador
 * de C# e outro de TypeScript para dentro do CI custaria mais do que o problema
 * que estamos resolvendo. O preço dessa escolha é que comentário e literal de
 * texto precisam sumir ANTES das expressões regulares — senão um `//` dentro de
 * uma URL, ou a palavra `class` dentro de um `<summary>` em português, viram
 * declaração fantasma e o relatório enche de divergência inventada.
 */

/** Troca todo caractere que não seja quebra de linha por espaço. */
function blank(trecho) {
  return trecho.replace(/[^\n]/g, " ");
}

/**
 * Apaga comentários e o miolo dos literais de texto, preservando o comprimento
 * e as quebras de linha do arquivo.
 *
 * A preservação não é capricho: o relatório aponta `arquivo:linha`, e um
 * stripper que encurta o texto faz o número da linha apontar para outro lugar —
 * o desenvolvedor abre o arquivo, não encontra o campo e desconfia da
 * ferramenta inteira.
 *
 * Trata literal comum (`"..."`, `'...'`), template do JS (`` `...` ``) e
 * verbatim do C# (`@"..."`, onde a aspa é escapada dobrando, não com barra).
 *
 * @param {string} fonte conteúdo bruto do arquivo
 * @returns {string} mesmo texto, sem comentário e sem conteúdo de literal
 */
export function stripCommentsAndStrings(fonte) {
  let saida = "";
  let i = 0;
  const n = fonte.length;

  while (i < n) {
    const c = fonte[i];
    const d = fonte[i + 1];

    // Comentário de linha — inclui o `///` da documentação XML do C#.
    if (c === "/" && d === "/") {
      const quebra = fonte.indexOf("\n", i);
      const fim = quebra === -1 ? n : quebra;
      saida += blank(fonte.slice(i, fim));
      i = fim;
      continue;
    }

    // Comentário de bloco. Sem fechamento, engole o resto do arquivo — que é o
    // que o compilador também faria.
    if (c === "/" && d === "*") {
      const fecha = fonte.indexOf("*/", i + 2);
      const fim = fecha === -1 ? n : fecha + 2;
      saida += blank(fonte.slice(i, fim));
      i = fim;
      continue;
    }

    // Verbatim do C#: `@"C:\pasta"` não escapa com barra, e `""` é uma aspa.
    if (c === "@" && d === '"') {
      let j = i + 2;
      let fechou = false;
      while (j < n) {
        if (fonte[j] === '"') {
          if (fonte[j + 1] === '"') {
            j += 2;
            continue;
          }
          fechou = true;
          j += 1;
          break;
        }
        j += 1;
      }
      const miolo = fonte.slice(i + 2, fechou ? j - 1 : j);
      saida += `@"${blank(miolo)}${fechou ? '"' : ""}`;
      i = j;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let fechou = false;
      while (j < n) {
        if (fonte[j] === "\\") {
          j += 2;
          continue;
        }
        if (fonte[j] === c) {
          fechou = true;
          j += 1;
          break;
        }
        j += 1;
      }
      const miolo = fonte.slice(i + 1, fechou ? j - 1 : j);
      saida += `${c}${blank(miolo)}${fechou ? c : ""}`;
      i = j;
      continue;
    }

    saida += c;
    i += 1;
  }

  return saida;
}

/**
 * Devolve o índice do `}` que fecha a chave aberta em `abertura`.
 *
 * @param {string} fonte texto já limpo por {@link stripCommentsAndStrings}
 * @param {number} abertura índice do `{`
 * @returns {number} índice do `}` correspondente, ou -1 se o arquivo terminar antes
 */
export function matchBrace(fonte, abertura) {
  let profundidade = 0;
  for (let i = abertura; i < fonte.length; i += 1) {
    if (fonte[i] === "{") profundidade += 1;
    else if (fonte[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return i;
    }
  }
  return -1;
}

/** Número da linha (base 1) de um índice, para o relatório citar `arquivo:linha`. */
export function lineAt(fonte, indice) {
  let linha = 1;
  for (let i = 0; i < indice && i < fonte.length; i += 1) {
    if (fonte[i] === "\n") linha += 1;
  }
  return linha;
}

/**
 * Quebra o corpo de um tipo nos separadores de topo, ignorando os que estiverem
 * dentro de `{}`, `[]` ou `()`.
 *
 * Sem isso, `Record<string, { a: string; b: number }>` seria cortado no `;` de
 * dentro do objeto e produziria dois campos que não existem.
 *
 * @param {string} corpo texto entre as chaves
 * @param {string} separador caractere separador (`;` no TypeScript)
 * @returns {string[]} pedaços não vazios, já sem espaço nas pontas
 */
export function splitTopLevel(corpo, separador) {
  const partes = [];
  let atual = "";
  let profundidade = 0;

  for (const c of corpo) {
    if (c === "{" || c === "[" || c === "(") profundidade += 1;
    else if (c === "}" || c === "]" || c === ")") profundidade -= 1;

    if (c === separador && profundidade <= 0) {
      partes.push(atual.trim());
      atual = "";
      continue;
    }
    atual += c;
  }
  partes.push(atual.trim());

  return partes.filter(Boolean);
}
