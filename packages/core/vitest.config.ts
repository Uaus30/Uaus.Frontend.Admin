import { defineConfig } from "vitest/config";

/**
 * Testes do núcleo de domínio. Rodam em Node: aqui só existe lógica pura —
 * dinheiro, datas, texto e mensagens de erro. Nada toca DOM nem rede.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
