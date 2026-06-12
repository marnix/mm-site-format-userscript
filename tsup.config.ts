import { defineConfig } from "tsup";
import pkg from "./package.json";

// Release builds take their version from the git tag (the release workflow sets
// MMSF_VERSION, e.g. "0.1.0"); local/dev builds are marked "-dev" so they are
// never mistaken for a release.
const version = process.env.MMSF_VERSION ?? `${pkg.version}-dev`;

// Dev builds stamp the build date-time (in the build machine's local timezone),
// so you can tell which build is loaded in the browser. Release builds leave it
// empty.
const buildTime = process.env.MMSF_VERSION ? "" : buildTimestamp(new Date());

function buildTimestamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const offset = `GMT${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${offset}`
  );
}

const header = `\
// ==UserScript==
// @name         MM Site Format
// @namespace    https://github.com/marnix/mm-site-format-userscript
// @version      ${version}
// @description  Formatting improvements for metamath.org proof pages
// @author       Marnix Klooster
// @license      Unlicense (public domain; https://unlicense.org/)
// @match        *://us.metamath.org/*
// @match        *://metamath.org/*
// @downloadURL  https://github.com/marnix/mm-site-format-userscript/releases/latest/download/mm-site-format.user.js
// @updateURL    https://github.com/marnix/mm-site-format-userscript/releases/latest/download/mm-site-format.user.js
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
  define: {
    __USERSCRIPT_VERSION__: JSON.stringify(version),
    __USERSCRIPT_BUILD_TIME__: JSON.stringify(buildTime),
  },
  onSuccess: "prettier --write dist/mm-site-format.user.js",
});
