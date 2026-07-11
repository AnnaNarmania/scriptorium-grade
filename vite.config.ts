import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // src/server.ts wraps the default server entry so catastrophic SSR
    // errors render a styled error page instead of a raw 500.
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
  ],
});
