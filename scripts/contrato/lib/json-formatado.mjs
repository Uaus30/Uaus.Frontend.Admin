/**
 * Serializa JSON já no formato que o Prettier aceitaria.
 *
 * `JSON.stringify(…, 2)` quase acerta: o Prettier junta lista de um item só
 * numa linha, e o repositório tem portão `npm run format:check`. Sem esta
 * passada, quem regerasse o retrato ou o baseline deixaria o CI vermelho sem
 * ter escrito uma linha de código — e aprenderia a não regerar, que é o oposto
 * do que estes scripts precisam que aconteça.
 *
 * O Prettier é OPCIONAL de propósito: entra por `import()` dinâmico e, se não
 * estiver instalado, a função devolve o JSON simples com um aviso. É isso que
 * mantém o `conferir-contrato.mjs` rodando no CI sem `npm ci`.
 */
export async function formatarJson(valor, arquivo) {
  const json = `${JSON.stringify(valor, null, 2)}\n`;
  try {
    const prettier = await import("prettier");
    const config = await prettier.resolveConfig(arquivo);
    return await prettier.format(json, { ...config, filepath: arquivo });
  } catch {
    console.warn(
      `Aviso: Prettier não disponível. Rode \`npx prettier --write ${arquivo}\` antes de commitar.`,
    );
    return json;
  }
}
