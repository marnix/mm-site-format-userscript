import { defineConfig } from "tsup";
import pkg from "./package.json";

const header = `\
// ==UserScript==
// @name         MM Site Format
// @namespace    https://github.com/marnix/mm-site-format-userscript
// @version      ${pkg.version}
// @description  Formatting improvements for metamath.org proof pages
// @author       Marnix Klooster
// @match        *://us.metamath.org/*
// @match        *://metamath.org/*
// @grant        none
// ==/UserScript==`;

export default defineConfig({
  entry: { "mm-site-format": "src/index.ts" },
  outDir: "dist",
  format: ["iife"],
  outExtension: () => ({ js: ".user.js" }),
  banner: { js: header },
  minify: false,
  sourcemap: false,
  define: { __USERSCRIPT_VERSION__: JSON.stringify(pkg.version) },
  onSuccess: "prettier --write dist/mm-site-format.user.js",
  watchOptions: { usePolling: true, interval: 500 },
});
