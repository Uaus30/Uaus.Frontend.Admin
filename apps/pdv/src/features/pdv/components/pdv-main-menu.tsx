import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Calculator as CalculatorIcon,
  ExternalLink,
  FileBarChart,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu as MenuIcon,
  PackageMinus,
  PauseCircle,
  Settings,
} from "lucide-react";
import { Button } from "@workspace/ui";
import { useCalculatorStore } from "@/stores/use-calculator-store";
import { usePdvStore } from "@/stores/use-pdv-store";
import { adminHomeUrl, openInNewTab } from "@/lib/admin-links";

type PdvMainMenuProps = {
  /** A loja usa controle de caixa: fechamento e relatório do turno existem. */
  usesCashRegister: boolean;
  /** Sessão de caixa aberta, ou `null`. */
  sessionId: number | null;
  /** Uma impressão de relatório está em andamento. */
  printingReport: boolean;
  onCloseRegister: () => void;
  onStockWriteOff: () => void;
  onSalesHistory: () => void;
  onPerformance: () => void;
  onHeldSales: () => void;
  onPrintReport: () => void;
  onPreferences: () => void;
  onExit: () => void;
};

/** Classe compartilhada por todo item do menu. */
const ITEM_CLASS =
  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Menu sanduíche do PDV: tudo que não cabe no balcão, mas o operador precisa
 * alcançar sem sair da venda.
 *
 * O menu guarda o próprio estado de aberto/fechado — é estado de UI que só ele
 * usa, e mantê-lo na tela obrigava a página inteira a renderizar a cada abertura.
 *
 * Todo item fecha o menu antes de agir: os diálogos que eles abrem cobrem a
 * tela, e um menu aberto por baixo reaparece quando o diálogo fecha.
 */
export function PdvMainMenu({
  usesCashRegister,
  sessionId,
  printingReport,
  onCloseRegister,
  onStockWriteOff,
  onSalesHistory,
  onPerformance,
  onHeldSales,
  onPrintReport,
  onPreferences,
  onExit,
}: PdvMainMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const heldSalesCount = usePdvStore((state) => state.heldSales.length);
  const toggleCalculator = useCalculatorStore((state) => state.toggleOpen);

  /** Fecha o menu e dispara a ação escolhida. */
  const run = (action: () => void) => () => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
      >
        <MenuIcon className="w-5 h-5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Camada invisível: clique em qualquer lugar da tela fecha o menu. */}
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl z-40"
            >
              {/* Sem controle de caixa não há turno para encerrar; o item some em
                  vez de ficar desabilitado para sempre. */}
              {usesCashRegister && (
                <button onClick={run(onCloseRegister)} disabled={!sessionId} className={ITEM_CLASS}>
                  <Lock className="w-4 h-4 text-primary" />
                  Fechar Caixa
                </button>
              )}

              {/* A baixa de estoque entra aqui, e não no checkout: a tela de
                  finalização não pode ganhar mais nada, e baixa não tem relação
                  com pagamento. Também não exige caixa aberto — quem resolve a
                  sessão dela é o servidor. */}
              <button onClick={run(onStockWriteOff)} className={ITEM_CLASS}>
                <PackageMinus className="w-4 h-4 text-primary" />
                Baixa de Estoque
              </button>

              <button onClick={run(onSalesHistory)} className={ITEM_CLASS}>
                <History className="w-4 h-4 text-primary" />
                Histórico de Vendas
              </button>

              <button onClick={run(onPerformance)} className={ITEM_CLASS}>
                <BarChart3 className="w-4 h-4 text-primary" />
                Desempenho
              </button>

              <button onClick={run(onHeldSales)} className={`${ITEM_CLASS} justify-between`}>
                <span className="flex items-center gap-3">
                  <PauseCircle className="w-4 h-4 text-primary" />
                  Vendas em Espera
                </span>
                {heldSalesCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-white">
                    {heldSalesCount}
                  </span>
                )}
              </button>

              {/* O relatório é o consolidado de um turno; sem controle de caixa
                  não existe turno para consolidar. */}
              {usesCashRegister && (
                <button
                  onClick={run(onPrintReport)}
                  disabled={!sessionId || printingReport}
                  className={ITEM_CLASS}
                >
                  <FileBarChart className="w-4 h-4 text-primary" />
                  Relatório de Vendas
                </button>
              )}

              <button onClick={run(toggleCalculator)} className={ITEM_CLASS}>
                <CalculatorIcon className="w-4 h-4 text-primary" />
                Calculadora
              </button>

              <button onClick={run(onPreferences)} className={ITEM_CLASS}>
                <Settings className="w-4 h-4 text-primary" />
                Preferências
              </button>

              <button
                onClick={run(() => openInNewTab(adminHomeUrl()))}
                className={`${ITEM_CLASS} justify-between`}
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 text-primary" />
                  Painel Administrativo
                </span>
                {/* Nova aba, não navegação: o caixa pode estar com venda em
                    andamento, e sair da tela a perderia. */}
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              <div className="h-px bg-border my-1" />

              <button
                onClick={run(onExit)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-destructive/10 text-destructive transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
