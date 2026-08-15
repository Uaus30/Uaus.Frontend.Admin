import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createCoverageOptions } from "../../vitest.shared.mts";

/**
 * Testes do kit de UI.
 *
 * O pacote passou meses com dois arquivos de teste que NUNCA rodavam: não havia
 * script `test` aqui e a cadeia da raiz não o incluía — enquanto o README do
 * pacote afirmava que eles cobriam a conversão de datas.
 *
 * A cobertura entra aqui exatamente por causa disso: dois testes contra 40
 * componentes davam a sensação de pacote testado, e nada no repositório
 * contradizia essa sensação. O relatório é o que torna o buraco visível sem
 * depender de alguém abrir a pasta e contar arquivo.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: createCoverageOptions("ui"),
  },
});
