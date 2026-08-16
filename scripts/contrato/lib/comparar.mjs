import { classifyCSharp, describeMismatch } from "./type-match.mjs";
import { ALIAS_ENUM } from "./parse-typescript.mjs";
import { acharApelidos, achatar, baseDoCSharp, basesDoTs } from "./pareamento.mjs";

/**
 * As regras da conferência de contrato.
 *
 * A regra que justifica a ferramenta é a `nulo-sem-opcional`. Com
 * `JsonIgnoreCondition.WhenWritingNull`, propriedade nula é OMITIDA do JSON; um
 * campo tipado `T | null` sem o `?` promete presença que não existe. Foi assim
 * que `changePercentage` chegou `undefined` num `=== null` e a tela de
 * Desempenho do PDV ficou preta — sem erro de compilação, sem teste vermelho.
 */

/** Peso de cada severidade, para ordenar o relatório e decidir o portão. */
export const SEVERIDADES = { alto: 3, medio: 2, baixo: 1 };

/**
 * Desempate entre regras de mesma severidade, do defeito mais silencioso para o
 * mais barulhento. Campo que chega `undefined` numa comparação estrita não gera
 * erro nenhum; tipo trocado costuma aparecer no primeiro clique.
 */
export const PESO_REGRA = {
  "nulo-nao-declarado": 7,
  "nulo-sem-opcional": 6,
  "enum-como-numero": 5,
  "campo-inexistente-no-backend": 4,
  "colecao-divergente": 3,
  "tipo-incompativel": 2,
};

/** Severidades que reprovam o CI quando são NOVAS (fora do baseline). */
export const SEVERIDADES_DO_PORTAO = new Set(["alto", "medio"]);

/** Chave estável de uma divergência, usada no baseline. Não inclui a mensagem. */
export const chaveDe = (achado) => `${achado.regra}|${achado.tipo}.${achado.campo}`;

/** Monta um achado já com a chave do baseline. */
function achado(base, extra) {
  const registro = { ...base, ...extra };
  return { ...registro, chave: chaveDe(registro) };
}

/** Confere um par de tipos campo a campo. */
function compararTipo(cs, ts, contexto) {
  const achados = [];
  const opcoes = { aliasEnum: ALIAS_ENUM, enumComoTexto: contexto.enumComoTexto };
  const local = { tipo: ts.nome, arquivoTs: ts.arquivo, arquivoCs: cs.arquivo };
  const camposTs = new Map(ts.campos.map((c) => [c.nome, c]));

  // Conferir "campo a mais/a menos" exige ter lido os dois lados por inteiro.
  const listaConfiavel = cs.pendencias.length === 0 && !cs.generica && !ts.generica;

  for (const campo of cs.campos) {
    const alvo = camposTs.get(campo.nome);
    if (!alvo) {
      if (listaConfiavel) {
        achados.push(
          achado(local, {
            regra: "campo-ausente-no-typescript",
            severidade: "baixo",
            campo: campo.nome,
            linha: ts.linha,
            linhaCs: campo.linha,
            texto: `a API manda \`${campo.nome}\` (${campo.tipo}) e o tipo do front não declara o campo`,
            conserto: "acrescente o campo, ou ignore se a tela realmente não usa",
          }),
        );
      }
      continue;
    }

    const opcionalNoTs = alvo.opcional || alvo.aceitaUndefined;

    // A REGRA. Anulável no C# + serializador que omite nulo = campo some do
    // JSON. Sem o `?`, o TypeScript garante presença que o servidor não dá.
    if (campo.anulavel && contexto.ignoraNulos && !opcionalNoTs) {
      // Duas gravidades dentro do mesmo defeito. Com `| null` no tipo, quem
      // consome pelo menos foi obrigado a tratar ausência — só errou o operador
      // (`=== null` em vez de `== null`), e a tela fica em branco. Sem `| null`,
      // o tipo diz que o valor está sempre lá: o primeiro `.trim()` ou `.toFixed()`
      // estoura em produção com "cannot read properties of undefined".
      const semNuloNoTipo = !alvo.aceitaNull;
      achados.push(
        achado(local, {
          regra: semNuloNoTipo ? "nulo-nao-declarado" : "nulo-sem-opcional",
          severidade: "alto",
          campo: campo.nome,
          linha: alvo.linha,
          linhaCs: campo.linha,
          texto: semNuloNoTipo
            ? `o C# declara \`${campo.tipo}\` e o servidor OMITE o campo quando é nulo; o tipo do front (\`${alvo.tipo}\`) não admite nem ausência nem nulo`
            : `o C# declara \`${campo.tipo}\` e o servidor OMITE o campo quando é nulo; o tipo do front exige presença (\`${alvo.tipo}\`)`,
          conserto: `declare \`${campo.nome}?: ${alvo.tipoBase} | null\` e compare com \`== null\``,
        }),
      );
    } else if (!campo.anulavel && !campo.nuloPerdoado && opcionalNoTs && !campo.colecao) {
      achados.push(
        achado(local, {
          regra: "opcional-a-mais",
          severidade: "baixo",
          campo: campo.nome,
          linha: alvo.linha,
          linhaCs: campo.linha,
          texto: `o C# declara \`${campo.tipo}\` (nunca nulo) e o front marca o campo como opcional`,
          conserto: "tire o `?`; toda tela está tratando um caso que não acontece",
        }),
      );
    } else if (campo.nuloPerdoado && !opcionalNoTs) {
      achados.push(
        achado(local, {
          regra: "nulo-perdoado",
          severidade: "baixo",
          campo: campo.nome,
          linha: alvo.linha,
          linhaCs: campo.linha,
          texto: `o C# declara \`${campo.tipo}\` não-anulável mas atribui \`null!\`: o compilador não garante nada`,
          conserto: "confira no serviço se o campo é sempre preenchido",
        }),
      );
    }

    if (campo.colecao !== alvo.colecao && !campo.dicionario && !alvo.registro) {
      achados.push(
        achado(local, {
          regra: "colecao-divergente",
          severidade: "medio",
          campo: campo.nome,
          linha: alvo.linha,
          linhaCs: campo.linha,
          texto: campo.colecao
            ? `o C# manda uma lista (\`${campo.tipo}\`) e o front espera \`${alvo.tipo}\``
            : `o C# manda um valor só (\`${campo.tipo}\`) e o front espera uma lista (\`${alvo.tipo}\`)`,
          conserto: "acerte o lado que estiver errado antes de a tela iterar sobre nada",
        }),
      );
      continue;
    }

    const csBase = (campo.colecao ? (campo.elemento ?? "") : campo.tipoBase).replace(/\?$/, "");
    const tsBase = campo.colecao ? (alvo.elemento ?? "") : alvo.tipoBase;
    if (!csBase || !tsBase) continue;
    // Renomeação já reconhecida não é divergência.
    if (contexto.apelidos.get(csBase) === tsBase) continue;
    const divergencia = describeMismatch(classifyCSharp(csBase, contexto), tsBase, opcoes);
    if (divergencia) {
      achados.push(
        achado(local, {
          regra: divergencia.regra,
          severidade: divergencia.severidade,
          campo: campo.nome,
          linha: alvo.linha,
          linhaCs: campo.linha,
          texto: campo.colecao ? `no item da lista, ${divergencia.texto}` : divergencia.texto,
          conserto: divergencia.conserto,
        }),
      );
    }
  }

  if (listaConfiavel) {
    const camposCs = new Set(cs.campos.map((c) => c.nome));
    for (const alvo of ts.campos) {
      if (camposCs.has(alvo.nome)) continue;
      achados.push(
        achado(local, {
          regra: "campo-inexistente-no-backend",
          severidade: "medio",
          campo: alvo.nome,
          linha: alvo.linha,
          linhaCs: cs.linha,
          texto: `o tipo do front declara \`${alvo.nome}\` e a classe do backend não tem esse campo: chega \`undefined\` sempre`,
          conserto: "apague o campo, ou confirme com o backend se ele foi renomeado",
        }),
      );
    }
  }

  return achados;
}

/**
 * Compara o contrato do backend com os tipos do TypeScript.
 *
 * @param {object} contrato snapshot gerado por `extrair-contrato.mjs`
 * @param {Array} tiposTs interfaces lidas de `models.ts`
 * @returns {{achados: Array, pares: Array, semParNoFront: string[], semParNoBackend: string[], limites: string[]}}
 */
export function compararContrato(contrato, tiposTs) {
  const csPorNome = achatar(contrato.tipos, (t) => {
    const base = baseDoCSharp(t.herda);
    return base ? [base] : [];
  });
  const tsPorNome = achatar(tiposTs, (t) => basesDoTs(t.estende));

  const apelidos = acharApelidos(csPorNome, tsPorNome);
  const contexto = {
    enums: new Set(contrato.enums),
    classes: new Set(contrato.tipos.map((t) => t.nome)),
    ignoraNulos: contrato.serializacao.ignoraNulos,
    enumComoTexto: contrato.serializacao.enumComoTexto,
    apelidos,
  };

  const achados = [];
  const pares = [];
  const semParNoFront = [];
  const limites = [];

  for (const [nome, cs] of csPorNome) {
    const nomeTs = tsPorNome.has(nome) ? nome : apelidos.get(nome);
    const ts = nomeTs ? tsPorNome.get(nomeTs) : undefined;
    if (!ts) {
      semParNoFront.push(nome);
      continue;
    }
    pares.push(nomeTs === nome ? nome : `${nome} → ${nomeTs}`);
    if (cs.pendencias.length > 0) {
      limites.push(
        `${nome}: herda de \`${cs.pendencias.join(", ")}\`, que não foi lido — campo ausente não é conferido`,
      );
    }
    if (cs.generica || ts.generica) {
      limites.push(`${nome}: tipo genérico — só os campos que não dependem do parâmetro são conferidos`);
    }
    if (nomeTs !== nome) {
      limites.push(
        `${nome}: pareado com \`${nomeTs}\` por referência, não por nome — confira se é mesmo o mesmo tipo`,
      );
    }
    achados.push(...compararTipo(cs, ts, contexto));
  }

  const pareados = new Set(apelidos.values());
  const semParNoBackend = [...tsPorNome.keys()].filter((nome) => !csPorNome.has(nome) && !pareados.has(nome));

  achados.sort(
    (a, b) =>
      SEVERIDADES[b.severidade] - SEVERIDADES[a.severidade] ||
      a.tipo.localeCompare(b.tipo) ||
      a.campo.localeCompare(b.campo),
  );

  return { achados, pares, semParNoFront, semParNoBackend, limites };
}
