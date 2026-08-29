import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { NAV_LINKS } from "@/routes";
import { SITE_CONTACT, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import logoUrl from "@/assets/logo.png";

/**
 * Anel de foco do cabeçalho. Branco, e não laranja: sobre o laranja da marca o
 * anel nativo do navegador some, e quem navega por teclado perde a posição.
 */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

/** Mensagem do CTA do cabeçalho — nomeia a origem para a lojista saber de onde veio. */
const HEADER_WHATSAPP_MESSAGE = "Olá! Vim pelo site da Uaus.";

/**
 * Cabeçalho laranja fixo: logo com glow no hover, wordmark em duas linhas e
 * navegação derivada de `NAV_LINKS` — o menu nunca diverge das rotas porque
 * nasce delas.
 *
 * O laranja chapado é decisão do dono (29/08/2026): a fachada da loja é
 * laranja, e o cabeçalho é a fachada do site. Chegou a virar barra branca por
 * causa do contraste — branco sobre `#FF751A` dá 2,69:1, abaixo dos 4,5:1 da
 * WCAG AA — e voltou. O que sobrou da tentativa, porque não custa a
 * identidade: nav em branco puro (era `white/80`, 2,20:1), anel de foco
 * visível e o CTA de WhatsApp, que antes só existia no rodapé, no contato e no
 * detalhe do produto.
 *
 * O CTA leva contorno branco por pedido do dono: o verde sobre o laranja tem
 * borda fraca, e a linha é o que separa os dois.
 *
 * A faixa de endereço e referência fica ABAIXO do cabeçalho, não acima: ela
 * empurrava a marca para o meio da tela e roubava o primeiro olhar de quem
 * chega. Embaixo, ela é a primeira coisa DEPOIS da marca — e rola embora,
 * enquanto o cabeçalho gruda.
 */
export function SiteHeader() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(`${path}/`);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-primary shadow-lg">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={`group flex shrink-0 items-center gap-3 rounded-lg ${FOCUS_RING}`}
            aria-label="Ir para o início"
          >
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-white/40 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
              <img
                src={logoUrl}
                alt=""
                className="relative h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-4xl leading-none font-black text-white">{SITE_NAME}</span>
              <span className="font-display text-sm font-bold tracking-[0.2em] text-white/90">
                {SITE_TAGLINE}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={
                  isActive(link.path)
                    ? `border-b-2 border-white py-1 text-sm font-bold text-white uppercase ${FOCUS_RING}`
                    : `border-b-2 border-transparent py-1 text-sm font-bold text-white uppercase transition-opacity duration-200 hover:opacity-80 ${FOCUS_RING}`
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={buildWhatsAppUrl(HEADER_WHATSAPP_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              className={`hidden items-center gap-2 rounded-xl border-2 border-white bg-green-700 px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-green-600 sm:inline-flex ${FOCUS_RING}`}
            >
              <WhatsAppIcon className="h-4 w-4" />
              Falar no WhatsApp
            </a>

            <button
              type="button"
              className={`-mr-2 rounded-lg p-2 text-white lg:hidden ${FOCUS_RING}`}
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Fechar o menu" : "Abrir o menu"}
            >
              {mobileOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="overflow-hidden lg:hidden"
              aria-label="Navegação principal"
            >
              <div className="space-y-1 px-4 pb-4">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    onClick={() => setMobileOpen(false)}
                    className={
                      isActive(link.path)
                        ? `block rounded-xl bg-white px-4 py-3 text-sm font-bold text-primary-strong uppercase ${FOCUS_RING}`
                        : `block rounded-xl px-4 py-3 text-sm font-bold text-white uppercase hover:bg-white/10 ${FOCUS_RING}`
                    }
                  >
                    {link.label}
                  </Link>
                ))}

                <a
                  href={buildWhatsAppUrl(HEADER_WHATSAPP_MESSAGE)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 border-white bg-green-700 px-4 py-3 text-sm font-bold text-white sm:hidden ${FOCUS_RING}`}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Falar no WhatsApp
                </a>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-center px-4 text-xs sm:px-6 lg:justify-start lg:px-8">
          <a
            href={SITE_CONTACT.mapsPlaceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 rounded text-muted-foreground transition-colors hover:text-primary-strong focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary-strong" />
            <span className="truncate">
              {SITE_CONTACT.addressLine} — {SITE_CONTACT.addressDistrict}
            </span>
            <span aria-hidden className="hidden text-border sm:inline">
              ·
            </span>
            <span className="hidden shrink-0 sm:inline">{SITE_CONTACT.landmark}</span>
          </a>
        </div>
      </div>
    </>
  );
}
