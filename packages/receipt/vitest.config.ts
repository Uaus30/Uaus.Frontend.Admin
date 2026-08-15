import { defineConfig } from "vitest/config";
import { createCoverageOptions } from "../../vitest.shared.mts";

/**
 * Testes do pacote de cupom. Roda em jsdom porque a impressão monta um iframe,
 * mesmo que a maior parte dos testes seja de montagem de HTML puro.
 *
 * `print.ts` vai aparecer descoberto e não adianta fingir o contrário: ele fala
 * com a impressora do sistema operacional através do iframe, e o jsdom não
 * implementa `window.print`. O que o relatório precisa vigiar é a montagem do
 * documento — `render.ts`, `from-sale.ts` e `sales-report.ts` —, porque é ali
 * que mora o valor que o cliente leva impresso no papel.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    coverage: createCoverageOptions("receipt"),
  },
});
