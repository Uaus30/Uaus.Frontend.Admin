import type { CatalogStoreInfo } from "../types";

/**
 * O contato impresso no rodapé das peças — o MESMO do site da loja
 * (`apps/loja/src/lib/site.ts`), que é o que o cliente já conhece.
 *
 * Não vem de `/Storefront/company`, e é de propósito: aquele cadastro é o do
 * cupom do PDV. Medido em produção em 03/10/2026, ele guarda "RUA PARANAGUÁ,
 * 663", "TAPIRA - PR" e "Cel: (44) 99137-2305" — caixa alta de cupom e o
 * celular de um sócio, não o WhatsApp de atendimento da loja. O site também
 * não usa esse telefone, pelo mesmo motivo.
 *
 * É a segunda cópia destes três valores no repositório. Na terceira, eles
 * sobem para o `packages/core` e o site passa a ler de lá.
 */
export const CATALOG_STORE: CatalogStoreInfo = {
  address: "Rua Paranaguá, 663 · Centro · Tapira-PR",
  whatsapp: "(44) 99136-5567",
  site: "uaus.com.br",
};
