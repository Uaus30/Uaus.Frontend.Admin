import { defineConfig } from "vitest/config";
import { createCoverageOptions } from "../../vitest.shared.mts";

/**
 * Testes do cliente de API. Rodam em Node: o pacote é transporte HTTP, tipos e
 * chaves de cache — nada aqui precisa de DOM.
 *
 * A cobertura deste pacote vai nascer baixa e isso é informação, não defeito de
 * medida: `src/hooks/` é quase todo declaração de hook do React Query, que não
 * roda fora de um componente. O que precisa de teste de verdade é `client.ts`,
 * as chaves de cache e a paginação — e é justamente o que o relatório vai
 * mostrar descoberto se alguém encostar neles sem teste.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: createCoverageOptions("api-client"),
  },
});
