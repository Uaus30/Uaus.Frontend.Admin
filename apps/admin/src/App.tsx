import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
      <Route path="/clientes" component={Customers} />
      <Route path="/fornecedores" component={Suppliers} />
      <Route path="/sistema/usuarios" component={Users} />
      <Route path="/sistema/logs" component={Logs} />
      <Route path="/sistema/logs/:id" component={LogDetails} />
      <Route path="/imagens" component={Images} />
      <Route path="/grades" component={Grades} />
      <Route path="/estoque/entradas" component={StockEntries} />
      <Route path="/estoque/inventario" component={Inventory} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
