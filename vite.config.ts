import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // Evita usuários ficarem presos em versões antigas (especialmente no app instalado/PWA)
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "logo.png", "robots.txt"],
      manifest: {
        name: "TG Griffes - Atacado Streetwear",
        short_name: "TG Griffes",
        description: "Loja Atacado TG Griffes - Streetwear Premium",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        cleanupOutdatedCaches: true,
        // Troca imediatamente para o novo service worker (reduz reclamações de cache antigo)
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cache SOMENTE assets públicos (imagens/pdfs) do storage.
            // Não cacheamos REST/RPC/auth para evitar catálogo/variantes/estoque desatualizados.
            urlPattern: /^https:\/\/dvqeitcliexenhnfradm\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "storage-public-assets",
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
