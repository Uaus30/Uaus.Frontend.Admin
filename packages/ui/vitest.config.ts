import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Testes do kit de UI.
 *
 * O pacote passou meses com dois arquivos de teste que NUNCA rodavam: não havia
 * script `test` aqui e a cadeia da raiz não o incluía — enquanto o README do
 * pacote afirmava que eles cobriam a conversão de datas.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
