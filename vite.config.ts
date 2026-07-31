import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tanstackRouter from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter(),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});