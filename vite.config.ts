import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

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
      // Vite injeta o <script type="module"> do entry antes dos
      // modulepreload. O Chrome baixa o runtime pelo import e marca o
      // <link> como preload sem uso.
      const preloads = [
        ...next.matchAll(/<link rel="modulepreload"[^>]*>/g),
      ].map((match) => match[0]);
      if (preloads.length) {
        next = next.replace(/\s*<link rel="modulepreload"[^>]*>/g, "");
        next = next.replace(
          /<script type="module"/,
          `${preloads.join("\n  ")}\n  <script type="module"`,
        );
      }
      return next;
    },
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCssAndPreloadFont()],
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
