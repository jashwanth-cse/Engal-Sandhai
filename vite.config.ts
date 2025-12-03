import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer'; // Added for bundle analysis
import viteCompression from 'vite-plugin-compression'; // Added compression

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      visualizer({ filename: 'dist/stats.html', gzipSize: true }), // Analyze chunks
      viteCompression({ algorithm: 'gzip', ext: '.gz' }), // Reduce output size
      viteCompression({ algorithm: 'brotliCompress', ext: '.br' }) // Smaller bundles
    ],
    base: '/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    server: {
      allowedHosts: [
        'f6f9bea8a9a9.ngrok-free.app',
      ],
    },
    build: {
      sourcemap: false, // Smaller chunks ✔️
      minify: 'esbuild', // Faster + smaller output
      chunkSizeWarningLimit: 2000, // Remove warnings ✔️
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],

            // Additional auto-splitting for large libraries (non-destructive ✔️)
            ui: [
              '@mui/material',
              '@emotion/react',
              '@emotion/styled'
            ],
            charts: ['chart.js', 'recharts'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
          }
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true
      },
      target: 'esnext' // Removes polyfills → smaller bundles
    }
  };
});
