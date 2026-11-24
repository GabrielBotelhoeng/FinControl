import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FinControl',
        short_name: 'FinControl',
        description: 'Saiba quanto ganha, quanto gasta e para onde vai o seu dinheiro.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        // O fundo do tema claro, que é o padrão (sub-projeto 16, L1 e L9).
        background_color: '#F5F6F0',
        theme_color: '#F5F6F0',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Atalhos no ícone do app instalado (segurar o ícone no Android, botão direito no computador).
        shortcuts: [
          { name: 'Novo lançamento', short_name: 'Lançar', url: '/lancamentos?novo=1', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Calendário de contas', short_name: 'Calendário', url: '/calendario', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Importar extrato', short_name: 'Importar', url: '/importar', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Só o shell do app vai para o cache; dados da API nunca (spec 3.2: sem dados offline).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // As fotos do site de apresentação não vão para o cache de quem instala o app (sub-projeto 17, S10).
        globIgnores: ['site/**', 'og-image.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Web Push (sub-projeto 5, Parte B, W7): o tratamento do aviso e do clique fica em public/push-sw.js.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
