/**
 * Destaque do campo preenchido: fundo verde-claro e contorno verde vivo.
 *
 * Pedido do dono para o cadastro de cliente (01/10/2026): no caixa, com o
 * cliente esperando, o operador precisa ver de relance o que já preencheu e o
 * que falta. Vale para qualquer formulário curto que precise dessa leitura (o
 * cadastro rápido do PDV, a modal de clientes do admin, a configuração da
 * fidelidade).
 *
 * É só a classe, e não um `Input` novo, para servir igual a input, select,
 * textarea e aos chips de escolha.
 *
 * @param filled O campo tem valor.
 */
export function filledFieldClass(filled: boolean): string {
  return filled
    ? "border-emerald-500 bg-emerald-50 focus-visible:ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-500/10"
    : "";
}
