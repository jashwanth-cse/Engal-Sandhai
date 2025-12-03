import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    base:'/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'), // alias for src folder
      }
    },
    server: {
      allowedHosts: [
        'f6f9bea8a9a9.ngrok-free.app', // your ngrok domain
      ],
    },
    build: {
      chunkSizeWarningLimit: 1000, // increase limit to suppress warnings
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate vendor libraries
            vendor: ['react', 'react-dom', 'react-router-dom'],
          }
        }
      }
    }
  };
});
