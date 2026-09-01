import type { ReactNode } from "react";
import { Calculator as CalculatorIcon, PauseCircle, User } from "lucide-react";
import type { CashRegisterSessionDto } from "@workspace/api-client-react";
import { Button } from "@workspace/ui";
import { Clock } from "@/components/clock";
import { FontSizeControl } from "@/components/font-size-control";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { OfflineStatus } from "@/components/offline-status";
import { useCalculatorStore } from "@/stores/use-calculator-store";
import { usePdvStore } from "@/stores/use-pdv-store";

type PdvHeaderProps = {
  /** Sessão de caixa aberta, ou `null`. */
  session: CashRegisterSessionDto | null;
  /** A sessão em uso veio da base local; o resumo pode estar defasado. */
  isSessionFromCache: boolean;
  operatorName: string;
  /** Abre a lista de vendas em espera. */
  onOpenHeldSales: () => void;
  /** Recarrega o histórico depois que a fila subiu. */
  onSynced: () => Promise<void> | void;
  /** Menu sanduíche, montado pela tela porque as ações são dela. */
  menu: ReactNode;
};

/**
 * Cabeçalho do PDV: identidade do turno à esquerda, estado da operação no
 * centro, operador e menu à direita.
 *
 * O centro é o lugar de tudo que **interrompe** a venda — vendas em espera,
 * fila offline, hora. É onde o olho do operador cai quando ele levanta a cabeça
 * do balcão.
 */
export function PdvHeader({
  session,
  isSessionFromCache,
  operatorName,
  onOpenHeldSales,
  onSynced,
  menu,
}: PdvHeaderProps) {
  const heldSalesCount = usePdvStore((state) => state.heldSales.length);
  const toggleCalculator = useCalculatorStore((state) => state.toggleOpen);

  return (
    <header className="relative h-20 border-b border-border/50 bg-card/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-4">
        <img
          loading="lazy"
          decoding="async"
          src="/images/logo-icon.png"
          alt="Logo"
          className="w-12 h-12 object-contain"
        />
        <div>
          <h1 className="font-display font-bold leading-none text-xl tracking-tight">Uaus! Máximo 30</h1>
          {session && (
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              Caixa #{session.id} aberto às{" "}
              {new Date(session.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {/* A sessão veio da base local: o resumo do caixa é o do último
                  contato com o servidor e pode estar defasado. */}
              {isSessionFromCache && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">· sessão da base local</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
        {heldSalesCount > 0 && (
          <button
            type="button"
            onClick={onOpenHeldSales}
            title="Ver vendas em espera"
            className="relative flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <PauseCircle className="w-4 h-4" />
            Vendas em espera
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[10px] font-bold text-white">
              {heldSalesCount}
            </span>
          </button>
        )}

        <OfflineStatus sessionId={session?.id ?? null} onSynced={onSynced} />

        <Clock />
      </div>

      <div className="flex items-center gap-4">
        <FontSizeControl />

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCalculator}
          title="Calculadora"
          className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
        >
          <CalculatorIcon className="w-5 h-5" />
        </Button>

        <FullscreenToggle />

        <div className="flex items-center gap-2 text-primary">
          <span className="text-sm font-bold tracking-tight">{operatorName}</span>
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.1)]">
            <User className="w-5 h-5" />
          </div>
        </div>

        {menu}
      </div>
    </header>
  );
}
