import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { NAV_LINKS } from "@/routes";
import { SITE_CONTACT, SITE_NAME, SITE_OPENING_HOURS, SITE_TAGLINE } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import logoUrl from "@/assets/logo.png";

/**
 * Anel de foco padrão do cabeçalho. O anel nativo do navegador sumia contra o
 * laranja chapado da versão anterior — quem navega por teclado perdia a
 * posição no menu.
 */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2";

/** Mensagem do CTA do cabeçalho — nomeia a origem para a lojista saber de onde veio. */
const HEADER_WHATSAPP_MESSAGE = "Olá! Vim pelo site da Uaus.";

/**
 * Cabeçalho claro em duas alturas: faixa fina escura com endereço e horário, e
 * a barra branca com marca, navegação e o CTA de WhatsApp.
 *
 * Era laranja chapado de 96px, com logo de 80px, halo desfocado, `drop-shadow`
 * de brilho e `scale-110` no hover. Três motivos para inverter:
 *
 * 1. **Contraste.** Branco sobre o laranja da marca dá 2,69:1, e a nav inativa,
 *    em `white/80`, dava 2,20:1 — a WCAG AA pede 4,5:1. Nav escura sobre branco
 *    resolve sem tirar laranja nenhum da identidade.
 * 2. **Hierarquia.** O bloco mais pesado da página era a moldura, não o
 *    produto. Sobre branco, a marca aparece porque É laranja, não porque ganhou
 *    brilho.
 * 3. **Conversão.** A única conversão do site é a conversa no WhatsApp, e ela
 *    só existia no rodapé, no contato e no detalhe do produto. Agora acompanha
 *    o visitante: a barra é `sticky`, a faixa de cima rola embora.
 */
export function SiteHeader() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(`${path}/`);

  const navLinkClass = (path: string) =>
    isActive(path)
      ? `border-b-2 border-primary pb-1 text-sm font-semibold tracking-wide uppercase text-foreground ${FOCUS_RING}`
      : `border-b-2 border-transparent pb-1 text-sm font-semibold tracking-wide uppercase text-muted-foreground transition-colors hover:text-foreground ${FOCUS_RING}`;

  return (
    <>
      <div className="bg-foreground text-white">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8">
          <a
            href={SITE_CONTACT.mapsPlaceUrl}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-w-0 items-center gap-1.5 rounded text-white/70 transition-colors hover:text-white ${FOCUS_RING}`}
          >
            <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">
              {SITE_CONTACT.addressLine} — {SITE_CONTACT.addressDistrict}
            </span>
          </a>
          <span className="hidden shrink-0 text-white/70 sm:inline">
            {SITE_OPENING_HOURS ?? SITE_CONTACT.landmark}
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Ir para o início"
            className={`flex shrink-0 items-center gap-3 rounded-lg ${FOCUS_RING}`}
          >
            <img src={logoUrl} alt="" className="h-11 w-11 object-contain" />
            <span className="flex flex-col">
              <span className="font-display text-2xl leading-none font-extrabold text-foreground">
                {SITE_NAME}
              </span>
              <span className="font-display text-[11px] leading-tight font-bold tracking-[0.18em] text-primary-strong">
                {SITE_TAGLINE}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => (
              <Link key={link.path} href={link.path} className={navLinkClass(link.path)}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={buildWhatsAppUrl(HEADER_WHATSAPP_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              className={`hidden items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 sm:inline-flex ${FOCUS_RING}`}
            >
              <WhatsAppIcon className="h-4 w-4" />
              Falar no WhatsApp
            </a>

            <button
              type="button"
              className={`-mr-2 rounded-lg p-2 text-foreground md:hidden ${FOCUS_RING}`}
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Fechar o menu" : "Abrir o menu"}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
              className="overflow-hidden border-t border-border md:hidden"
              aria-label="Navegação principal"
            >
              <div className="space-y-1 px-4 py-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    onClick={() => setMobileOpen(false)}
                    className={
                      isActive(link.path)
                        ? `block rounded-xl bg-accent px-4 py-3 text-sm font-semibold uppercase text-primary-strong ${FOCUS_RING}`
                        : `block rounded-xl px-4 py-3 text-sm font-semibold uppercase text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS_RING}`
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
                  className={`flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white sm:hidden ${FOCUS_RING}`}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Falar no WhatsApp
                </a>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
