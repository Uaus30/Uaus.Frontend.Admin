import { useState } from "react";

/** O que o celular em pé mostra: a busca de produtos ou o carrinho. */
export type PhoneView = "products" | "cart";

/**
 * Qual das duas vistas o celular em pé mostra.
 *
 * Em pé não cabem as duas colunas do balcão: a busca e o carrinho viram vistas
 * que se alternam, e a barra do pé leva de uma para a outra. A regra que mora
 * aqui é uma só: **carrinho que esvazia volta para a busca**. Venda finalizada,
 * pausada ou cancelada encerra o atendimento, e o próximo começa procurando
 * produto — deixar o operador num carrinho vazio, com "Carrinho vazio" escrito,
 * é um toque a mais para nada.
 *
 * Bipar NÃO leva ao carrinho: o operador adiciona vários itens seguidos pela
 * busca, e pular de vista a cada um o obrigaria a voltar todas as vezes. A
 * confirmação de que o item entrou é o pulso da barra do pé.
 *
 * @param itemCount Linhas no carrinho agora.
 */
export function usePhoneCartView(itemCount: number) {
  const [view, setView] = useState<PhoneView>("products");
  const empty = itemCount === 0;

  // Ajuste DURANTE o render, e não num efeito: é o padrão do React para
  // reiniciar estado quando uma entrada muda. Com efeito, a tela pintaria um
  // quadro com o carrinho vazio antes de voltar para a busca.
  const [wasEmpty, setWasEmpty] = useState(empty);
  if (empty !== wasEmpty) {
    setWasEmpty(empty);
    if (empty) setView("products");
  }

  return {
    view,
    openCart: () => setView("cart"),
    openProducts: () => setView("products"),
  };
}
