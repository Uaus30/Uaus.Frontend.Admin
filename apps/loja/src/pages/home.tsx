import { usePageTitle } from "@workspace/ui";
import { FlashPromotionBanner } from "@/features/home/components/FlashPromotionBanner";
import { HeroSection } from "@/features/home/components/HeroSection";
import { FeaturedProducts } from "@/features/home/components/FeaturedProducts";
import { VisitBanner } from "@/features/home/components/VisitBanner";
import { StoreCarousel } from "@/features/home/components/StoreCarousel";
import { HighlightsGrid } from "@/features/home/components/HighlightsGrid";

/** Página inicial — composição pura das seções da feature `home`. */
export default function HomePage() {
  usePageTitle("Uaus! Máximo 30");

  return (
    <>
      {/* PRIMEIRO bloco da home, acima de tudo: a relâmpago dura horas e é a
          única coisa da página com prazo. Sem promoção no ar ele não renderiza
          nada — que é o caso da maior parte da semana. */}
      <FlashPromotionBanner />
      <HeroSection />
      <FeaturedProducts />
      <VisitBanner />
      <StoreCarousel />
      <HighlightsGrid />
    </>
  );
}
