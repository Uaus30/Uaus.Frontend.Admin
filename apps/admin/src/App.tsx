import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@workspace/ui";
import { TooltipProvider } from "@workspace/ui";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { checkHealth } from "@workspace/api-client-react";
import { WifiOff, Loader2 } from "lucide-react";
import { useToast } from "@workspace/ui";

const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Products = lazy(() => import("@/pages/products"));
const Departments = lazy(() => import("@/pages/departments"));
const Categories = lazy(() => import("@/pages/categories"));
const Tags = lazy(() => import("@/pages/tags"));
const Sales = lazy(() => import("@/pages/sales"));
const Customers = lazy(() => import("@/pages/customers"));
const Users = lazy(() => import("@/pages/users"));
const Logs = lazy(() => import("@/pages/logs"));
const LogDetails = lazy(() => import("@/pages/log-details"));
const Images = lazy(() => import("@/pages/images"));
const Suppliers = lazy(() => import("@/pages/suppliers"));
const Grades = lazy(() => import("@/pages/grades"));
const StockEntries = lazy(() => import("@/pages/stock-entries"));
const Inventory = lazy(() => import("@/pages/inventory"));
const StockWriteOffs = lazy(() => import("@/pages/stock-write-offs"));
const InventoryCount = lazy(() => import("@/pages/inventory-count"));
const GondolaLabels = lazy(() => import("@/pages/gondola-labels"));
const PaymentMethodsPage = lazy(() => import("@/pages/payment-methods"));
const CompanySettings = lazy(() => import("@/pages/settings"));
const CashRegisterSessions = lazy(() => import("@/pages/cash-register-sessions"));
const FinancialReports = lazy(() => import("@/pages/financial-reports"));
const FinancialClosings = lazy(() => import("@/pages/financial-closings"));
const FixedCosts = lazy(() => import("@/pages/fixed-costs"));
const Partners = lazy(() => import("@/pages/partners"));

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

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/produtos" component={Products} />
      <Route path="/departamentos" component={Departments} />
      <Route path="/categorias" component={Categories} />
      <Route path="/etiquetas" component={Tags} />
      <Route path="/etiquetas-gondola" component={GondolaLabels} />
      <Route path="/vendas" component={Sales} />
      <Route path="/financeiro/formas-pagamento" component={PaymentMethodsPage} />
      <Route path="/formas-pagamento" component={PaymentMethodsPage} />
      <Route path="/financeiro/caixas" component={CashRegisterSessions} />
      <Route path="/financeiro/relatorios" component={FinancialReports} />
      <Route path="/financeiro/fechamentos" component={FinancialClosings} />
      <Route path="/financeiro/custos-fixos" component={FixedCosts} />
      <Route path="/financeiro/socios" component={Partners} />
      <Route path="/clientes" component={Customers} />
      <Route path="/fornecedores" component={Suppliers} />
      <Route path="/sistema/usuarios" component={Users} />
      <Route path="/sistema/logs" component={Logs} />
      <Route path="/sistema/logs/:id" component={LogDetails} />
      <Route path="/imagens" component={Images} />
      <Route path="/grades" component={Grades} />
      <Route path="/estoque/entradas" component={StockEntries} />
      <Route path="/estoque/inventario" component={Inventory} />
      <Route path="/estoque/baixas" component={StockWriteOffs} />
      <Route path="/estoque/contagem" component={InventoryCount} />
      <Route path="/configuracoes" component={CompanySettings} />
      <Route component={NotFound} />
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


