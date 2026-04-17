import { VitePWA } from 'vite-plugin-pwa';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: '云上工时',
        short_name: '工时',
        theme_color: '#0f3d3e',
        background_color: '#f4efe7',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@nutui/nutui/dist/styles/variables.scss" as *;\n`,
        api: 'modern-compiler',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['example.com'],
    port: 10001,
    proxy: {
      '/api': {
        target: 'https://example.com',
         changeOrigin: true,
secure: false,
      }
    }
  },
});
