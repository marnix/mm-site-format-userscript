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
2. Determine the `file://` URL for the built script. On WSL2:
   ```
   file:////wsl.localhost/Ubuntu/home/<user>/projects/mm-site-format-userscript/dist/mm-site-format.user.js
   ```
   Run `wslpath -w dist/mm-site-format.user.js` to get the exact path.
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

## Bugfix commit discipline

Every bugfix must be delivered as **two separate commits** (intermediate
refactoring commits are allowed between them):

1. **Test commit**: add or modify a unit test that demonstrates the bug. The
   test must be marked as _expected to fail_ (e.g. with `it.fails(...)` or by
   asserting the currently-wrong behaviour with a `// BUG:` comment), so that
   `npm run ci` still passes. This commit proves the bug is reproducible.

2. **Fix commit**: fix the bug without changing any existing tests (only remove
   the `it.fails` / `// BUG:` marker from the test added in step 1). The
   previously-failing test now passes, confirming the fix.

This ensures every bug has a regression test and the fix is clearly traceable.

## Source conventions

All `.ts` source files and the generated `dist/mm-site-format.user.js` must be
**pure 7-bit ASCII** (printable bytes 32–126 plus tab/LF). Write any Unicode
character as a `\uXXXX` (or `\u{XXXXX}`) escape in string and regex literals,
and as an ASCII description in comments. The CI step enforces this with
`scripts/check-ascii.mjs`.

### Unicode escapes in code

Every `\uXXXX` / `\u{XXXXX}` escape in source code must have a nearby comment
giving the GIF/original token name (for Metamath symbols) or a plain-English
description (for UI characters). **Never** put a Unicode description in a
comment using the actual Unicode glyph — always use the GIF name or ASCII
rendering.

The canonical token-to-Unicode mapping lives in the `$( $t ... $)` section of
[set.mm](https://github.com/metamath/set.mm) (file `develop/set.mm`), in the
`althtmldef` entries. Common examples:

| Escape      | GIF token | Meaning                   |
| ----------- | --------- | ------------------------- |
| `\u22a2`    | `\|-`     | turnstile (assertion)     |
| `\u2192`    | `->`      | implies                   |
| `\u2194`    | `<->`     | biconditional             |
| `\u2227`    | `/\`      | and (conjunction)         |
| `\u2208`    | `e.`      | element of                |
| `\u2203`    | `E.`      | there exists              |
| `\u2229`    | `i^i`     | intersection              |
| `\u27e8`    | `<.`      | left angle bracket        |
| `\u27e9`    | `.>`      | right angle bracket       |
| `\u21be`    | `\|`s`    | restriction               |
| `\u2191`    | `^`       | up-arrow (exponentiation) |
| `\u03c0`    | `pi`      | pi                        |
| `\u00b7`    | `.cc`     | scalar multiplication     |
| `\u{1d711}` | `ph`      | phi (wff variable)        |
| `\u{1d713}` | `ps`      | psi (wff variable)        |
| `\u{1d712}` | `ch`      | chi (wff variable)        |
| `\u{1d703}` | `th`      | theta (wff variable)      |
| `\u{1d434}` | `A`       | class variable (italic)   |
| `\u{1d435}` | `B`       | class variable (italic)   |

For UI characters not from Metamath (arrows, markers, etc.), use a plain
description:

| Escape   | Description                                |
| -------- | ------------------------------------------ |
| `\u21d0` | left double arrow (<=)                     |
| `\u21d4` | biconditional (<=>)                        |
| `\u25b6` | right-pointing triangle (collapsed marker) |
| `\u25bc` | down-pointing triangle (expanded marker)   |
| `\u26a0` | warning sign                               |
| `\u22ef` | midline ellipsis                           |
| `\u2026` | horizontal ellipsis                        |
| `\u00a0` | non-breaking space                         |

## Grammar cache version

The userscript caches grammar rules in `localStorage` (keyed by
`GRAMMAR_CACHE_VERSION` in `src/grammar.ts`). **Bump the version** whenever a
change alters what `uniAssertionRule` or `gifAssertionRule` would extract from a
syntax-definition page — otherwise users with stale cached rules will hit parse
failures that a fresh install would not. Examples that require a bump:

- Changes to tokenization in `locateMathSpan` or `locateGifRun` (affects how
  rule conclusions/assumptions are read from fetched pages).
- Changes to `findGifRuns` or `extractGifText` that alter which runs qualify or
  how their text is joined.
- Structural changes to `gifAssertionRule` / `uniAssertionRule` themselves.

Changes that do NOT require a bump: parser logic (`parse.ts`), rendering, hover
behaviour, or anything that only affects how already-extracted rules are used.
