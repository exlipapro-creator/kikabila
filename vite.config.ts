import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    react(),
    viteTsconfigPaths(),
    TanStackRouter(),
  ],
  tanstackStart: {
    server: { entry: "server" },
  },
});
