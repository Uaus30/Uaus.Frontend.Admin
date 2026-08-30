import { ShoppingBag, Star, Store } from "lucide-react";

/**
 * Grade de destaques da home — três cartões com o do meio promovido, texto
 * verbatim do site original.
 */
export function HighlightsGrid() {
  return (
    <section className="border-t border-border bg-background py-20">
      <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        <div className="rounded-3xl border border-border bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-foreground">Presentes</h3>
          <p className="mt-3 text-muted-foreground">Brinquedos, utilidades de casa, livros e muito mais</p>
        </div>

        <div className="z-10 rounded-3xl bg-primary p-8 text-center text-white shadow-lg md:-my-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-primary">
            <Star className="h-10 w-10" />
          </div>
          <h3 className="mt-6 text-2xl font-black">MÁXIMO 30 REAIS</h3>
          <p className="mt-3 text-white/90">
            Nenhum produto da loja passa de R$ 30,00. É a regra da casa, sem exceção e sem letra miúda.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary">
            <Store className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-foreground">Diversidade</h3>
          <p className="mt-3 text-muted-foreground">
            Diversos outros produtos: Roupa íntima, toalhas, panos de prato, ferramentas, etc...
          </p>
        </div>
      </div>
    </section>
  );
}
