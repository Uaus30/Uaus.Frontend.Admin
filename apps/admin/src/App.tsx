import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useRef } from "react";
import { checkHealth } from "@workspace/api-client-react";
import { WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Departments from "@/pages/departments";
import Categories from "@/pages/categories";
import Tags from "@/pages/tags";
import Sales from "@/pages/sales";
import Customers from "@/pages/customers";
import Users from "@/pages/users";
import Logs from "@/pages/logs";
import LogDetails from "@/pages/log-details";
import Images from "@/pages/images";
import Suppliers from "@/pages/suppliers";
import Grades from "@/pages/grades";
import StockEntries from "@/pages/stock-entries";
import Inventory from "@/pages/inventory";
import StockWriteOffs from "@/pages/stock-write-offs";
import InventoryCount from "@/pages/inventory-count";
import PaymentMethodsPage from "@/pages/payment-methods";
import CompanySettings from "@/pages/settings";
import CashRegisterSessions from "@/pages/cash-register-sessions";
import FinancialReports from "@/pages/financial-reports";
import FinancialClosings from "@/pages/financial-closings";
import FixedCosts from "@/pages/fixed-costs";
import Partners from "@/pages/partners";

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
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/produtos" component={Products} />
      <Route path="/departamentos" component={Departments} />
      <Route path="/categorias" component={Categories} />
      <Route path="/etiquetas" component={Tags} />
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
  );
}

function App() {
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
        // Reconnected!
        queryClient.invalidateQueries();
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className={`flex flex-col h-screen w-full overflow-hidden bg-background ${isOffline ? "is-offline" : ""}`}>
          <style>{`
            .is-offline [data-slot="sidebar-container"] {
              top: 40px !important;
              height: calc(100vh - 40px) !important;
            }
          `}</style>
          {isOffline && (
            <div className="bg-red-600 text-white h-10 px-4 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 z-[9999] shrink-0 shadow-md">
              <WifiOff className="w-4 h-4 animate-bounce" />
              <span>
                {isReconnecting
                  ? "Servidor indisponível no momento. Reconectando..."
                  : `Servidor indisponível no momento. Tentando nova conexão em ${secondsRemaining}`}
              </span>
            </div>
          )}
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
