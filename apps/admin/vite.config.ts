import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createCoverageOptions } from "../../vitest.shared.mts";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        /**
         * Separa as bibliotecas do código do app.
         *
         * As 27 rotas já são `lazy`, então cada tela vem sob demanda. O que
         * sobrava eager era o chunk `index` com 268 KB — React, React Query e
         * Radix misturados ao código que muda todo dia. Com isso, qualquer
         * deploy invalidava o pacote inteiro no navegador de quem já tinha o
         * app carregado.
         *
         * O agrupamento é por FREQUÊNCIA DE MUDANÇA, não por tamanho: o
         * framework muda em major, o kit de UI muda quando alguém atualiza o
         * shadcn, e o código da loja muda toda semana.
         *
         * `recharts` e `react-datepicker` ganham chunk próprio porque são
         * pesados e usados por poucas telas — deixá-los no vendor comum faria
         * quem só abre a tela de clientes baixar o motor de gráficos.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Packages do monorepo entram por symlink em node_modules, mas são
          // código nosso e mudam com o app.
          if (id.includes("@workspace")) return undefined;

          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("react-datepicker") || id.includes("react-day-picker")) return "vendor-datas";
          if (id.includes("date-fns")) return "vendor-datas";
          if (id.includes("react-dom") || /node_modules\/react\//.test(id)) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("jsbarcode") || id.includes("react-barcode")) return "vendor-barcode";

          return "vendor";
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        // O padrão é o IIS Express. A variável existe para apontar o dev server
        // para uma API subida por `dotnet run`, que escuta em outra porta.
        target: process.env.API_PROXY_TARGET ?? "https://localhost:44398",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 4173),
    host: "0.0.0.0",
    allowedHosts: true,
  },
  /**
   * O admin não tem `vitest.config.ts` próprio: o Vitest cai neste arquivo, e é
   * por isso que a configuração de teste mora junto da de build.
   *
   * `main.tsx` fica fora da cobertura porque é só o `createRoot` que pendura o
   * App no DOM — não há nada ali para asseverar, e mantê-lo na conta só
   * empurraria o número para baixo sem apontar teste nenhum que valesse a pena
   * escrever. `src/services/` continua DENTRO: está congelado, mas roda em
   * produção, e o relatório existe justamente para mostrar quanto código vivo
   * ninguém cobre.
   */
  test: {
    globals: true,
    environment: "jsdom",
    coverage: createCoverageOptions("admin", ["src/main.tsx"]),
  },
});
