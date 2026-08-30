import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, MapPin } from "lucide-react";
import { SITE_CONTACT, SITE_OPENING_HOURS } from "@/lib/site";
import storefrontPhoto from "@/assets/store/01_frente_loja.jpeg";

/** Uma informação do cartão: ícone quadrado, rótulo e as linhas de detalhe. */
function InfoRow({
  icon: Icon,
  label,
  title,
  lines = [],
  children,
}: {
  icon: typeof MapPin;
  label: string;
  title?: string;
  lines?: string[];
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-xl bg-white p-3 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/80">{label}</p>
        {title && <p className="font-semibold">{title}</p>}
        {lines.map((line) => (
          <p key={line} className="text-sm text-white/90">
            {line}
          </p>
        ))}
        {children}
      </div>
    </div>
  );
}

/** Separador entre as informações do cartão. */
function Divider() {
  return <div className="my-4 h-px bg-white/20" aria-hidden />;
}

/**
 * Faixa escura com o cartão laranja — o VISUAL da seção de inauguração do site
 * original, com conteúdo perene: a inauguração (07/03/2026) já passou e o
 * countdown de lá renderizava nada. A textura de fundo era uma foto hotlinkada
 * do Pixabay; aqui é a fachada real da loja, servida do próprio bundle.
 *
 * O cartão era um gradiente `primary → orange-600`, depois o laranja escurecido
 * (`primary-strong`); em 30/08/2026 o dono trouxe o laranja da marca de volta
 * para o repouso — a mesma reversão que já tinha acontecido nos textos.
 *
 * O cartão responde a duas perguntas, e só: **onde fica** e **está aberto?**.
 * A terceira linha, "Preço máximo — R$ 30,00 em tudo", saiu em 30/08/2026: o
 * parágrafo ao lado já diz "nenhum deles passa de R$ 30,00", o nome da loja é
 * "Máximo 30" e o cartão do meio da home repete a regra em caixa alta. Dizer de
 * novo aqui não informava nada e ainda empurrava o horário — que é o dado
 * realmente consultado antes de sair de casa — para o meio de uma lista de três.
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
          className="flex flex-col items-center gap-8 rounded-3xl bg-primary p-8 shadow-lg md:flex-row md:justify-between md:p-12"
        >
          <div className="max-w-xl text-center md:text-left">
            <h2 className="text-3xl font-bold md:text-4xl">Venha conhecer a loja!</h2>
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

            <Divider />

            <InfoRow icon={Clock} label="Horário">
              <dl className="mt-0.5 space-y-1.5">
                {SITE_OPENING_HOURS.map((rule) => (
                  <div key={rule.days}>
                    <dt className="text-sm font-semibold">{rule.days}</dt>
                    <dd className="text-sm text-white/90">{rule.hours}</dd>
                  </div>
                ))}
              </dl>
            </InfoRow>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
