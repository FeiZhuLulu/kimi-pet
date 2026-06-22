import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  server: {
    port: 17374,
    proxy: {
      "/spritesheet.webp": {
        target: "http://127.0.0.1:17373",
        changeOrigin: true,
        rewrite: () => "/petpack/spritesheet.webp",
      },
    },
  },
  resolve: {
    alias: {
      "@kimi-pet/pet-assets": path.resolve(__dirname, "../../packages/pet-assets/src/index.ts"),
      "@kimi-pet/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
    },
  },
});
