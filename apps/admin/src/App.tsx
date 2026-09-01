import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@workspace/ui";
import { TooltipProvider } from "@workspace/ui";
import { useState, useEffect, useRef, Suspense } from "react";
import { checkHealth, createQueryClient } from "@workspace/api-client-react";
import { WifiOff, Loader2 } from "lucide-react";
import { useToast } from "@workspace/ui";
import { DevEnvironmentBanner, DEV_ENVIRONMENT_BANNER_HEIGHT, isDevEnvironment } from "@workspace/ui";
import { ROUTES, NOT_FOUND_COMPONENT } from "@/routes";
import { AuthGate, RequireRole } from "@/components/route-guards";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = createQueryClient();

/** Altura da faixa de conexão, em pixels, espelhando o `h-10` da classe. */
const OFFLINE_BANNER_HEIGHT = 40;

const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Rotas derivadas de `src/routes.tsx`, a fonte única.
 *
 * Nenhum caminho é escrito aqui: menu e rota saíam de duas listas mantidas à mão
 * em sincronia, e já divergiam — a tela de formas de pagamento respondia em dois
 * caminhos e só um aparecia no menu.
 *
 * Toda rota privada passa pelo `AuthGate`; as que declaram `roles` ganham o
 * `RequireRole` por cima. Antes a proteção dependia de cada página lembrar de
 * renderizar o `<AppLayout>`.
 */
function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        {ROUTES.map((route) => {
          const Page = route.component;

          return (
            // `matchPath` quando a página responde por mais de um caminho: um
            // `<Route>` só, para a página não desmontar entre eles (ver
            // `features/products/product-detail-route.ts`).
            <Route key={route.path} path={route.matchPath ?? route.path}>
              {route.publica ? (
                <Page />
              ) : (
                <AuthGate>
                  {route.roles ? (
                    <RequireRole route={route}>
                      <Page />
                    </RequireRole>
                  ) : (
                    <Page />
                  )}
                </AuthGate>
              )}
            </Route>
          );
        })}
        <Route component={NOT_FOUND_COMPONENT} />
      </Switch>
    </Suspense>
  );
}

/**
 * Faixa de servidor indisponível.
 *
 * O estado vive aqui porque é aqui que a sondagem acontece, mas ele também é
 * avisado ao `App` por `onOfflineChange`: quem calcula o deslocamento do sidebar
 * precisa saber quantas faixas estão no ar, e a faixa de ambiente pode estar
 * ocupando espaço junto. Passe um `setState` (identidade estável) — uma função
 * recriada a cada render reinicia o timer da sondagem.
 */
function OfflineBanner({ onOfflineChange }: { onOfflineChange: (offline: boolean) => void }) {
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wasOfflineRef = useRef(false);
  const isOfflineRef = useRef(false);

  useEffect(() => {
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    const performCheck = async () => {
      setIsReconnecting(true);
      const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 3000));
      const okPromise = checkHealth();

      const [_, ok] = await Promise.all([minDelayPromise, okPromise]);
      const currentOffline = !ok;

      setIsOffline(currentOffline);
      onOfflineChange(currentOffline);
      isOfflineRef.current = currentOffline;

      if (wasOfflineRef.current && !currentOffline) {
        // Reconectou: o que está NA TELA pode ter envelhecido durante a queda.
        //
        // `type: "active"` limita a invalidação às queries com observador vivo.
        // Sem ele, todo o cache inativo era ressuscitado de uma vez — e como
        // invalidação ignora staleTime, a reconexão virava o pior momento
        // possível para uma tempestade de requisições.
        queryClient.invalidateQueries({ type: "active" });
        toast({
          title: "Conexão Restabelecida",
          description: "A conexão com o servidor foi restabelecida com sucesso.",
          className: "bg-emerald-500 text-white border-none",
        });
      }
      wasOfflineRef.current = currentOffline;

      const nextLimit = currentOffline ? 5 : 10;
      setSecondsRemaining(nextLimit);
      setIsReconnecting(false);
    };

    performCheck();

    countdownTimer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 0) {
          performCheck();
          return isOfflineRef.current ? 5 : 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [toast, onOfflineChange]);

  if (!isOffline) return null;

  return (
    <div className="bg-red-600 text-white h-10 px-4 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 z-[9999] shrink-0 shadow-md">
      <WifiOff className="w-4 h-4 animate-bounce" />
      <span>
        {isReconnecting
          ? "Servidor indisponível no momento. Reconectando..."
          : `Servidor indisponível no momento. Tentando nova conexão em ${secondsRemaining}`}
      </span>
    </div>
  );
}

/**
 * Empurra o sidebar para baixo das faixas do topo.
 *
 * O container do sidebar é `fixed inset-y-0 h-svh` (`packages/ui/…/sidebar.tsx`),
 * então ele ignora o fluxo do documento e passaria POR BAIXO das faixas — o que
 * esconde o cabeçalho do menu.
 *
 * O deslocamento mora aqui, e não dentro de cada faixa, porque precisa ser a
 * SOMA das visíveis. Enquanto ele vivia no `OfflineBanner` com `40px` fixo,
 * bastou existir uma segunda faixa para o cálculo ficar errado sempre que as
 * duas aparecessem juntas.
 */
function SidebarTopOffset({ height }: { height: number }) {
  if (height === 0) return null;

  return (
    <style>{`
      [data-slot="sidebar-container"] {
        top: ${height}px !important;
        height: calc(100vh - ${height}px) !important;
      }
    `}</style>
  );
}

function App() {
  const [isOffline, setIsOffline] = useState(false);
  const topBannersHeight =
    (isOffline ? OFFLINE_BANNER_HEIGHT : 0) + (isDevEnvironment() ? DEV_ENVIRONMENT_BANNER_HEIGHT : 0);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarTopOffset height={topBannersHeight} />
        <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
          <OfflineBanner onOfflineChange={setIsOffline} />
          <DevEnvironmentBanner />
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </WouterRouter>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
