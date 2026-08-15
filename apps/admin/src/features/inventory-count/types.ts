import type { InventoryCountResultDto } from "@workspace/api-client-react";

/**
 * Tipos da feature de contagem de estoque.
 *
 * O resultado da contagem vem do api-client; aqui só o estado da tela.
 */
export type { InventoryCountResultDto };

/**
 * Em que passo do fluxo a tela está.
 *
 * A prévia é obrigatória por decisão de produto: a aplicação altera muitos
 * produtos de uma vez e não tem desfazer em lote, então o botão de aplicar só
 * aparece depois que o dono viu o impacto.
 */
export type InventoryCountStep = "selecionar" | "previa" | "aplicado";
