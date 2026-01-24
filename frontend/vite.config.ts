import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const shaderExtensions = new Set([
  ".glsl",
  ".vert",
  ".frag",
  ".vs",
  ".fs",
]);

const glslPlugin = () => ({
  name: "glsl-loader",
  load(id: string) {
    const ext = path.extname(id);
    if (shaderExtensions.has(ext)) {
      return fs.readFileSync(id, "utf8");
    }
    return null;
  },
  transform(code: string, id: string) {
    const ext = path.extname(id);
    if (!shaderExtensions.has(ext)) {
      return null;
    }
    return {
      code: `export default ${JSON.stringify(code)};`,
      map: null,
    };
  },
});

export default defineConfig({
  plugins: [react(), glslPlugin()],
  resolve: {
    alias: {
      "vtk.js/Sources": path.resolve(__dirname, "node_modules/vtk.js/Sources"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text",
        ".vs": "text",
        ".fs": "text",
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
