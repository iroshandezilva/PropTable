// Builds code.js (plugin) and ui.html (window with inlined script and styles).
// Usage: node build.mjs [--watch]

import * as esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

const watch = process.argv.includes("--watch");

const pluginOptions = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "code.js",
  target: "es2017",
  format: "iife",
  logLevel: "info",
};

// Inlines the bundled UI script and ui/ui.css into ui/index.html → ui.html.
const inlineHtml = {
  name: "inline-html",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      const [template, css] = await Promise.all([readFile("ui/index.html", "utf8"), readFile("ui/ui.css", "utf8")]);
      const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
      // Function replacers so "$" sequences in the bundle are not treated as patterns.
      const html = template.replace("/*__CSS__*/", () => css).replace("/*__JS__*/", () => js);
      await writeFile("ui.html", html);
      console.log("ui.html built");
    });
  },
};

const uiOptions = {
  entryPoints: ["ui/ui.ts"],
  bundle: true,
  write: false,
  outfile: "ui.js",
  target: "es2019",
  format: "iife",
  minify: !watch,
  logLevel: "info",
  plugins: [inlineHtml],
};

if (watch) {
  const contexts = await Promise.all([esbuild.context(pluginOptions), esbuild.context(uiOptions)]);
  await Promise.all(contexts.map((c) => c.watch()));
} else {
  await Promise.all([esbuild.build(pluginOptions), esbuild.build(uiOptions)]);
}
