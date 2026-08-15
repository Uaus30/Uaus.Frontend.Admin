import { defineConfig } from "vitest/config";
import { createCoverageOptions } from "../../vitest.shared.mts";

/**
 * Testes do núcleo de domínio. Rodam em Node: aqui só existe lógica pura —
 * dinheiro, datas, texto e mensagens de erro. Nada toca DOM nem rede.
 *
 * É o pacote onde a cobertura mais importa: não há tela nem rede para dificultar
 * o teste, e o CLAUDE.md manda cobrir dinheiro, cálculo e validação. Um buraco
 * aqui é um buraco em regra que os dois apps executam.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: createCoverageOptions("core"),
  },
});
