import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ExternalLink,
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
import { formatUpdatedAt, versionNumber } from "@workspace/core";
import { usePdvStore } from "@/stores/use-pdv-store";
import { adminBaseUrl, adminHomeUrl, openInNewTab } from "@/lib/admin-links";

type PdvMainMenuProps = {
  /** A loja usa controle de caixa: fechamento e relatório do turno existem. */
  usesCashRegister: boolean;
  /** Sessão de caixa aberta, ou `null`. */
  sessionId: number | null;
  onCloseRegister: () => void;
  onStockWriteOff: () => void;
  onSalesHistory: () => void;
  onPerformance: () => void;
  onHeldSales: () => void;
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
 *
 * A calculadora saiu daqui em 01/09/2026: ela tem botão próprio no cabeçalho,
 * sempre à vista, e o item duplicado fazia o operador abrir o menu para alcançar
 * o que já estava a um toque de distância.
 *
 * A ordem dos itens é a de uso no balcão, pedida pelo dono em 02/09/2026:
 * Desempenho, Histórico de Vendas, Vendas em Espera, Baixa de Estoque,
 * Preferências e Painel Administrativo. "Fechar Caixa" continua no topo, só na
 * loja com controle de caixa, e "Sair" no fim, separado. O relatório do
 * turno/dia saiu do menu na mesma data: ele já tem botão no rodapé do
 * histórico de vendas, que é onde o operador está quando precisa dele, e o
 * item aqui era um segundo caminho para a mesma impressão.
 *
 * ## Por que o clique-fora é um listener, e não uma camada por cima
 *
 * Havia um `<div className="fixed inset-0">` para capturar o clique de fora. Ele
 * NÃO funcionava: o cabeçalho tem `backdrop-blur`, e filtro de fundo cria
 * containing block para descendente `position: fixed` — a camada cobria só a
 * faixa de 80px do cabeçalho, não a tela. Clicar na área da venda não fechava
 * nada, e a camada ainda engolia o clique nos outros botões do cabeçalho.
 *
 * O listener no documento não depende de empilhamento nem de containing block,
 * e o Escape vem junto porque é a mesma pergunta ("o operador quer sair daqui").
 */
export function PdvMainMenu({
  usesCashRegister,
  sessionId,
  onCloseRegister,
  onStockWriteOff,
  onSalesHistory,
  onPerformance,
  onHeldSales,
  onPreferences,
  onExit,
}: PdvMainMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const heldSalesCount = usePdvStore((state) => state.heldSales.length);

  // Injetadas no build pelo Vite; lidas a cada render porque são constantes do
  // bundle, não estado. A data vem em UTC e é exibida no fuso de Brasília.
  //
  // Só o NÚMERO da versão: o rótulo já está na linha, e `formatVersion` traria a
  // palavra "Versão" junto — foi como a linha saiu "VERSÃO  Versão 2.3.1".
  const version = versionNumber(import.meta.env.VITE_APP_VERSION);
  const updatedAtText = formatUpdatedAt(import.meta.env.VITE_BUILD_TIME);

  // Lido a cada render de propósito: é leitura de `window.location`, barata, e
  // guardá-la em estado só criaria um valor que pode ficar velho.
  const adminDisponivel = adminBaseUrl() !== null;

  // Fecha ao clicar fora ou apertar Escape. `pointerdown` em vez de `click`
  // porque o menu precisa sumir no instante do toque — no touchscreen do balcão,
  // esperar o `click` deixa o menu piscando por cima do que foi tocado.
  //
  // O clique DENTRO do container é ignorado: ele inclui o próprio botão, que já
  // alterna o estado. Sem essa guarda o botão fecharia (pointerdown) e reabriria
  // (click) — e o menu nunca fecharia por ele.
  useEffect(() => {
    if (!isOpen) return;

    const aoApontar = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", aoApontar);
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("pointerdown", aoApontar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [isOpen]);

  /** Fecha o menu e dispara a ação escolhida. */
  const run = (action: () => void) => () => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative" ref={containerRef}>
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

            <button onClick={run(onPerformance)} className={ITEM_CLASS}>
              <BarChart3 className="w-4 h-4 text-primary" />
              Desempenho
            </button>

            <button onClick={run(onSalesHistory)} className={ITEM_CLASS}>
              <History className="w-4 h-4 text-primary" />
              Histórico de Vendas
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

            {/* A baixa de estoque entra aqui, e não no checkout: a tela de
                  finalização não pode ganhar mais nada, e baixa não tem relação
                  com pagamento. Também não exige caixa aberto — quem resolve a
                  sessão dela é o servidor. */}
            <button onClick={run(onStockWriteOff)} className={ITEM_CLASS}>
              <PackageMinus className="w-4 h-4 text-primary" />
              Baixa de Estoque
            </button>

            <button onClick={run(onPreferences)} className={ITEM_CLASS}>
              <Settings className="w-4 h-4 text-primary" />
              Preferências
            </button>

            {/* O item some quando não há como saber onde o admin está: um
                  botão que abre outra aba do próprio PDV é pior que botão
                  nenhum — parece que o painel quebrou. Ver `lib/admin-links`. */}
            {adminDisponivel && (
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
            )}

            <div className="h-px bg-border my-1" />

            <button
              onClick={run(onExit)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-destructive/10 text-destructive transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>

            {/* Versão e data do deploy como rodapé do menu, no lugar do diálogo
                "Sobre" que existia só para mostrar estes dois campos. Abrir uma
                modal para ler dois valores era um clique a mais para a pergunta
                que o suporte faz por telefone ("qual versão está aí?"); aqui
                eles já estão na tela em que o operador foi procurar. */}
            {/* As duas linhas alinhadas à esquerda, como todo item do menu acima
                delas: em rótulo à esquerda e valor à direita a data não cabia numa
                linha só dentro dos 224px do menu, e "01/09/2026 às" em cima de
                "15:09:57" custava mais altura do que a informação vale. */}
            <div className="mt-1 space-y-0.5 border-t border-border px-3 pb-1 pt-2 text-[10px] text-muted-foreground">
              <p>
                Versão{" "}
                {/* O número é a única coisa clara aqui: é o que o suporte pede no
                    telefone, e destacá-lo dispensa ler o resto do rodapé. */}
                <span className="font-mono font-semibold text-foreground" data-testid="menu-version">
                  {version}
                </span>
              </p>
              <p className="whitespace-nowrap" data-testid="menu-updated-at">
                {updatedAtText || "Atualizado em —"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
