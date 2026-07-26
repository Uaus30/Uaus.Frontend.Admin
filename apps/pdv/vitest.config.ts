import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const workspaceRoot = path.resolve(__dirname, "../..");

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
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(workspaceRoot, "node_modules/react"),
      "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
