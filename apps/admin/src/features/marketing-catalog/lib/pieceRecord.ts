import type { RegisterCatalogPieceRequest } from "@workspace/api-client-react";
import type { CatalogProduct } from "../types";
import { ROLE_CODE } from "./catalogProducts";
import type { CatalogFormatOption } from "./formats";
import type { CatalogThemeOption } from "./themes";

/**
 * A chave de uma peça no histórico. É gerada aqui, e não no servidor, para o
 * registro ser idempotente: compartilhar e depois baixar o MESMO arquivo, ou um
 * toque repetido, manda a mesma chave e não cria outro registro.
 */
export function newPieceKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();

  // `randomUUID` só existe em contexto seguro (https ou localhost). Aberto por
  // http na rede da loja, cai aqui: tempo mais acaso bastam para não repetir.
  const random = () => Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}

/** O que do registro vem da peça pronta. */
export interface RecordablePiece {
  key: string;
  title: string;
  theme: CatalogThemeOption;
  format: CatalogFormatOption;
  products: CatalogProduct[];
}

/**
 * A peça no formato do registro. O preço é o IMPRESSO — o que o cliente leu —,
 * e a ordem é a do desenho.
 */
export function toPieceRecord(piece: RecordablePiece): RegisterCatalogPieceRequest {
  return {
    clientKey: piece.key,
    theme: piece.theme.theme,
    departmentId: piece.theme.departmentId,
    format: piece.format.code,
    title: piece.title,
    items: piece.products.map((product) => ({
      productGroupId: product.productGroupId,
      role: ROLE_CODE[product.role],
      price: product.price,
    })),
  };
}
