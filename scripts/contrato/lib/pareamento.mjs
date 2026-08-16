/**
 * Como os tipos dos dois lados são casados antes de a comparação começar.
 *
 * Duas coisas atrapalham a comparação campo a campo e nada têm a ver com as
 * regras: herança (o filho não repete os campos do pai) e renomeação (o mesmo
 * DTO com nome diferente nos dois repositórios). Resolver isso aqui deixa o
 * `comparar.mjs` falando só de defeito.
 */

/** `: Base, IAlgo` → `Base`. Interface (`IAlgo`) não traz campo serializado. */
export function baseDoCSharp(herda) {
  if (!herda) return null;
  const primeiro = herda.split(",")[0].trim().replace(/<.*$/, "");
  if (/^I[A-Z]/.test(primeiro)) return null;
  return primeiro || null;
}

/** `extends A, B` → `["A", "B"]`. */
export function basesDoTs(estende) {
  if (!estende) return [];
  return estende
    .split(",")
    .map((n) => n.trim().replace(/<.*$/, ""))
    .filter(Boolean);
}

/**
 * Achata a herança: devolve os campos do tipo já com os do ancestral na frente.
 *
 * Sem achatar, `CampaignReportCampaignTotalsDto` apareceria com metade dos
 * campos "faltando no backend" — o relatório viraria ruído e ninguém leria.
 * Base que não está no conjunto lido vira `pendencias`, e o comparador desliga
 * as regras de campo ausente para esse tipo.
 */
export function achatar(tipos, obterBases) {
  const porNome = new Map(tipos.map((t) => [t.nome, t]));

  const resolver = (tipo, vistos) => {
    const campos = [];
    const herdados = [];
    const pendencias = [];

    for (const nomeBase of obterBases(tipo)) {
      if (vistos.has(nomeBase)) continue;
      vistos.add(nomeBase);
      const base = porNome.get(nomeBase);
      if (!base) {
        pendencias.push(nomeBase);
        continue;
      }
      const acima = resolver(base, vistos);
      campos.push(...acima.campos);
      herdados.push(nomeBase, ...acima.herdados);
      pendencias.push(...acima.pendencias);
    }

    campos.push(...tipo.campos);
    return { campos, herdados, pendencias };
  };

  return new Map(
    tipos.map((tipo) => {
      const { campos, herdados, pendencias } = resolver(tipo, new Set([tipo.nome]));
      // Campo redeclarado no filho vence o do ancestral.
      const porCampo = new Map(campos.map((c) => [c.nome, c]));
      return [tipo.nome, { ...tipo, campos: [...porCampo.values()], herdados, pendencias }];
    }),
  );
}

/**
 * Casa tipo renomeado no front com a classe correspondente do backend.
 *
 * `FinancialReportSummaryDto.Sales` é um `PeriodTotalsDto` no C# e um
 * `FinancialPeriodTotalsDto` no TypeScript. Sem casar os dois, o comparador
 * grita "tipo incompatível" numa renomeação deliberada — e, pior, os campos
 * dessa interface ficam sem conferência nenhuma, que é justamente onde o
 * defeito se esconde.
 *
 * O casamento só vale quando os dois lados estão órfãos e a referência é
 * ÚNICA. Dois candidatos para a mesma classe viram nenhum: pareamento
 * adivinhado enche o relatório de divergência que não existe.
 */
export function acharApelidos(csPorNome, tsPorNome) {
  const candidatos = new Map();

  for (const [nome, cs] of csPorNome) {
    const ts = tsPorNome.get(nome);
    if (!ts) continue;
    const camposTs = new Map(ts.campos.map((c) => [c.nome, c]));

    for (const campo of cs.campos) {
      const alvo = camposTs.get(campo.nome);
      if (!alvo) continue;
      const csTipo = (campo.colecao ? campo.elemento : campo.tipoBase)?.replace(/\?$/, "").trim();
      const tsTipo = (campo.colecao ? alvo.elemento : alvo.tipoBase)?.trim();
      if (!csTipo || !tsTipo || csTipo === tsTipo) continue;
      if (!csPorNome.has(csTipo) || tsPorNome.has(csTipo)) continue;
      if (!tsPorNome.has(tsTipo) || csPorNome.has(tsTipo)) continue;
      if (!candidatos.has(csTipo)) candidatos.set(csTipo, new Set());
      candidatos.get(csTipo).add(tsTipo);
    }
  }

  const apelidos = new Map();
  const usados = new Set();
  for (const [csTipo, nomes] of candidatos) {
    if (nomes.size !== 1) continue;
    const tsTipo = [...nomes][0];
    if (usados.has(tsTipo)) continue;
    usados.add(tsTipo);
    apelidos.set(csTipo, tsTipo);
  }
  return apelidos;
}
