/**
 * Equivalência entre o tipo do C# e o tipo do TypeScript, depois do
 * `System.Text.Json`.
 *
 * A tabela é curta de propósito. Tudo que não estiver aqui devolve
 * `desconhecido`, e o comparador PULA a conferência de tipo em vez de chutar:
 * um falso positivo por linha faz o desenvolvedor ignorar o relatório inteiro,
 * e aí o verdadeiro positivo — o que derrubou a tela de Desempenho — passa
 * junto com o resto.
 */

/** Primitivos do C# e o que eles viram no JSON. */
const PRIMITIVOS = new Map([
  ["byte", "number"],
  ["sbyte", "number"],
  ["short", "number"],
  ["ushort", "number"],
  ["int", "number"],
  ["uint", "number"],
  ["long", "number"],
  ["ulong", "number"],
  ["float", "number"],
  ["double", "number"],
  ["decimal", "number"],
  ["bool", "boolean"],
  ["string", "string"],
  ["char", "string"],
  ["guid", "string"],
  // Data e hora saem como texto ISO. O front recebe string e converte na borda —
  // é por isso que `Date` no DTO seria errado, não só inconveniente.
  ["datetime", "string"],
  ["datetimeoffset", "string"],
  ["dateonly", "string"],
  ["timeonly", "string"],
  ["timespan", "string"],
]);

/** Tipos que o parser não tem como conferir; melhor calar do que inventar. */
const OPACOS = new Set(["object", "dynamic", "jsonelement", "jsondocument", "jsonnode", "stream", "byte[]"]);

/**
 * Classifica o tipo do C# no formato JSON que ele produz.
 *
 * @param {string} base nome do tipo sem `?` e sem namespace
 * @param {{enums: Set<string>, classes: Set<string>}} contexto
 */
export function classifyCSharp(base, contexto) {
  const chave = base.toLowerCase();
  if (OPACOS.has(chave)) return { forma: "desconhecido" };
  if (PRIMITIVOS.has(chave)) return { forma: PRIMITIVOS.get(chave) };
  if (contexto.enums.has(base)) return { forma: "enum", nome: base };
  if (contexto.classes.has(base)) return { forma: "objeto", nome: base };
  return { forma: "desconhecido", nome: base };
}

/**
 * O tipo do TypeScript aceita o que o C# vai mandar?
 *
 * Devolve `null` quando está tudo certo ou quando não dá para saber, e uma
 * mensagem em português quando o desencontro é real.
 *
 * @param {ReturnType<typeof classifyCSharp>} esperado
 * @param {string} tsBase tipo do campo no TypeScript, sem `null`/`undefined`
 * @param {{aliasEnum: string, enumComoTexto: boolean}} opcoes
 */
export function describeMismatch(esperado, tsBase, opcoes) {
  const ts = tsBase.trim();
  if (!ts || ts === "unknown" || ts === "any") return null;

  if (esperado.forma === "enum") {
    if (!opcoes.enumComoTexto) return null;
    // `JsonStringEnumConverter` manda o NOME do membro ("Admin"). Um campo
    // tipado `number` faz o `=== 1` da tela nunca dar true — mesmo defeito de
    // classe do `=== null` que apagou a tela de Desempenho, só que em enum.
    if (ts === "number") {
      return {
        regra: "enum-como-numero",
        severidade: "alto",
        texto: `o backend serializa o enum \`${esperado.nome}\` pelo NOME do membro (texto), e o campo está tipado \`number\``,
        conserto: `troque por \`${opcoes.aliasEnum}\` e leia com \`enumCode\``,
      };
    }
    return null;
  }

  if (esperado.forma === "objeto") {
    // Nome igual dos dois lados é o caso normal. Qualquer outra coisa (tipo
    // utilitário, objeto literal, união) o parser não resolve sozinho.
    if (ts === esperado.nome) return null;
    if (/^[A-Za-z_$][\w$]*$/.test(ts) === false) return null;
    if (ts === "unknown" || ts === "Record" || ts.startsWith("Record<")) return null;
    return {
      regra: "tipo-incompativel",
      severidade: "medio",
      texto: `o C# manda \`${esperado.nome}\` e o campo está tipado \`${ts}\``,
      conserto: `confira se \`${ts}\` tem mesmo o formato de \`${esperado.nome}\``,
    };
  }

  if (esperado.forma === "desconhecido") return null;

  // Primitivo. União com literais (`"a" | "b"`) conta como string.
  const literalTexto = /^(["'].*["']\s*\|?\s*)+$/.test(ts);
  const equivalente =
    ts === esperado.forma ||
    (esperado.forma === "string" && literalTexto) ||
    (esperado.forma === "number" && /^\d/.test(ts));

  if (equivalente) return null;
  // `EnumValue` é `number | string | null | undefined`: aceita qualquer
  // primitivo, então não há o que acusar.
  if (ts === opcoes.aliasEnum) return null;

  return {
    regra: "tipo-incompativel",
    severidade: "medio",
    texto: `o C# manda \`${esperado.forma}\` e o campo está tipado \`${ts}\``,
    conserto: `troque o tipo do campo por \`${esperado.forma}\``,
  };
}
