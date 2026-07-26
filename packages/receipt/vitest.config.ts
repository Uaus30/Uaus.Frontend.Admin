import { defineConfig } from "vitest/config";

/**
 * Testes do pacote de cupom. Roda em jsdom porque a impressão monta um iframe,
 * mesmo que a maior parte dos testes seja de montagem de HTML puro.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
