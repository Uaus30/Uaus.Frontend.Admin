import { defineConfig } from "vitest/config";

/**
 * Testes do cliente de API. Rodam em Node: o pacote é transporte HTTP, tipos e
 * chaves de cache — nada aqui precisa de DOM.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
