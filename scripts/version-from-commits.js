/**
 * Deriva o rótulo de versão a partir da contagem de commits do repositório.
 *
 * Os dígitos da contagem viram os três campos do semver, lidos da direita para
 * a esquerda: o último é o patch, o penúltimo é o minor, e o que sobra é o
 * major. Assim 188 commits viram `1.8.8`, e 1025 viram `10.2.5`.
 *
 * **Por que não o antigo `1.0.<contagem>`.** Com major e minor presos em `1.0`,
 * o único campo que se mexia era o patch: a tela dizia "1.0.189" hoje e
 * "1.0.190" amanhã, e os dois primeiros números nunca significaram nada. Ainda
 * era uma contagem de commits, só que disfarçada de semver.
 *
 * **A ordem do semver continua valendo**, que é o que permite comparar duas
 * versões e dizer qual é a mais nova: 99 -> 0.9.9, 100 -> 1.0.0, 999 -> 9.9.9,
 * 1000 -> 10.0.0. Cada commit a mais produz sempre uma versão maior que a
 * anterior — nenhuma faixa da contagem regride.
 *
 * **Por que esta regra mora num `.js` solto, e não no `packages/core`.** Os dois
 * consumidores são incompatíveis entre si: o `build-version.ts` é carregado pelo
 * Vite, que compila TypeScript, mas o `sync-version.js` roda no hook
 * `pre-commit` com `node` cru — e o Node do ambiente (v20) não apaga tipos de um
 * `.ts`. Um `.js` os dois importam. Duplicar a regra nos dois arquivos era a
 * alternativa, e é exatamente assim que as versões passam a divergir entre o que
 * o hook grava no `package.json` e o que o build exibe na tela.
 *
 * @param {number} commitCount Saída de `git rev-list --count HEAD`.
 * @returns {string} Versão no formato `major.minor.patch`.
 */
export function versionFromCommitCount(commitCount) {
  const total = Number.isFinite(commitCount) ? Math.max(0, Math.trunc(commitCount)) : 0;

  // O padStart garante os três campos quando a contagem tem menos de 3 dígitos:
  // 5 commits viram "005" e, portanto, `0.0.5` — e não uma versão sem minor.
  const digits = String(total).padStart(3, "0");

  return `${digits.slice(0, -2)}.${digits.slice(-2, -1)}.${digits.slice(-1)}`;
}
