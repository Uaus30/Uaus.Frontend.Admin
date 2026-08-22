import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";

/**
 * Registra o service worker que guarda o app em cache.
 *
 * É o que faz o PDV abrir sem internet — depois de uma queda de energia o
 * navegador reinicia e carrega o bundle da própria máquina, em vez de mostrar
 * tela de erro.
 *
 * `immediate: true` ativa a nova versão assim que ela é baixada, sem esperar o
 * fechamento de todas as abas.
 *
 * `onNeedReload: () => undefined` impede que o Workbox dê `window.location.reload()`
 * forçado no meio da sessão do operador quando um deploy acontece em segundo plano,
 * o que fecharia modais abertas e resetaria o balcão. A nova versão já fica em
 * cache e entra naturalmente na próxima inicialização do PDV.
 *
 * Falha no registro é tolerada de propósito — em HTTP simples ou navegador sem
 * suporte, o PDV continua funcionando online normalmente.
 */
registerSW({
  immediate: true,
  onNeedReload: () => undefined,
  onRegisterError: () => undefined,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
