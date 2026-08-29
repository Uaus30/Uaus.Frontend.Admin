import type {
  StorefrontProductDetailDto,
  StorefrontProductDto,
  StorefrontTagDto,
  StorefrontVariationDto,
} from "@workspace/api-client-react";

/**
 * A feature usa os DTOs públicos do api-client como modelo — eles já são a
 * projeção segura para visitante anônimo (sem custo, estoque, auditoria).
 * Os aliases existem para os componentes falarem a língua da feature sem
 * acoplar cada arquivo ao nome do transporte.
 */
export type CatalogProduct = StorefrontProductDto;
export type CatalogProductDetail = StorefrontProductDetailDto;
export type CatalogTag = StorefrontTagDto;
export type CatalogVariation = StorefrontVariationDto;
