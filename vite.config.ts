import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Fallback de segurança: se o build (ex.: Docker no VPS) rodar sem as build-args
// VITE_SUPABASE_*, o bundle quebrava com "supabaseKey is required" e o site ficava em branco.
// Estes valores são públicos (anon key), então podem ficar no código.
const FALLBACK_ENV: Record<string, string> = {
  VITE_SUPABASE_URL: "https://dvqeitcliexenhnfradm.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2cWVpdGNsaWV4ZW5obmZyYWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjY3ODksImV4cCI6MjA4MzIwMjc4OX0.UJrQF1SALl0qYRZqY7H-PGI_83DEJ6hFzY8OaJPpwl4",
  VITE_SUPABASE_PROJECT_ID: "dvqeitcliexenhnfradm",
};

const envFallbackDefines = Object.fromEntries(
  Object.entries(FALLBACK_ENV)
    .filter(([key]) => !process.env[key])
    .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: envFallbackDefines,
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
