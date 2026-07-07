import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  server: {
    fs: {
      // Allow the ?raw import of ../recipes/SCHEMA.md (repo root) in dev.
      allow: [".."],
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
