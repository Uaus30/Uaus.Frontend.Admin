import type React from "react";

/**
 * Enter num campo NÃO envia o formulário: enviar é só o clique no botão.
 *
 * O leitor de código de barras termina o bipe com um Enter, que num formulário é
 * o envio implícito do navegador — e o teclado do celular tem a tecla "Ir", que
 * faz o mesmo. Na compra (24/09/2026) o bipe gravava a compra antes da consulta
 * ao catálogo; na Nova venda (06/10/2026), o "Ir" no preço de um item registraria
 * a venda pela metade. É a regra do cadastro de produto (23/09/2026,
 * `impedirEnvioPeloEnter`), e vale para o formulário inteiro porque o bipe cai no
 * campo que estiver com o foco.
 *
 * Só para o que está DENTRO do form no DOM: a busca de produto e os diálogos são
 * portais, e o evento deles também chega aqui, pela árvore do React.
 */
export function blockImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
  if (!event.currentTarget.contains(event.target)) return;

  event.preventDefault();
}
