import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: "es2022",
    outDir: "dist-preview",
    rollupOptions: {
      input: "preview.html",
      output: { inlineDynamicImports: true },
    },
  },
});
