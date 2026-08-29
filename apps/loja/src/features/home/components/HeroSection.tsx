import { motion } from "framer-motion";
import { ArrowRight, Store } from "lucide-react";
import { Link } from "wouter";

/** Hero da home — texto e hierarquia portados verbatim do site original. */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-orange-50/50 pb-32 pt-20">
      <div
        aria-hidden
        className="absolute -right-40 -top-40 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm">
          <Store className="h-4 w-4" />
          Nova loja em Tapira-PR
        </span>

        <h1 className="mt-8 text-5xl font-black leading-[1.1] text-foreground md:text-7xl">
          Chegou em Tapira...
          <span className="block h-4 md:h-8" aria-hidden />
          <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            Uma loja com tudo por no máximo 30 reais!
          </span>
        </h1>

        <p className="mt-8 text-lg text-muted-foreground md:text-xl">
          A Uaus fica na rua da prefeitura, pertinho do Correio e traz até você um conceito inovador:
          qualidade, variedade e preço baixo de verdade. Nenhum produto em nossa loja custa mais que 30
          reais... Surpreenda-se!
        </p>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/produtos"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-400 px-8 py-4 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            Ver Super Ofertas
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/contato"
            className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-white px-8 py-4 font-bold text-foreground shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-orange-50"
          >
            Fale Conosco
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
