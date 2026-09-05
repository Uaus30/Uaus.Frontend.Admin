import { Link } from "wouter";
import { productDetailPath } from "@/routes";
import type { CatalogProduct } from "../types";
import { PriceTag } from "./PriceTag";
import { ProductImage } from "./ProductImage";
import { StockBadge } from "./StockBadge";
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
      className="group block overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="relative aspect-square overflow-hidden bg-white p-3">
        <TagRibbons tags={product.tags} />
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
        {/* Canto oposto ao das etiquetas (que ficam no alto, à direita): os dois
            selos podem coexistir sem um cobrir o outro. */}
        <div className="absolute bottom-3 left-3 z-10">
          <StockBadge badge={product.stockBadge} />
        </div>
      </div>

      <div className="p-4">
        {/* Uma linha só: com dois cards por linha no celular a categoria
            quebrava em duas em uns e não em outros, e o preço de cada card
            parava numa altura diferente — a fileira ficava desalinhada. */}
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {product.categoryName}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] leading-snug font-medium text-foreground">
          {product.name}
        </h3>
        <div className="mt-3">
          <PriceTag price={product.price} priceMax={product.priceMax} />
        </div>
      </div>
    </Link>
  );
}
