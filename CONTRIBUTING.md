# Contributing

## Prerequisites

Node.js (LTS).

## Build

```bash
npm install
npm run build
```

The built userscript is written to `dist/mm-site-format.user.js`.

## Dev workflow

To rebuild automatically on every source change:

```bash
npx tsup --watch
```

### ViolentMonkey setup

Use [ViolentMonkey](https://violentmonkey.github.io/) with its
[external editor workflow](https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/):

1. Build the script once with `npm run build`.
2. Determine the `file://` URL for the built script. On Windows or WSL2:
   ```
   file:///C:/path/to/dist/mm-site-format.user.js
   ```
   On WSL2, run `wslpath -w dist/mm-site-format.user.js` to get the Windows
   path.
3. Open that `file://` URL in the browser. ViolentMonkey will offer to install
   the script — before confirming, enable **Track external edits**.
4. Keep the installation tab open. ViolentMonkey polls it and reinstalls
   automatically whenever the file changes.

The workflow is then:

1. Edit a `.ts` file.
2. tsup rebuilds `dist/mm-site-format.user.js` in ~100 ms.
3. ViolentMonkey detects the change and reinstalls within a few seconds.
4. Reload the browser page.

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
