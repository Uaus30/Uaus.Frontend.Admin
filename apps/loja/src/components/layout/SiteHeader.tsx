import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { NAV_LINKS } from "@/routes";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import logoUrl from "@/assets/logo.png";

/**
 * Cabeçalho laranja fixo, portado do site original: logo com glow no hover,
 * wordmark em duas linhas e navegação derivada de `NAV_LINKS` — o menu nunca
 * diverge das rotas porque nasce delas.
 */
export function SiteHeader() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-primary shadow-lg">
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="Ir para o início">
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

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={
                isActive(link.path)
                  ? "border-b-2 border-white py-1 text-sm font-bold uppercase text-white"
                  : "py-1 text-sm font-bold uppercase text-white/80 transition-all duration-200 hover:scale-105 hover:text-white"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="text-white md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Fechar o menu" : "Abrir o menu"}
        >
          {mobileOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden md:hidden"
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
                      ? "block rounded-xl bg-white px-4 py-3 text-sm font-bold uppercase text-primary"
                      : "block rounded-xl px-4 py-3 text-sm font-bold uppercase text-white/90 hover:bg-white/10"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
