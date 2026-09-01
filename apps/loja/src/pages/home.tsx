import { usePageTitle } from "@workspace/ui";
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
      <HeroSection />
      <FeaturedProducts />
      <VisitBanner />
      <StoreCarousel />
      <HighlightsGrid />
    </>
  );
}
