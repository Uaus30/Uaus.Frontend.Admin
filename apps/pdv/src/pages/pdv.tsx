import { Loader2 } from "lucide-react";
import { usePageTitle } from "@workspace/ui";
import { Calculator } from "@/components/calculator";
import { useCashRegister } from "@/hooks/use-cash-register";
import { useCheckout } from "@/hooks/use-checkout";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useOfflinePdv } from "@/hooks/use-offline-pdv";
import { usePdvScreen } from "@/hooks/use-pdv-screen";
import { useStockFreeze } from "@/hooks/use-stock-freeze";
import { StockFreezeBanner } from "@/features/pdv/components/stock-freeze-banner";
import { StaleLocalDataBanner } from "@/features/pdv/components/stale-local-data-banner";
import { useCalculatorStore } from "@/stores/use-calculator-store";
import { usePdvStore } from "@/stores/use-pdv-store";
import { PdvCartPanel } from "@/features/pdv/components/pdv-cart-panel";
import { PdvDialogs } from "@/features/pdv/components/pdv-dialogs";
import { PdvHeader } from "@/features/pdv/components/pdv-header";
import { PdvMainMenu } from "@/features/pdv/components/pdv-main-menu";
import { PdvPhoneCartBar } from "@/features/pdv/components/pdv-phone-cart-bar";
import { PdvSearchPanel } from "@/features/pdv/components/pdv-search-panel";
import { TrocaSenhaPrimeiroAcesso } from "@/features/pdv/components/troca-senha-primeiro-acesso";
import { usePdvCounter } from "@/features/pdv/hooks/use-pdv-counter";
import { usePdvDialogs } from "@/features/pdv/hooks/use-pdv-dialogs";
import { usePdvOperator } from "@/features/pdv/hooks/use-pdv-operator";
import { usePdvPaymentMethods } from "@/features/pdv/hooks/use-pdv-payment-methods";
import { usePdvSessionActions } from "@/features/pdv/hooks/use-pdv-session-actions";
import { useCameraScan } from "@/features/pdv/hooks/use-camera-scan";
import { usePhoneCartView } from "@/features/pdv/hooks/use-phone-cart-view";
import { useStaleLocalData } from "@/features/pdv/hooks/use-stale-local-data";
import { usePromotions } from "@/features/pdv/hooks/use-promotions";
import { useSaleCheckout } from "@/features/pdv/hooks/use-sale-checkout";
import { useSaleHistoryActions } from "@/features/pdv/hooks/use-sale-history-actions";
import { useSalesReport } from "@/features/pdv/hooks/use-sales-report";
import { countIdentifiedSales } from "@/features/pdv/lib/identified-sales";

/**
 * Tela do PDV: busca de produtos, carrinho, checkout com N formas de pagamento,
 * histórico da sessão e abertura/fechamento de caixa.
 *
 * A página só compõe — cada responsabilidade mora num hook de
 * `features/pdv/hooks/`, e cada pedaço de layout num componente de
 * `features/pdv/components/`. A ordem das chamadas abaixo é a ordem das
 * dependências: configurações da loja decidem o controle de caixa, o caixa
 * decide o modo offline, e o resto pendura nesses três.
 *
 * Toda venda é gravada na API e vinculada à sessão de caixa aberta — sem caixa
 * aberto a tela fica bloqueada pelo diálogo de abertura.
 */
export default function Pdv() {
  usePageTitle("Caixa · Uaus PDV");

  /**
   * O que as configurações da empresa mudam aqui.
   *
   * `mode` responde as perguntas que a tela faz sobre controle de caixa. Hoje
   * ele sempre exige sessão — o backend recusa venda sem `cashRegisterSessionId`
   * —, mas todos os pontos que assumiam sessão obrigatória já passam por ele.
   * Ver o bloqueio documentado em `lib/cash-register-mode.ts`.
   *
   * `settings` também carrega a identidade da loja que sai impressa nos cupons
   * — resolvida com fallback por `resolveStoreInfo` em cada ponto de impressão,
   * porque a cópia local pode ser de uma versão sem os campos.
   */
  const { settings: companySettings, mode, isLoading: loadingSettings } = useCompanySettings();

  const {
    session,
    sessionId,
    isSessionFromCache,
    summary,
    sessionSales,
    todaySales,
    loadingSession,
    loadingTodaySales,
    open: openCashRegister,
    close: closeCashRegister,
    refreshSales,
  } = useCashRegister({ enabled: mode.requiresOpenSession });

  const {
    online,
    queuedCount,
    queuedSalesCount,
    hasLocalDatabase,
    refreshingSnapshot,
    sync: syncPendingQueuesNow,
  } = useOfflinePdv(sessionId);

  /** Formas de pagamento em uso: API quando responde, base local quando não. */
  const { paymentMethods, paymentMethodNameById } = usePdvPaymentMethods(online, hasLocalDatabase);

  // As promoções que valem no balcão. Nada é lido de volta aqui: quem as consome
  // é o carrinho, dentro do store, a cada item bipado.
  usePromotions(online);

  /** Operador do caixa; sem sessão autenticada o hook redireciona para o login. */
  const { user, isLoading, operatorName, deveTrocarSenha } = usePdvOperator();

  // Seletores por campo, e não `useShallow((state) => state)`: assinar o store
  // inteiro fazia esta tela renderizar de novo a cada mudança de qualquer campo,
  // inclusive os que ela nem lê. Mesmo padrão de `hooks/use-offline-pdv.ts`.
  // Os totais saem calculados de dentro do store para que o gatilho do render
  // seja o valor, e não o carrinho.
  const subtotal = usePdvStore((state) => state.getSubtotal());
  const total = usePdvStore((state) => state.getTotal());

  /**
   * Balcão, celular deitado ou celular em pé (07/10/2026). Em pé a busca e o
   * carrinho viram vistas que se alternam, com a barra do pé entre elas.
   */
  const screen = usePdvScreen();
  const lineCount = usePdvStore((state) => state.items.length);
  const units = usePdvStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const lastAddedSeq = usePdvStore((state) => state.lastAddedSeq);
  const phoneView = usePhoneCartView(lineCount);
  const toggleCalculator = useCalculatorStore((state) => state.toggleOpen);

  // Com caixa, o turno de quem está no balcão; sem, o dia da loja.
  const periodSales = mode.requiresOpenSession ? sessionSales : todaySales;
  const identifiedSales = loadingTodaySales ? null : countIdentifiedSales(periodSales);

  // `total`, não `subtotal`: o checkout cobra o que a venda grava. Enquanto ele
  // recebia o subtotal, qualquer desconto global era exibido no carrinho, ia
  // para o payload — e NÃO era descontado do valor a receber no caixa.
  const checkout = useCheckout(total, paymentMethods);

  const dialogs = usePdvDialogs();

  /** O balcão: busca, entrada no carrinho, foco do leitor, pausar e retomar. */
  // No celular o cursor não volta sozinho para a busca: abriria o teclado por
  // cima da tela a cada venda (ver `autoFocus` em `usePdvCounter`).
  const counter = usePdvCounter({ online, sessionId, checkout, autoFocus: screen === "desk" });

  /** O código lido pela câmera do celular vira item no carrinho. */
  const scanCode = useCameraScan({ online, addProductToCart: counter.addProductToCart });

  // Conferência de estoque aberta: o balcão fica impedido de vender (23/09/2026).
  const { salesPaused } = useStockFreeze();

  // Sem internet com o caixa ou a base de outro dia: o aviso vermelho do topo.
  // Só avisa, não bloqueia (decisão do dono, 07/10/2026).
  const staleSince = useStaleLocalData({ online, session, isSessionFromCache });

  /**
   * Gravação da venda. O hook cuida da inicialização do checkout, das validações
   * de caixa/conexão, do payload, do cupom e da fila offline.
   */
  const { savingSale, confirmPayment } = useSaleCheckout({
    checkout,
    paymentMethods,
    paymentMethodNameById,
    total,
    sessionId,
    mode,
    online,
    hasLocalDatabase,
    operatorName,
    companySettings,
    onSaleRecorded: refreshSales,
    onSaleFinished: counter.search.clear,
    focusSearch: counter.focusSearch,
    salesPaused,
  });

  /** Cancelar, reimprimir e reabrir para edição uma venda já registrada. */
  const history = useSaleHistoryActions({
    paymentMethodNameById,
    companySettings,
    onSaleChanged: refreshSales,
    onSaleLoadedForEditing: () => dialogs.salesHistory.setOpen(false),
  });

  const report = useSalesReport({
    session,
    summary,
    sessionSales,
    todaySales,
    operatorName,
    companySettings,
    paymentMethodNameById,
  });

  /** Abertura, fechamento e saída do turno. */
  const {
    openRegister,
    requestCloseRegister,
    isCloseRegisterOpen,
    setIsCloseRegisterOpen,
    exit,
    leaveWithoutSession,
  } = usePdvSessionActions({
    sessionId,
    online,
    queuedCount,
    openCashRegister,
    syncPendingQueues: syncPendingQueuesNow,
  });

  /**
   * O balcão só aparece quando a tela **inteira** está decidida — inclusive a
   * configuração da loja.
   *
   * `loadingSettings` está aqui por causa de um bug de foco intermitente.
   * Enquanto `/CompanySettings` não responde, o padrão é "loja sem controle de
   * caixa" e a consulta de sessão nasce desligada — então `loadingSession` é
   * falso e a tela era liberada por `/me`, que responde primeiro. Quando a
   * resposta de verdade chegava dizendo que a loja usa caixa, a consulta ligava,
   * `loadingSession` ia de falso para VERDADEIRO e este `return` desmontava o PDV
   * inteiro. Ele voltava com um `<input>` novo, sem cursor: quem tinha acabado de
   * clicar no campo de busca precisava clicar de novo, e nada devolvia o foco —
   * o efeito que refoca depende de `sessionId` mudar, e ele mudava enquanto o
   * campo nem existia (a cópia local da sessão responde antes da API).
   *
   * Esperar pela configuração fecha a janela: quando ela chega, a consulta de
   * sessão já liga com o spinner ainda na tela, e o balcão é montado uma vez só.
   */
  if (loadingSettings || isLoading || loadingSession || (!hasLocalDatabase && refreshingSnapshot)) {
    const mensagem =
      !hasLocalDatabase && refreshingSnapshot
        ? "Atualizando a base de dados local..."
        : "Carregando o caixa...";

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">{mensagem}</span>
      </div>
    );
  }

  if (!user) return null;

  // Antes de qualquer venda: quem ainda usa a senha padrão do sistema não pode
  // ter movimento de caixa no seu nome — a senha é a mesma para todo cadastro
  // novo, então "quem vendeu" não significaria nada.
  if (deveTrocarSenha) return <TrocaSenhaPrimeiroAcesso operatorName={operatorName} />;

  const phone = screen !== "desk";
  const checkoutBlocked = (mode.saleRequiresSession && !sessionId) || salesPaused;

  const searchPanel = (
    <PdvSearchPanel
      search={counter.search}
      inputRef={counter.searchInputRef}
      online={online}
      onPickProduct={counter.addProductToCart}
      compact={phone}
      onScanCode={scanCode}
    />
  );

  const cartPanel = (
    <PdvCartPanel
      subtotal={subtotal}
      total={total}
      checkoutBlocked={checkoutBlocked}
      onApplyGlobalDiscount={dialogs.discount.show}
      onHoldSale={counter.holdSale}
      screen={screen}
      onBack={phoneView.openProducts}
    />
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden selection:bg-primary/30">
      <StockFreezeBanner salesPaused={salesPaused} />
      <StaleLocalDataBanner since={staleSince} compact={screen === "phone-landscape"} />
      <PdvHeader
        session={session}
        isSessionFromCache={isSessionFromCache}
        operatorName={operatorName}
        onOpenHeldSales={dialogs.heldSales.show}
        onSynced={refreshSales}
        screen={screen}
        menu={
          <PdvMainMenu
            usesCashRegister={mode.requiresOpenSession}
            sessionId={sessionId}
            stockFrozen={salesPaused}
            onCloseRegister={() => void requestCloseRegister()}
            onStockWriteOff={dialogs.stockWriteOff.show}
            onSalesHistory={dialogs.salesHistory.show}
            onPerformance={dialogs.performance.show}
            onHeldSales={dialogs.heldSales.show}
            onPreferences={dialogs.preferences.show}
            onExit={exit}
            phone={phone ? { operatorName, onCalculator: toggleCalculator } : undefined}
          />
        }
      />

      {/* Uma forma por vez, e nunca as duas montadas: o campo de busca é um só
          (`searchInputRef`), e é para ele que o cursor volta depois da venda. */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {screen === "phone-portrait" && phoneView.view === "cart" ? (
          cartPanel
        ) : (
          // A busca fica na MESMA posição da árvore em todas as formas — o
          // embrulho só troca de `contents` para coluna. Girar o celular não a
          // remonta, e a câmera aberta no meio de uma sequência não fecha.
          <div className={screen === "phone-portrait" ? "flex min-w-0 flex-1 flex-col" : "contents"}>
            {searchPanel}
            {screen === "phone-portrait" && (
              <PdvPhoneCartBar
                units={units}
                total={total}
                pulseKey={lastAddedSeq}
                onOpenCart={phoneView.openCart}
              />
            )}
          </div>
        )}
        {screen !== "phone-portrait" && cartPanel}
      </main>

      <PdvDialogs
        onLoyaltyClosed={counter.focusSearch}
        identifiedSales={identifiedSales}
        identifiedPeriodLabel={mode.requiresOpenSession ? "Neste turno" : "Hoje"}
        dialogs={dialogs}
        checkout={checkout}
        savingSale={savingSale}
        onConfirmPayment={() => void confirmPayment()}
        history={history}
        register={{
          mode,
          session,
          sessionId,
          summary,
          loadingSession,
          todaySales,
          loadingTodaySales,
          refreshSales,
          queuedSalesCount,
          onOpenRegister: openRegister,
          onCloseRegister: closeCashRegister,
          onLeaveWithoutSession: leaveWithoutSession,
          isCloseOpen: isCloseRegisterOpen,
          setCloseOpen: setIsCloseRegisterOpen,
          currentUserId: user?.id ?? null,
        }}
        report={report}
        onHeldSaleResumed={counter.handleHeldSaleResumed}
        onHeldToMakeRoom={counter.resetCheckoutFields}
        compact={phone}
      />

      <Calculator />
    </div>
  );
}
