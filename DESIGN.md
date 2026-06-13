# Design

A map of the source, for a human diving in. **How each part works lives in the
code it describes** — every file opens with a header comment and its functions
are documented. This file says _what is where_ and names the algorithms, then
points you at the file to read.

## What it does

Improves the readability of [metamath.org](https://metamath.org) proof pages by
parsing the MM expressions on them and adding interactive features:

- **Hover highlighting** — pointing at a token highlights the smallest
  sub-expression (parse-tree node) containing it, and every other occurrence of
  that same sub-expression in a lighter shade.
- **Parse-tree-guided whitespace** — extra space around the larger operators, so
  structure is readable without hovering.
- **Calculational proof rendering** — the proof shown as a Dijkstra-style
  [EWD1300](https://www.cs.utexas.edu/~EWD/transcriptions/EWD13xx/EWD1300.html)
  `⇐` calculation above the proof table, with a Calculation/Table view switch.

## The metamath page (the input)

Two renderings, handled by the same pipeline: **Unicode** (`mpeuni`, expressions
in `<span class=math>`) and **GIF** (`mpegif`, expressions as runs of
`<img alt>`, some tokens bare text). A page links two kinds of pages: a **syntax
definition** (heading "Syntax Definition …") yields one grammar rule; a
**theorem/axiom** (cited in the proof table's Ref column) brings in its own
syntax hints. The reading code is the place to learn the exact markup:
`expression.ts` (find/extract expressions per mode), `loader.ts` (syntax-hint
and Ref-column URLs), `table.ts` (the proof table), `kind.ts` (the "Colors of
variables" legend). `expression.ts`'s header states the semantic-selector
principle every DOM query here follows.

## Source map

The parsing kernel and grammar:

- **`proof.ts`** — the kernel: `Expression`, `InferenceRule`, `Substitution`,
  `Proof` (a parse tree _is_ a proof), and `evaluate` (a test-only verifier that
  tree-shakes out of the bundle).
- **`parse.ts`** — recursive-descent proof search directed by target type,
  memoised (packrat) with a left-recursion guard.
- **`token.ts`** — splits each rendering into located tokens; the Unicode side
  munches run-together constants against the grammar vocabulary and folds
  subscripts.
- **`kind.ts`** — a variable's kind (wff/setvar/class): from the span class
  (Unicode) or sampled image colour (GIF), via the legend.
- **`rule.ts`** — one grammar rule from a syntax-definition page.
- **`grammar.ts`** — assembles the grammar: the built-in `$TOP` rule + a rule
  per syntax-hint page + Ref-page hints + `cv`. Holds `GRAMMAR_CACHE_VERSION`.
- **`expression.ts`** / **`loader.ts`** — find expressions / linked-page URLs.
- **`cache.ts`** — caches the _result_ of processing a linked page (rules, hint
  URLs) per URL: in-memory + an optional `sessionStorage` layer.
- **`page.ts`** — orchestrates: assemble grammar, parse every expression.

Interaction and rendering:

- **`spans.ts`** — parse-tree node spans (what to highlight) and `gapUnits` (the
  whitespace measure).
- **`space.ts`** — inserts the whitespace spacers.
- **`highlight.ts`** — hover + other-occurrence highlighting via the CSS Custom
  Highlight API; `tokenAtPoint` resolves the token under the pointer.
- **`table.ts`** → **`calculation.ts`** → **`render.ts`** — read the proof tree
  from the table, model it as a calculation, render it as the two-column `⇐`
  layout.
- **`spine.ts`** — picks each step's "spine" (main line) by parse-tree overlap.
- **`view.ts`** — the Calculation/Table switch and link syncing.
- **`index.ts`** — the entry point wiring it all together (two parse passes,
  calc-box sizing, the early grid hide).
- **`config.ts`** — tunable constants (highlight colours).

## Key algorithms (where to read)

- **Parsing as proof search** — `parse.ts` + `proof.ts`. A parse tree is a
  proof; parsing an assertion is proving it at the synthetic `$TOP` type. The
  search is memoised so dense/nested expressions don't blow up.
- **Tokenizing the dense Unicode rendering** — `token.ts`: longest-match against
  the constant vocabulary, plus subscript folding (UTF-16-aware for surrogate
  pairs).
- **Choosing the spine** — `spine.ts`: top-down structural overlap of parse
  trees; ties broken toward the smaller non-trivial sub-proof; a symmetric step
  has no spine and ends at `⇔ TRUE`.
- **Hover + occurrence highlighting** — `highlight.ts`: smallest containing node
  span, plus `matchingOccurrences` (same token sequence ⇒ same parse tree).
- **Parse-tree whitespace** — `spans.ts` (`gapUnits`) + `space.ts`.
- **Calculational rendering** — `table.ts`/`calculation.ts`/`render.ts`, sized
  and toggled in `index.ts`/`view.ts`.

## Deferred directions

Larger ideas not yet built — notably **sub-expression calculations** (relating
sub-expressions by their syntax operator within a context, instead of whole
`|- …` statements along the spine) — are recorded in `TODO.md`.
