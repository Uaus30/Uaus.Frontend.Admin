import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./lib/clientLogger";
import {
  isChunkLoadError,
  reloadOnChunkLoadError,
  setupChunkLoadErrorHandler,
} from "./lib/chunk-reload";

if (typeof window !== "undefined") {
  setupChunkLoadErrorHandler();

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason) && reloadOnChunkLoadError(event.reason)) {
      event.preventDefault();
      return;
    }

    void reportClientError(event.reason, {
      origin: "[Front-Admin] UnhandledPromiseRejection",
    });
  });

  window.addEventListener("error", (event) => {
    const error = event.error || event.message;
    if (isChunkLoadError(error) && reloadOnChunkLoadError(error)) {
      event.preventDefault();
      return;
    }

    void reportClientError(error, {
      origin: "[Front-Admin] GlobalError",
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

