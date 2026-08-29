import { motion } from "framer-motion";
import { MapPin, ShoppingBag } from "lucide-react";
import { SITE_CONTACT } from "@/lib/site";
import storefrontPhoto from "@/assets/store/01_frente_loja.jpeg";

/**
 * Faixa escura com o cartão laranja — o VISUAL da seção de inauguração do site
 * original, com conteúdo perene: a inauguração (07/03/2026) já passou e o
 * countdown de lá renderizava nada. A textura de fundo era uma foto hotlinkada
 * do Pixabay; aqui é a fachada real da loja, servida do próprio bundle.
 *
 * Pendência de conteúdo: horário de funcionamento (não existe em nenhum
 * sistema). Quando definido, entra como terceira linha do cartão de infos.
 */
export function VisitBanner() {
  return (
    <section className="relative overflow-hidden bg-foreground py-16 text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay"
        style={{ backgroundImage: `url(${storefrontPhoto})` }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-8 rounded-3xl bg-gradient-to-r from-primary to-orange-600 p-8 shadow-2xl md:flex-row md:justify-between md:p-12"
        >
          <div className="max-w-xl text-center md:text-left">
            <h2 className="text-3xl font-bold md:text-5xl">Venha conhecer a loja!</h2>
            <p className="mt-4 text-lg text-white/90">
              Milhares de produtos esperando por você — e nenhum deles passa de R$ 30,00.
            </p>
          </div>

          <div className="min-w-[280px] rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white p-3 text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Onde</p>
                <p className="font-bold">{SITE_CONTACT.addressLine}</p>
                <p className="text-sm text-white/90">{SITE_CONTACT.addressDistrict}</p>
                <p className="text-sm text-white/80">{SITE_CONTACT.landmark}</p>
              </div>
            </div>

            <div className="my-4 h-px bg-white/20" aria-hidden />

            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white p-3 text-primary">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Preço máximo</p>
                <p className="font-bold">R$ 30,00 em tudo</p>
                <p className="text-sm text-white/90">Sem pegadinha e sem letra miúda</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
