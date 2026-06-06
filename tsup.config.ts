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
  entry: { script: "src/index.ts" },
  outDir: "dist",
  format: ["iife"],
  outExtension: () => ({ js: ".user.js" }),
  banner: { js: header },
  minify: false,
  sourcemap: false,
  onSuccess: "prettier --write dist/script.user.js",
});
