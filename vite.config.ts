import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000
        },
        manifest: {
          name: 'Campus App',
          short_name: 'Campus',
          description: 'A comprehensive campus management application.',
          theme_color: '#10b981',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://ui-avatars.com/api/?name=CA&size=192&background=10b981&color=fff',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://ui-avatars.com/api/?name=CA&size=512&background=10b981&color=fff',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: true,
    },
  };
});
