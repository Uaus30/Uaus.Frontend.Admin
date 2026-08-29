import { createRoot } from "react-dom/client";
import { reloadOnChunkLoadError, setupChunkLoadErrorHandler } from "@workspace/ui";
import App from "./App";
import "./index.css";

/*
 * Auto-recuperação de chunk desatualizado pós-deploy, como no admin. Num site
 * público isso importa MAIS: o visitante não sabe recarregar uma aba "morta" —
 * ele fecha e não volta. Erros que não são de chunk vão só para o console; a
 * loja não loga no backend porque o endpoint /Logs exige autenticação.
 */
setupChunkLoadErrorHandler();

window.addEventListener("error", (event) => {
  if (reloadOnChunkLoadError(event.error ?? event.message)) return;
  console.error("[Front-Loja]", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  if (reloadOnChunkLoadError(event.reason)) return;
  console.error("[Front-Loja]", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
