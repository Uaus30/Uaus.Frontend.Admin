/**
 * Hooks e funções de acesso à API, por domínio.
 *
 * Este barrel existe para o import público não mudar: os apps continuam
 * escrevendo `from "@workspace/api-client-react"`. Ao acrescentar um recurso,
 * crie o arquivo do domínio e exporte-o aqui.
 */

export * from "./auth";
export * from "./users";
export * from "./customers";
export * from "./products";
export * from "./sales";
export * from "./categories";
export * from "./tags";
export * from "./suppliers";
export * from "./grades";
export * from "./purchases";
export * from "./logs";
export * from "./health";
export * from "./payment-methods";
export * from "./cash-register";
export * from "./pdv";
export * from "./stock-write-offs";
export * from "./financial";
export * from "./product-labels";
export * from "./coupons";
export * from "./campaigns";
