import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, createReadStream, mkdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

const MEDIAPIPE_WASM = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
] as const;

const MEDIAPIPE_MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
};

/** Serve/copia o WASM do MediaPipe sem meter 20+ MB no `public/` (nem no git). */
const mediapipeWasm = (): Plugin => {
  const srcDir = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
  const copyTo = (destDir: string) => {
    mkdirSync(destDir, { recursive: true });
    for (const name of MEDIAPIPE_WASM) {
      copyFileSync(join(srcDir, name), join(destDir, name));
    }
  };
  return {
    name: "mediapipe-wasm",
    configureServer(server) {
      server.middlewares.use("/mediapipe/wasm", (req, res, next) => {
        const raw = (req.url ?? "/").split("?")[0] ?? "";
        const name = raw
          .replace(/^\/mediapipe\/wasm\//, "")
          .replace(/^\//, "");
        if (!(MEDIAPIPE_WASM as readonly string[]).includes(name)) {
          next();
          return;
        }
        const file = join(srcDir, name);
        try {
          statSync(file);
        } catch {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader(
          "Content-Type",
          MEDIAPIPE_MIME[extname(name)] ?? "application/octet-stream",
        );
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      const dir = options.dir ?? join(root, "dist");
      copyTo(join(dir, "mediapipe/wasm"));
    },
  };
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Inlinar o CSS no HTML e preload da Outfit 600 (LCP do onboarding). */
const inlineCssAndPreloadFont = (): Plugin => ({
  name: "inline-css-preload-font",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const bundle = ctx.bundle;
      if (!bundle) return html;
      let next = html;
      for (const item of Object.values(bundle)) {
        if (item.type !== "asset" || !item.fileName.endsWith(".css")) continue;
        const source =
          typeof item.source === "string"
            ? item.source
            : new TextDecoder().decode(item.source);
        next = next.replace(
          new RegExp(
            `<link[^>]*href="[^"]*${escapeRegExp(item.fileName)}"[^>]*>`,
          ),
          `<style>${source}</style>`,
        );
      }
      const font = Object.values(bundle).find(
        (item) =>
          item.type === "asset" &&
          item.fileName.includes("outfit-latin-600-normal") &&
          item.fileName.endsWith(".woff2"),
      );
      if (font && font.type === "asset") {
        next = next.replace(
          "</head>",
          `    <link rel="preload" href="/${font.fileName}" as="font" type="font/woff2" crossorigin>\n  </head>`,
        );
      }
      return next;
    },
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCssAndPreloadFont(), mediapipeWasm()],
  resolve: {
    alias: {
      "@i18n": resolve(root, "src/i18n"),
      "@libs": resolve(root, "src/lib"),
      "@components": resolve(root, "src/components"),
      "@screens": resolve(root, "src/screens"),
    },
  },
  server: {
    host: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
