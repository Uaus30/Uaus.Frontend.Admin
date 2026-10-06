/** A forma de pagamento como as telas de venda a recebem (o DTO da API). */
export type PaymentMethodOption = { id: number; name: string; isActive?: boolean };

/**
 * Pode entrar numa venda: só a forma ativa. A lista da API traz as desativadas
 * junto, em ordem de nome — sem este filtro, a primeira desativada em ordem
 * alfabética virava a forma padrão da Nova venda, e o servidor recusava com
 * "Forma de pagamento não encontrada ou inativa!".
 */
export function isSelectableMethod(method: { isActive?: boolean }): boolean {
  return method.isActive ?? true;
}

/**
 * As opções do select de uma linha: as ativas, mais as desativadas que a venda
 * já usa. Sem estas, a venda paga numa forma desativada depois abria a correção
 * com o select em branco — o dono entenderia que a forma se perdeu e trocaria
 * por outra.
 */
export function paymentMethodChoices(
  methods: PaymentMethodOption[],
  usedIds: number[],
): Array<PaymentMethodOption & { label: string }> {
  const used = new Set(usedIds);
  return methods
    .filter((method) => isSelectableMethod(method) || used.has(method.id))
    .map((method) => ({
      ...method,
      label: isSelectableMethod(method) ? method.name : `${method.name} (desativada)`,
    }));
}
