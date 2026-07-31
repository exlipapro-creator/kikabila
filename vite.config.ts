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
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://mtdnwlpzowmedkelridl.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_P4cKk4WnqcBYHmJ1piSkLw_kq4ZNiOA'),
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