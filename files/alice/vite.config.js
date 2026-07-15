import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    port: parseInt(process.env.PORT || "5173"),
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: "index.html",
        // banco de pruebas del generador de planos BAM (/test-planos.html)
        "test-planos": "test-planos.html",
      },
    },
  },
});
