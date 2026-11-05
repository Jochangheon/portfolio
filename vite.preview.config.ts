import { defineConfig } from "vite";
export default defineConfig({build:{target:"es2022",outDir:"dist-preview",rollupOptions:{input:"preview.html"}}});
