import { ArrowLeft, PackageSearch } from "lucide-react";
import { Link, useParams } from "wouter";
import { formatCurrency } from "@workspace/core";
import { Skeleton } from "@workspace/ui";
import { usePageTitle } from "@/lib/page-title";
import { buildBreadcrumbJsonLd, useJsonLd } from "@/lib/structured-data";
import { catalogPath, productDetailPath } from "@/routes";
import { useProductDetail } from "@/features/catalog/hooks/useProductDetail";
import { PriceTag } from "@/features/catalog/components/PriceTag";
import { ProductBreadcrumb } from "@/features/catalog/components/ProductBreadcrumb";
import { ProductGallery } from "@/features/catalog/components/ProductGallery";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

function DetailSkeleton() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Detalhe do produto (`/produtos/:id`, id = grupo). A página renderiza o que
 * `useProductDetail` devolve; galeria, variação e link de reserva moram no hook.
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productGroupId = Number(params.id);
  const detail = useProductDetail(productGroupId);
  usePageTitle(detail.product ? `Uaus | ${detail.product.name}` : undefined);

  // A mesma trilha da tela, em dados estruturados: é assim que o resultado do
  // Google troca a URL crua pelo caminho legível. Fica na página, e não dentro
  // do componente da trilha, porque é metadado do documento — o mesmo lugar de
  // onde o `usePageTitle` escreve.
  const product = detail.product;
  useJsonLd(
    "breadcrumb-produto",
    product
      ? buildBreadcrumbJsonLd(
          [
            {
              name: product.departmentName,
              path: catalogPath({ departmentId: product.departmentId }),
            },
            {
              name: product.categoryName,
              path: catalogPath({
                departmentId: product.departmentId,
                categoryId: product.categoryId,
              }),
            },
            { name: product.name, path: productDetailPath(product.productGroupId) },
          ],
          window.location.origin,
        )
      : undefined,
  );

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/produtos"
          className="inline-flex items-center gap-2 rounded text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos produtos
        </Link>

        <div className="mt-6">
          {detail.isLoading ? (
            <DetailSkeleton />
          ) : detail.isNotFound || detail.isError || !detail.product ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <PackageSearch className="h-12 w-12 text-primary" aria-hidden />
              <h1 className="text-2xl font-black text-foreground">
                {detail.isNotFound ? "Produto não encontrado" : "Ops! Não conseguimos carregar o produto."}
              </h1>
              <p className="max-w-md text-muted-foreground">
                {detail.isNotFound
                  ? "Ele pode ter saído do site — mas a loja está cheia de outras ofertas."
                  : detail.errorMessage || "Tente novamente em instantes."}
              </p>
              <Link
                href="/produtos"
                className="mt-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
              >
                Ver todos os produtos
              </Link>
            </div>
          ) : (
            <>
              <ProductBreadcrumb product={detail.product} />

              <div className="mt-6 grid gap-10 md:grid-cols-2">
                <ProductGallery
                  product={detail.product}
                  selectedIndex={detail.selectedImageIndex}
                  onSelect={detail.selectImage}
                  isLightboxOpen={detail.isLightboxOpen}
                  onLightboxChange={detail.setLightboxOpen}
                />

                <div>
                  {/* A categoria era um texto solto aqui; agora ela é o segundo
                    degrau da trilha, no topo da página, e leva à vitrine
                    filtrada em vez de só informar. */}
                  <h1 className="text-3xl font-black text-foreground md:text-4xl">{detail.product.name}</h1>

                  {detail.product.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detail.product.tags.map((tag) => (
                        <span
                          key={tag.name}
                          style={{ backgroundColor: tag.color }}
                          className="rounded-full px-3 py-1 text-xs font-bold uppercase text-white"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {detail.product.description && (
                    <p className="mt-5 leading-relaxed text-muted-foreground">{detail.product.description}</p>
                  )}

                  <div className="mt-6 rounded-2xl border border-border bg-white p-5">
                    <PriceTag price={detail.product.price} priceMax={detail.product.priceMax} size="lg" />
                  </div>

                  {detail.product.variations.length > 0 && (
                    <div className="mt-6">
                      <p className="font-bold text-foreground">Escolha uma opção:</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {detail.product.variations.map((variation) => (
                          <button
                            key={variation.name}
                            type="button"
                            onClick={() =>
                              detail.selectVariation(
                                detail.selectedVariation === variation.name ? undefined : variation.name,
                              )
                            }
                            aria-pressed={detail.selectedVariation === variation.name}
                            className={
                              detail.selectedVariation === variation.name
                                ? "rounded-xl border-2 border-primary bg-accent px-4 py-2 text-sm font-semibold text-primary"
                                : "rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/60"
                            }
                          >
                            {variation.name} — {formatCurrency(variation.price)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.reservationUrl && (
                    <>
                      <a
                        href={detail.reservationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="animate-pulse-glow mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-6 py-5 text-center font-bold text-white shadow-sm transition-colors duration-200 hover:bg-green-600 focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        <WhatsAppIcon className="h-5 w-5" />
                        RESERVAR PELO WHATSAPP
                      </a>
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        A reserva abre no seu WhatsApp com o produto já preenchido — nada é enviado sem você
                        confirmar.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
