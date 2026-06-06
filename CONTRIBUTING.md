# Contributing

## Prerequisites

Node.js (LTS).

## Build

```bash
npm install
npm run build
```

The built userscript is written to `dist/mm-site-format.user.js`.

## Dev mode

```bash
npm run dev
```

This does two things concurrently:

- Watches `src/` for changes and rebuilds `dist/mm-site-format.user.js`
  automatically.
- Serves `dist/` over HTTP on `http://localhost:8787`.

### Tampermonkey dev wrapper

Instead of installing the built script directly, install a small _wrapper_
script in Tampermonkey that loads the build from the local server via
`@require`:

```js
// ==UserScript==
// @name         MM Site Format (dev)
// @match        *://us.metamath.org/*
// @match        *://metamath.org/*
// @require      http://localhost:8787/mm-site-format.user.js
// @grant        none
// ==/UserScript==
```

The wrapper itself contains no logic. On every page load Tampermonkey fetches
`mm-site-format.user.js` from the local server, so a browser reload is all that
is needed to pick up a rebuild.

**One-time Tampermonkey setting:** open Tampermonkey → Settings → Externals →
Require and set it to _Always_, otherwise Tampermonkey may serve a cached copy
of the file.

With `npm run dev` running in the background, the workflow is:

1. Edit a `.ts` file.
2. tsup rebuilds in ~100 ms.
3. Reload the browser page.

## Tests

```bash
npm test
```

## CI

```bash
npm run ci
```

Runs a clean build, checks that all files are Prettier-formatted, and runs the
full test suite. Must pass before pushing.

To auto-format before running CI:

```bash
npm run format && npm run ci
```
