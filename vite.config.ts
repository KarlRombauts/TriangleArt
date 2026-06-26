import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Served from a subpath on GitHub Pages (https://<user>.github.io/TriangleArt/),
// so the production build and `vite preview` use that base; dev stays at root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/TriangleArt/" : "/",
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: { $lib: resolve(__dirname, "./src/lib") },
  },
}));
