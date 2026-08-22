import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./lib/clientLogger";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    void reportClientError(event.reason, {
      origin: "[Front-Admin] UnhandledPromiseRejection",
    });
  });

  window.addEventListener("error", (event) => {
    void reportClientError(event.error || event.message, {
      origin: "[Front-Admin] GlobalError",
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

