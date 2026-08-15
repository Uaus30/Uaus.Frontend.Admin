import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@workspace/ui";
import { TooltipProvider } from "@workspace/ui";
import { useState, useEffect, useRef, Suspense } from "react";
import { checkHealth } from "@workspace/api-client-react";
import { WifiOff, Loader2 } from "lucide-react";
import { useToast } from "@workspace/ui";
import { ROUTES, NOT_FOUND_COMPONENT } from "@/routes";
import { AuthGate, RequireRole } from "@/components/route-guards";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30000,
    },
  },
});

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
            <Route key={route.path} path={route.path}>
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

function OfflineBanner() {
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
  }, [toast]);

  if (!isOffline) return null;

  return (
    <>
      <style>{`
        [data-slot="sidebar-container"] {
          top: 40px !important;
          height: calc(100vh - 40px) !important;
        }
      `}</style>
      <div className="bg-red-600 text-white h-10 px-4 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 z-[9999] shrink-0 shadow-md">
        <WifiOff className="w-4 h-4 animate-bounce" />
        <span>
          {isReconnecting
            ? "Servidor indisponível no momento. Reconectando..."
            : `Servidor indisponível no momento. Tentando nova conexão em ${secondsRemaining}`}
        </span>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
          <OfflineBanner />
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;


