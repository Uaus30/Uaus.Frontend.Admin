import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createCoverageOptions } from "../../vitest.shared.mts";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Configuração de testes do PDV. Fica separada do vite.config.ts porque os
 * testes não precisam do Tailwind nem do proxy do servidor de desenvolvimento.
 *
 * O React é apontado explicitamente para a cópia da raiz do workspace: o app
 * tem um node_modules próprio e duas cópias de React em memória quebram os
 * hooks dentro do @testing-library.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      react: path.resolve(workspaceRoot, "node_modules/react"),
      "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    /**
     * `main.tsx` e `sw-register.ts` ficam de fora: são o `createRoot` e o
     * registro do service worker, código que só existe para pendurar o app no
     * navegador. Não há o que asseverar neles, e mantê-los na conta empurraria o
     * número para baixo sem apontar um teste que valesse a pena escrever.
     */
    coverage: createCoverageOptions("pdv", ["src/main.tsx", "src/sw-register.ts"]),
  },
});
