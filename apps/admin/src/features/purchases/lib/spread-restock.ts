/** Uma variação da grade, com o que a repartição precisa saber dela. */
export type SpreadVariation = {
  productId: number;
  stock: number;
  /** Vendável (nem inativa, nem rascunho): só ela recebe parte da compra. */
  sellable: boolean;
};

/**
 * Reparte a compra de reposição do produto INTEIRO entre as variações
 * (15/10/2026).
 *
 * O "Comprar" da linha de grupo do relatório de estoque baixo sugere a
 * quantidade do produto — o controle de estoque dele é pelo total. Pôr tudo na
 * variação que representa o grupo compraria 40 de uma estampa só. Aqui a
 * quantidade é distribuída uma unidade por vez para a variação vendável com
 * MENOS saldo (o que já está em casa somado ao que esta compra põe): compra-se
 * primeiro o que falta, e as variações terminam o mais iguais possível. No
 * empate, a ordem da grade.
 *
 * É ponto de partida: a compra nasce Pendente, e o recebimento confere a grade
 * do que de fato veio. Sem variação vendável, ninguém recebe nada e a grade
 * nasce zerada.
 */
export function spreadRestockQuantity(quantity: number, variations: SpreadVariation[]): Map<number, number> {
  const parte = new Map<number, number>(variations.map((variacao) => [variacao.productId, 0]));
  const vendaveis = variations.filter((variacao) => variacao.sellable);
  if (vendaveis.length === 0 || quantity <= 0) return parte;

  for (let unidade = 0; unidade < quantity; unidade++) {
    let alvo = vendaveis[0];
    for (const variacao of vendaveis) {
      const nivel = Math.max(0, variacao.stock) + (parte.get(variacao.productId) ?? 0);
      const nivelDoAlvo = Math.max(0, alvo.stock) + (parte.get(alvo.productId) ?? 0);
      if (nivel < nivelDoAlvo) alvo = variacao;
    }
    parte.set(alvo.productId, (parte.get(alvo.productId) ?? 0) + 1);
  }

  return parte;
}
