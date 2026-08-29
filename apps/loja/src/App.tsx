import { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError, createQueryClient, STALE_TIME } from "@workspace/api-client-react";
import { DevEnvironmentBanner, Spinner } from "@workspace/ui";
import { Redirect, Route, Router as WouterRouter, Switch } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { SiteLayout } from "@/components/layout/SiteLayout";
import {
  LEGACY_REDIRECTS,
  NOT_FOUND_COMPONENT,
  PRODUCT_DETAIL_COMPONENT,
  PRODUCT_DETAIL_ROUTE,
  ROUTES,
} from "@/routes";

/**
 * Cadência de site vitrine, diferente do padrão dos apps internos:
 *
 * - `staleTime` de catálogo: o dado só muda quando o admin edita, e ninguém
 *   invalida cache no navegador de um visitante — o tempo é o único mecanismo.
 * - Retry seletivo: o `createQueryClient` desliga retry porque no admin/PDV
 *   erro rápido é melhor que spinner longo. Aqui é o inverso — visitante em 4G
 *   oscilante não sabe recarregar; duas tentativas silenciosas salvam a
 *   visita. MAS só para o que pode sarar (falha de rede, 5xx): re-tentar um
 *   404 do detalhe deixava o esqueleto na tela por segundos para no fim dizer
 *   a mesma coisa — 4xx não muda de resposta.
 * - Sem `refetchOnWindowFocus`: vitrine não é dashboard.
 */
const queryClient = createQueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME.catalogo,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

function SiteRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
          <Route key={from} path={from}>
            <Redirect to={to} replace />
          </Route>
        ))}

        {/* O detalhe vem ANTES da lista: "/produtos/:id" é mais específico que
            "/produtos" e o Switch para no primeiro que casar. A forma filho
            (em vez da prop `component`) é deliberada: as páginas não recebem
            props — quem tem parâmetro lê via useParams. */}
        <Route path={PRODUCT_DETAIL_ROUTE}>
          <PRODUCT_DETAIL_COMPONENT />
        </Route>

        {ROUTES.map((route) => (
          <Route key={route.path} path={route.path}>
            <route.component />
          </Route>
        ))}

        <Route>
          <NOT_FOUND_COMPONENT />
        </Route>
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DevEnvironmentBanner />
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <ScrollToTop />
        <ErrorBoundary>
          <SiteLayout>
            <SiteRouter />
          </SiteLayout>
        </ErrorBoundary>
      </WouterRouter>
    </QueryClientProvider>
  );
}
