import type { LowStockItemDto, LowStockSummaryDto } from "@workspace/api-client-react";

/**
 * Tipos da feature de estoque baixo.
 *
 * Os DTOs vêm do api-client; a feature só os renomeia para falar a própria
 * língua sem acoplar cada arquivo ao nome do transporte.
 */
export type LowStockItem = LowStockItemDto;
export type LowStockSummary = LowStockSummaryDto;
