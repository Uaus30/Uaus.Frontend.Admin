/**
 * Data de hoje no relógio de quem rodou o script, no formato `AAAA-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` seria uma linha a menos e estaria
 * errado pela armadilha 2 do CLAUDE.md: `toISOString` converte para UTC, e no
 * Brasil (UTC-3) tudo que roda depois das 21h já é o dia seguinte. O retrato
 * gerado numa terça à noite se diria de quarta, e a idade que o CI calcula sairia
 * negativa — número que faz duvidar da ferramenta inteira por um detalhe de fuso.
 */
export function dataDeHoje(agora = new Date()) {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
