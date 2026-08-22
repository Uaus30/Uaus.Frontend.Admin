import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { getBuildInfo } from "../../scripts/build-version.ts";

const buildInfo = getBuildInfo();


// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(buildInfo.version),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildInfo.buildTime),
    "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(buildInfo.commitHash),
  },
  plugins: [
    react(),
    tailwindcss(),
    /**
     * Service worker do PDV.
     *
     * É o que permite o caixa **abrir** sem internet. Sem ele, a base local no
     * IndexedDB seria inútil depois de uma queda de energia: o navegador
     * reiniciaria, tentaria baixar o app do servidor e mostraria tela de erro.
     * Com o precache do bundle, o PDV carrega da própria máquina e vai direto
     * para a base local.
     *
     * Documentação do fluxo: `apps/pdv/docs/offline.md`.
     */
    VitePWA({
      // O caixa não é atualizado à mão: a nova versão entra sozinha na próxima
      // abertura, sem depender de o operador aceitar um aviso.
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.svg", "images/logo-icon.png"],
      manifest: {
        name: "Uaus! PDV",
        short_name: "PDV",
        description: "Ponto de venda da Uaus!, com operação offline.",
        lang: "pt-BR",
        // Tela cheia sem barra de navegador: o caixa é um terminal, não um site.
        display: "standalone",
        orientation: "landscape",
        background_color: "#0b0b0f",
        theme_color: "#0b0b0f",
        start_url: ".",
        /**
         * O `sizes` precisa bater com o pixel real do arquivo.
         *
         * Declarar 512x512 apontando para o `logo-icon.png` (que tem 126x132)
         * fazia o Chrome DESCARTAR o icone e avisar no console. Sem icone valido
         * de 192px ou mais, o PDV nao passa no criterio de instalacao: o
         * `display: "standalone"` logo acima vira letra morta, porque nao ha
         * como instalar o caixa como aplicativo.
         *
         * O `maskable` e um arquivo separado de proposito. O sistema recorta o
         * icone numa forma propria (circulo, squircle), entao ele precisa de
         * fundo ate a borda e do logo dentro da zona segura — os 80% centrais.
         * Reaproveitar o icone `any` faria a alca da sacola ser cortada.
         */
        icons: [
          { src: "images/logo-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "images/logo-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "images/logo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Tudo que o app precisa para subir fica em cache na instalação.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        // Navegação sempre cai no index cacheado: o PDV é uma SPA, e sem isso um
        // recarregamento offline daria 404.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],

        // A API **nunca** entra em cache. Servir venda, estoque ou sessão de caixa
        // de um cache seria pior do que não responder: o operador tomaria decisão
        // sobre dado velho sem saber. Quem responde offline é a base local do
        // IndexedDB, que carrega a própria data de atualização.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        // Desligado em desenvolvimento: o service worker serviria bundle antigo e
        // atrapalharia o HMR. Para testar o modo offline, use `npm run build` e
        // `npm run preview`.
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        /**
         * Separa as bibliotecas do código do app.
         *
         * O motivo aqui não é o tamanho do primeiro carregamento — o PDV abre uma
         * vez por turno. É o SERVICE WORKER: com um arquivo só, qualquer correção
         * de uma linha muda o hash do bundle inteiro e o precache rebaixa os
         * ~650 KB completos, em cada caixa da rede, a cada deploy. Numa loja com
         * internet ruim isso é o caixa esperando para abrir.
         *
         * Com as bibliotecas em chunks próprios, o deploy típico — que mexe só no
         * código da loja — invalida apenas o chunk do app. React e React Query
         * ficam no cache do turno anterior.
         *
         * O agrupamento é por FREQUÊNCIA DE MUDANÇA, não por tamanho: react e
         * react-dom mudam junto (major do framework), o Radix muda junto (kit de
         * UI), e o código do app muda todo dia.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Os packages do monorepo entram por symlink dentro de node_modules.
          // Eles são código NOSSO e mudam junto com o app — deixá-los no vendor
          // faria uma correção no packages/core invalidar o chunk das
          // bibliotecas, que é justamente o que este agrupamento evita.
          if (id.includes("@workspace")) return undefined;

          if (id.includes("react-dom") || /node_modules\/react\//.test(id)) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("react-datepicker") || id.includes("date-fns")) return "vendor-datas";

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },

  server: {
    port: 5174,
    proxy: {
      "/api": {
        // Sobrescreva com VITE_API_PROXY_TARGET quando a API rodar em outra porta.
        target: process.env.VITE_API_PROXY_TARGET || "https://localhost:44398",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
