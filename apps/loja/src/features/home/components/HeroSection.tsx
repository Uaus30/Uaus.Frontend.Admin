import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Store } from "lucide-react";
import { Link } from "wouter";

/**
 * As três provas que respondem "isso aqui é loja de verdade?" antes do
 * primeiro clique: a regra de preço, como se compra e onde fica. Ficam abaixo
 * dos botões porque quem já decidiu clica antes de ler.
 */
const PROOF_POINTS = ["Nenhum produto acima de R$ 30,00", "Reserva pelo WhatsApp", "Tapira-PR, no Centro"];

/**
 * Hero da home — o texto é o do site original; a ênfase, não.
 *
 * O que saiu, e por quê: o `<h1>` tinha 72px em peso 900 com `bg-clip-text`
 * gradiente, e o gradiente laranja→laranja a 15° de diferença não comunica
 * nada — só tira nitidez da borda da letra. Saiu também o `<span>` espaçador
 * de altura fixa que existia dentro do heading só para forçar a quebra de
 * linha: dois blocos resolvem sem elemento fantasma no meio do título.
 */
export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-surface pt-16 pb-20">
      <div
        aria-hidden
        className="absolute -top-48 -right-48 h-[620px] w-[620px] rounded-full bg-primary/10 blur-3xl"
      />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
        className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-primary">
          <Store className="h-4 w-4" />
          Nova loja em Tapira-PR
        </span>

        <h1 className="mt-7 text-4xl leading-[1.12] font-black text-balance text-foreground md:text-6xl">
          Chegou em Tapira...
          <span className="mt-3 block text-primary">Uma loja com tudo por no máximo 30 reais!</span>
        </h1>

        <p className="mt-7 text-lg text-muted-foreground">
          A Uaus fica na rua da prefeitura, pertinho do Correio e traz até você um conceito inovador:
          qualidade, variedade e preço baixo de verdade. Nenhum produto em nossa loja custa mais que 30
          reais... Surpreenda-se!
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/produtos"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-strong px-8 py-4 font-semibold text-white transition-colors duration-200 hover:bg-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Ver Super Ofertas
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/contato"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-8 py-4 font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Fale Conosco
          </Link>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {PROOF_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
              {point}
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
