import { motion, useReducedMotion } from "framer-motion";
import { Clock, MapPin, ShoppingBag } from "lucide-react";
import { SITE_CONTACT, SITE_OPENING_HOURS } from "@/lib/site";
import storefrontPhoto from "@/assets/store/01_frente_loja.jpeg";

/** Uma informação do cartão: ícone quadrado, rótulo e duas linhas de detalhe. */
function InfoRow({
  icon: Icon,
  label,
  title,
  lines,
}: {
  icon: typeof MapPin;
  label: string;
  title: string;
  lines: string[];
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-xl bg-white p-3 text-primary-strong">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="text-sm text-white/90">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Faixa escura com o cartão laranja — o VISUAL da seção de inauguração do site
 * original, com conteúdo perene: a inauguração (07/03/2026) já passou e o
 * countdown de lá renderizava nada. A textura de fundo era uma foto hotlinkada
 * do Pixabay; aqui é a fachada real da loja, servida do próprio bundle.
 *
 * O cartão era um gradiente `primary → orange-600`; virou o laranja sólido que
 * escreve (`primary-strong`), porque é ele que carrega texto branco aqui.
 *
 * A terceira linha só aparece quando o horário de funcionamento existir — ver
 * `SITE_OPENING_HOURS`, que segue pendente por não haver o dado em sistema
 * nenhum.
 */
export function VisitBanner() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-foreground py-16 text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay"
        style={{ backgroundImage: `url(${storefrontPhoto})` }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
          className="flex flex-col items-center gap-8 rounded-3xl bg-primary-strong p-8 shadow-lg md:flex-row md:justify-between md:p-12"
        >
          <div className="max-w-xl text-center md:text-left">
            <h2 className="text-3xl font-extrabold md:text-4xl">Venha conhecer a loja!</h2>
            <p className="mt-4 text-lg text-white/90">
              Milhares de produtos esperando por você — e nenhum deles passa de R$ 30,00.
            </p>
          </div>

          <div className="min-w-[280px] rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
            <InfoRow
              icon={MapPin}
              label="Onde"
              title={SITE_CONTACT.addressLine}
              lines={[SITE_CONTACT.addressDistrict, SITE_CONTACT.landmark]}
            />

            <div className="my-4 h-px bg-white/20" aria-hidden />

            <InfoRow
              icon={ShoppingBag}
              label="Preço máximo"
              title="R$ 30,00 em tudo"
              lines={["Sem pegadinha e sem letra miúda"]}
            />

            {SITE_OPENING_HOURS && (
              <>
                <div className="my-4 h-px bg-white/20" aria-hidden />
                <InfoRow icon={Clock} label="Quando" title={SITE_OPENING_HOURS} lines={[]} />
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
