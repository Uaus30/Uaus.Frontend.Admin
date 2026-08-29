import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCarousel } from "../hooks/useCarousel";
import photo1 from "@/assets/store/01_frente_loja.jpeg";
import photo2 from "@/assets/store/02_cozinha.jpeg";
import photo3 from "@/assets/store/03_potes.jpeg";
import photo4 from "@/assets/store/04_ferramentas.jpeg";
import photo5 from "@/assets/store/05_acessorios.jpeg";
import photo6 from "@/assets/store/06_brinquedos.jpeg";
import photo7 from "@/assets/store/07_livros.jpeg";

const SLIDES = [
  { src: photo1, alt: "Fachada da loja Uaus em Tapira-PR" },
  { src: photo2, alt: "Corredor de utilidades de cozinha" },
  { src: photo3, alt: "Prateleiras de potes e utilidades coloridas" },
  { src: photo4, alt: "Seção de ferramentas" },
  { src: photo5, alt: "Seção de acessórios" },
  { src: photo6, alt: "Seção de brinquedos" },
  { src: photo7, alt: "Estante de livros" },
];

/**
 * Carrossel com as fotos reais da loja, portado do site original — com as
 * melhorias que faltavam lá: pausa no hover e swipe no toque (ver useCarousel).
 */
export function StoreCarousel() {
  const carousel = useCarousel(SLIDES.length);
  const slide = SLIDES[carousel.index];

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black text-foreground md:text-5xl">Conheça nossa loja</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Um ambiente preparado para receber você com bom atendimento e muitos produtos.
        </p>

        <div
          className="group relative mx-auto mt-12 aspect-[16/9] max-w-4xl touch-pan-y overflow-hidden rounded-3xl border border-border bg-gray-100 shadow-2xl"
          onMouseEnter={carousel.pause}
          onMouseLeave={carousel.resume}
          onPointerDown={(event) => carousel.onPointerDown(event.clientX)}
          onPointerUp={(event) => carousel.onPointerUp(event.clientX)}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={carousel.index}
              src={slide.src}
              alt={slide.alt}
              draggable={false}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="h-full w-full select-none object-cover"
            />
          </AnimatePresence>

          <button
            type="button"
            onClick={carousel.prev}
            aria-label="Foto anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 opacity-0 shadow-lg transition-all duration-300 hover:bg-primary hover:text-white group-hover:opacity-100"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={carousel.next}
            aria-label="Próxima foto"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 opacity-0 shadow-lg transition-all duration-300 hover:bg-primary hover:text-white group-hover:opacity-100"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {SLIDES.map((entry, index) => (
            <button
              key={entry.src}
              type="button"
              onClick={() => carousel.goTo(index)}
              aria-label={`Ir para a foto ${index + 1}`}
              aria-current={index === carousel.index}
              className={
                index === carousel.index
                  ? "h-3 w-8 rounded-full bg-primary transition-all duration-300"
                  : "h-3 w-3 rounded-full bg-orange-200 transition-all duration-300 hover:bg-orange-300"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
