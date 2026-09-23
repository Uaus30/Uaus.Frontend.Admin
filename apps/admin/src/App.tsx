import { Switch, Route, Router as WouterRouter, Redirect, matchRoute, useLocation, useRouter } from "wouter";
import { PageTitleProvider } from "@/components/page-title";
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
import { AppLayout } from "@/components/layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProductReactivationDialog } from "@/components/product-reactivation-dialog";

const queryClient = createQueryClient();

/** Altura da faixa de conexão, em pixels, espelhando o `h-10` da classe. */
const OFFLINE_BANNER_HEIGHT = 40;

/** Carregando uma tela PÚBLICA, que não tem casca nenhuma em volta. */
const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Carregando o chunk de uma tela PRIVADA — ocupa só a área de conteúdo.
 *
 * Antes o fallback era de tela cheia e o `AppLayout` morava dentro de cada
 * página: trocar de menu apagava a barra lateral inteira até o chunk chegar, e a
 * tela "piscava escuro" a cada navegação. Agora a casca fica montada e só o
 * miolo espera.
 */
const ContentFallback = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/** As rotas que exigem sessão — todas, menos as marcadas como públicas. */
const ROTAS_PRIVADAS = ROUTES.filter((route) => !route.publica);

/**
 * A área autenticada, com a casca PERSISTENTE.
 *
 * O `AppLayout` fica aqui, fora do `<Switch>` de dentro, e não em cada página:
 * é isso que o mantém montado entre uma tela e outra. Trocar de rota troca só o
 * miolo, e a barra lateral não pisca.
 *
 * <b>Por que a 404 não entra aqui.</b> Ela precisa responder SEM sessão — quem
 * digitou um endereço errado tem que ler "não existe", e não cair num login que
 * não leva a lugar nenhum (é a decisão registrada em `pages/not-found.tsx`).
 * Por isso a casca só é montada quando a URL casa com alguma rota privada
 * conhecida; o resto cai na 404 pelada. O matcher é o do próprio wouter
 * (`matchRoute` + o `parser` do router), e não um segundo escrito à mão: rota e
 * menu saem da mesma fonte desde 2026, e um matcher paralelo é a porta para
 * eles divergirem de novo.
 */
function AreaPrivada() {
  const router = useRouter();
  const [location] = useLocation();

  const conhecida = ROTAS_PRIVADAS.some(
    (route) => matchRoute(router.parser, route.matchPath ?? route.path, location)[0],
  );

  if (!conhecida) return <NOT_FOUND_COMPONENT />;

  return (
    <AuthGate>
      <AppLayout>
        <Suspense fallback={<ContentFallback />}>
          <Switch>
            {ROTAS_PRIVADAS.map((route) => {
              const Page = route.component;

              return (
                // `matchPath` quando a página responde por mais de um caminho: um
                // `<Route>` só, para a página não desmontar entre eles (ver
                // `features/products/product-detail-route.ts`).
                <Route key={route.path} path={route.matchPath ?? route.path}>
                  {route.roles ? (
                    <RequireRole route={route}>
                      <Page />
                    </RequireRole>
                  ) : (
                    <Page />
                  )}
                </Route>
              );
            })}
          </Switch>
        </Suspense>
      </AppLayout>
    </AuthGate>
  );
}

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
 *
 * Exportado para o teste de `__tests__/app-shell.test.tsx`, que é quem prova as
 * duas propriedades desta estrutura: a casca não desmonta entre telas, e a 404
 * continua respondendo sem sessão.
 */
export function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />

      {/* Públicas: sem sessão e sem casca. O fallback aqui é de tela cheia
          porque não há barra lateral para preservar. */}
      {ROUTES.filter((route) => route.publica).map((route) => {
        const Page = route.component;

        return (
          <Route key={route.path} path={route.matchPath ?? route.path}>
            <Suspense fallback={<PageFallback />}>
              <Page />
            </Suspense>
          </Route>
        );
      })}

      <Route>
        <AreaPrivada />
      </Route>
    </Switch>
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
              {/* Dentro do Router: o título sai da rota corrente. */}
              <PageTitleProvider>
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
              </PageTitleProvider>
            </WouterRouter>
          </div>
        </div>
        {/* A versão entra no relatório que o clique no toast copia: separa "já
            corrigi" de "a loja está num build antigo". */}
        <Toaster appVersion={import.meta.env.VITE_APP_VERSION} />
        {/* Fora das rotas: o recebimento de compra navega logo depois de gravar,
            e o aviso de reativação tem que sobreviver à troca de tela. */}
        <ProductReactivationDialog />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
