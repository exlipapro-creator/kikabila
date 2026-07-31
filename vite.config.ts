import { defineConfig } from "vite";
import { createTanStackStartPlugin } from "@tanstack/start-plugin";
import react from "@vitejs/plugin-react";
import tanstackRouter from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    createTanStackStartPlugin({
      handler: "./src/server.ts",
      globalMiddlewareEntry: "./src/middleware.ts",
    }),
    tanstackRouter(),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});