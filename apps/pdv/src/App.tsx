import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@workspace/ui";
import { TooltipProvider } from "@workspace/ui";
import { CloudOff } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineStore } from "@/stores/use-offline-store";
import Login from "@/pages/login";
import Pdv from "@/pages/pdv";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Pdv} />
      <Route component={() => <Redirect to="/" />} />
    </Switch>
  );
}

/**
 * Faixa de aviso do modo offline.
 *
 * O tom é deliberadamente calmo: sem internet o PDV **continua vendendo** contra
 * a base local, então isto informa uma situação, não um erro. A faixa vermelha
 * anterior dizia "servidor indisponível" e deixava o operador achando que o caixa
 * havia parado.
 */
function OfflineBanner() {
  const online = useOfflineStore((state) => state.online);
  const connectionChecked = useOfflineStore((state) => state.connectionChecked);
  const pending = useOfflineStore((state) => state.pending);

  // Antes da primeira sondagem não há o que informar; acusar queda aqui faria a
  // faixa piscar em toda abertura do PDV.
  if (!connectionChecked || online) return null;

  return (
    <div className="z-[9999] flex h-10 shrink-0 items-center justify-center gap-2 bg-amber-500 px-4 text-center text-xs font-medium text-amber-950 shadow-md sm:text-sm">
      <CloudOff className="h-4 w-4" />
      <span>
        Sem conexão com o servidor — o PDV está vendendo com a base local.
        {pending > 0 && ` ${pending} venda(s) aguardando sincronização.`}
      </span>
    </div>
  );
}

/**
 * Casca do PDV: monitor de conexão, faixa do modo offline e o roteador.
 *
 * O monitor é montado aqui, uma única vez — ele é a fonte da verdade de `online`
 * para todo o app, e duas instâncias sondariam a API em dobro.
 */
function Shell() {
  useConnectivity();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <OfflineBanner />
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Shell />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;


