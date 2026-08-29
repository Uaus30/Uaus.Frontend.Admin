import { useMemo, useState } from "react";
import { useGetStorefrontProduct } from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { productDetailPath } from "@/routes";
import { buildReservationMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export interface ProductDetailState {
  product: ReturnType<typeof useGetStorefrontProduct>["data"];
  isLoading: boolean;
  /** 404 do backend: oculto, excluído ou inexistente — a tela não distingue. */
  isNotFound: boolean;
  isError: boolean;
  errorMessage: string;
  selectedImageIndex: number;
  selectImage: (index: number) => void;
  isLightboxOpen: boolean;
  setLightboxOpen: (open: boolean) => void;
  /** Nome da variação escolhida; `undefined` = nenhuma escolhida ainda. */
  selectedVariation?: string;
  selectVariation: (name?: string) => void;
  /** Link wa.me pronto com a mensagem de reserva do produto (e variação). */
  reservationUrl?: string;
}

/**
 * Estado da tela de detalhe: galeria, variação escolhida e o link de reserva.
 *
 * O link de reserva é recalculado a cada escolha de variação para a mensagem
 * citar exatamente o que o cliente quer — nome de produto repete no catálogo,
 * e a URL incluída na mensagem é o que deixa a lojista abrir o cadastro certo.
 */
export function useProductDetail(productGroupId: number): ProductDetailState {
  const query = useGetStorefrontProduct(productGroupId);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<string | undefined>(undefined);
  const [lastProductGroupId, setLastProductGroupId] = useState(productGroupId);

  // Navegou de um produto para outro: galeria, variação e lightbox voltam ao
  // início. Ajuste DURANTE o render (padrão do React para derivar estado de
  // prop): um efeito renderizaria um frame do produto novo com a galeria do
  // anterior antes de zerar.
  if (lastProductGroupId !== productGroupId) {
    setLastProductGroupId(productGroupId);
    setSelectedImageIndex(0);
    setSelectedVariation(undefined);
    setLightboxOpen(false);
  }

  const product = query.data;

  const reservationUrl = useMemo(() => {
    if (!product) return undefined;

    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${productDetailPath(product.productGroupId)}`
        : undefined;

    return buildWhatsAppUrl(
      buildReservationMessage({
        name: product.name,
        price: product.price,
        priceMax: product.priceMax,
        variationName: selectedVariation,
        url,
      }),
    );
  }, [product, selectedVariation]);

  return {
    product,
    isLoading: query.isLoading,
    isNotFound: query.isError && query.error.status === 404,
    isError: query.isError && query.error.status !== 404,
    errorMessage: query.error ? describeApiError(query.error) : "",
    selectedImageIndex,
    selectImage: setSelectedImageIndex,
    isLightboxOpen,
    setLightboxOpen,
    selectedVariation,
    selectVariation: setSelectedVariation,
    reservationUrl,
  };
}
