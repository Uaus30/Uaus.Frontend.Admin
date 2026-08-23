import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient, STALE_TIME, useGetMe } from "@workspace/api-client-react";
import { Toaster } from "@workspace/ui";
import { TooltipProvider } from "@workspace/ui";
import { DevEnvironmentBanner } from "@workspace/ui";
import { CloudOff, Loader2 } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineStore } from "@/stores/use-offline-store";
import Login from "@/pages/login";
import Pdv from "@/pages/pdv";

const queryClient = createQueryClient();

/**
 * Exige sessão para **montar** o PDV.
 *
 * O redirecionamento sozinho não bastava. Ele mora em `usePdvOperator`, dentro
 * de um efeito — e efeito roda depois do render, quando os outros hooks da
 * página já dispararam suas consultas. Abrir o PDV sem sessão mandava quatro
 * requisições autenticadas para a API (`/CompanySettings`, `/PaymentMethods`,
 * `/Pdv/sales/today`, `/Pdv/snapshot`), todas 401, e só então caía no login.
 *
 * `/me` não aparecia na lista porque `useGetMe` não vai à rede: ele lê a sessão
 * guardada localmente. É justamente isso que torna este portão barato — a
 * decisão é local, sem requisição nenhuma, e o spinner dura um render.
 *
 * O redirecionamento de `usePdvOperator` continua valendo: ele cobre a sessão
 * que expira com o PDV já aberto, que este portão não vê.
 */
function PdvAutenticado() {
  const { data: user, isLoading } = useGetMe({
    query: { retry: false, staleTime: STALE_TIME.catalogo },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Carregando o caixa...</span>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return <Pdv />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={PdvAutenticado} />
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
      <DevEnvironmentBanner />
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
