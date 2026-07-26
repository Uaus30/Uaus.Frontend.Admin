import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'images/logo-icon.png'],
      manifest: {
        name: 'Uaus! PDV',
        short_name: 'PDV',
        description: 'Ponto de venda da Uaus!, com operação offline.',
        lang: 'pt-BR',
        // Tela cheia sem barra de navegador: o caixa é um terminal, não um site.
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0b0b0f',
        theme_color: '#0b0b0f',
        start_url: '.',
        icons: [
          { src: 'images/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'images/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tudo que o app precisa para subir fica em cache na instalação.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Navegação sempre cai no index cacheado: o PDV é uma SPA, e sem isso um
        // recarregamento offline daria 404.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        // A API **nunca** entra em cache. Servir venda, estoque ou sessão de caixa
        // de um cache seria pior do que não responder: o operador tomaria decisão
        // sobre dado velho sem saber. Quem responde offline é a base local do
        // IndexedDB, que carrega a própria data de atualização.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom']
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
})
