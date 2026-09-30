import { useEffect } from "react";
import { useLocation } from "wouter";
import { getCollector } from "@/lib/metrics";
import { FLUSH_INTERVAL_MS } from "@/lib/metrics/collector";
import { toMetricsRoute } from "@/lib/metrics/routes";

/**
 * Liga o coletor de métricas ao ciclo de vida da página. Global, como o
 * `ScrollToTop`: nenhuma página precisa lembrar de se contar.
 *
 * Os sinais do navegador que valem no celular são `visibilitychange` e
 * `pagehide`; `beforeunload` não dispara de forma confiável e por isso não
 * entra. Ao ficar oculta a página fecha e o lote sai — se o sistema matar a
 * aba depois, nada se perdeu. O tique de 15 s cobre o caso sem sinal nenhum
 * (a aba morre visível, com a rede caída): no pior caso perdem-se 15 s de
 * tempo, nunca um evento de navegação.
 *
 * `pageshow` com `persisted` é a volta pelo bfcache (Voltar do navegador
 * depois de sair do site): o `pagehide` já fechou a página, então ela reabre
 * como page_view da rota atual.
 */
export function SiteMetrics() {
  const [location] = useLocation();

  useEffect(() => {
    const collector = getCollector();
    if (!collector.isEnabled) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") collector.hidden();
      else collector.visible();
    };
    const onPageHide = () => collector.leave();
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const route = toMetricsRoute(window.location.pathname);
      collector.pageView(route.path, route.productGroupId);
    };
    const onActivity = () => collector.activity();
    const tick = window.setInterval(() => collector.tick(), FLUSH_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    // `passive`: nenhum destes ouvintes cancela nada, e sem a marca o navegador
    // esperaria por eles antes de rolar.
    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const name of activityEvents) window.addEventListener(name, onActivity, { passive: true });

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      for (const name of activityEvents) window.removeEventListener(name, onActivity);
    };
  }, []);

  useEffect(() => {
    const route = toMetricsRoute(location);
    getCollector().pageView(route.path, route.productGroupId);
  }, [location]);

  return null;
}
