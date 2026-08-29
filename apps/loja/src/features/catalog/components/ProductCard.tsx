import { Link } from "wouter";
import { productDetailPath } from "@/routes";
import type { CatalogProduct } from "../types";
import { PriceTag } from "./PriceTag";
import { ProductImage } from "./ProductImage";
import { TagRibbons } from "./TagRibbons";

/**
 * Card da vitrine. O card INTEIRO navega para o detalhe — no site antigo o
 * clique só abria a foto ampliada; agora o detalhe concentra galeria, variações
 * e o botão de reserva.
 *
 * Hover por transição CSS, sem framer-motion de propósito: numa grade de
 * scroll infinito cada card montado com motion paga JS por frame; CSS anima na
 * thread de composição.
 */
export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={productDetailPath(product.productGroupId)}
      className="group block overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-orange-50/50">
        <TagRibbons tags={product.tags} />
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {product.categoryName}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] font-bold leading-tight text-foreground">
          {product.name}
        </h3>
        <div className="mt-3">
          <PriceTag price={product.price} priceMax={product.priceMax} />
        </div>
      </div>
    </Link>
  );
}
