# MM Site Format

A browser userscript that improves the formatting and readability of
[metamath.org](https://metamath.org) proof pages.

## Installation

Build the script (see below), then install `dist/script.user.js` via a
userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).

## Development

### Prerequisites

Node.js (LTS).

### Build

```bash
npm install
npm run build
```

The built userscript is written to `dist/script.user.js`.

### Dev mode

```bash
npm run dev
```

Rebuilds on every source change and serves `dist/` on `http://localhost:8787`.
Configure your userscript manager to
`@require http://localhost:8787/script.user.js` for instant reload on page
refresh.

### Tests

```bash
npm test
```

### CI

```bash
npm run ci
```

Formats all source files with Prettier and runs the full test suite. Must pass
before pushing.

---

_Much of the code in this repository was generated with the assistance of an
LLM._
