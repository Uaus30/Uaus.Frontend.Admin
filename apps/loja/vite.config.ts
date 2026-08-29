import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { getBuildInfo } from "../../scripts/build-version";
import { createCoverageOptions } from "../../vitest.shared.mts";

const buildInfo = getBuildInfo();

// Site público da loja (uaus.com.br). Segue o desenho do admin — mesma injeção
// de versão, mesmo proxy de /api — mas com o outDir padrão ("dist"), que é a
// convenção do PDV e o que o vercel.json deste app aponta.
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(buildInfo.version),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildInfo.buildTime),
    "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(buildInfo.commitHash),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        // Agrupado por frequência de mudança, como no admin: vendor estável
        // num chunk, app volátil em outro — deploy não invalida o cache do
        // visitante inteiro.
        manualChunks(id: string) {
          if (!id.includes("node_modules") || id.includes("@workspace")) return undefined;
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
            return "vendor-motion";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5175),
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // Mesma origem em dev, como em produção (a API não tem CORS). O padrão
      // aqui DIVERGE do admin (localhost) de propósito: a loja é leitura
      // pública — apontar para a api-dev deixa `npm run dev:loja` funcionar
      // sem backend local. Com backend local:
      // API_PROXY_TARGET=http://localhost:5214 (perfil "http" do Uaus.Api).
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "https://api-dev.uaus.com.br",
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p.replace(/^\/api/, ""),
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 4175),
  },
  test: {
    globals: true,
    environment: "jsdom",
    coverage: createCoverageOptions("loja", ["src/main.tsx"]),
  },
});
