import { defineConfig } from "tsup";

const header = `\
// ==UserScript==
// @name         MM Site Format
// @namespace    https://github.com/marnix/mm-site-format-userscript
// @version      0.1.0
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
  onSuccess: "prettier --write dist/mm-site-format.user.js",
  // Polling is needed on WSL2 where inotify events are unreliable for /mnt/c/ paths.
  watchOptions: { usePolling: true, interval: 500 },
});
