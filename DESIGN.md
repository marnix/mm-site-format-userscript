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
- **`database-assumptions.ts`** — the set.mm-database assumptions we bake in
  (collected just below `config`): the `$TOP`/turnstile top rules and the
  always-loaded primitive syntax pages (`cv`, `wcel`, `wceq`, `weq`, `wel`) the
  site's hints omit (site-generation workarounds — see below).
- **`grammar.ts`** — assembles the grammar: the built-in `$TOP` rule + a rule
  per syntax-hint page + Ref-page hints + the primitives. Holds
  `GRAMMAR_CACHE_VERSION` and `missingSyntaxHints` (the incomplete-hints check).
  Also contains the breakdown-table fallback (a site-generation workaround — see
  below).
- **`expression.ts`** / **`loader.ts`** — find expressions / linked-page URLs.
- **`cache.ts`** — caches the _result_ of processing a linked page (rules, hint
  URLs) per URL: in-memory + an optional `sessionStorage` layer.
- **`page.ts`** — orchestrates: assemble grammar, parse every expression.

Interaction and rendering:

- **`spans.ts`** — parse-tree node spans (what to highlight) and `gapUnits` (the
  whitespace measure).
- **`space.ts`** — inserts the whitespace spacers.
- **`indent.ts`** — hang-indents the proof table's wrapped Expression-column
  lines so continuations align under the expression body, not the leader.
- **`highlight.ts`** — hover + other-occurrence highlighting via the CSS Custom
  Highlight API; `tokenAtPoint` resolves the token under the pointer.
- **`table.ts`** → **`calculation.ts`** → **`render.ts`** — read the proof tree
  from the table, model it as a calculation, render it as the two-column `⇐`
  layout.
- **`spine.ts`** — picks each step's "spine" (main line) by parse-tree overlap.
- **`view.ts`** — the Calculation/Table switch and link syncing.
- **`styles.ts`** — the one injected stylesheet of named classes for the
  page-common styling (the calculation layout, the banner, the view box).
- **`index.ts`** — the entry point wiring it all together (two parse passes,
  calc-box sizing, the early grid hide).
- **`config.ts`** — tunable constants (highlight colours).

## Site-generation limitations and workarounds

The metamath.org site's "Syntax hints" rows are incomplete in two known ways
(tracked in TODO — "Incomplete Syntax hints", reported as metamath-exe issue
[#187](https://github.com/metamath/metamath-exe/issues/187)).

**Always-loaded primitives** (`database-assumptions.ts`): `cv`, `wcel`, `wceq`,
`weq`, `wel` are unconditionally fetched on every page, even when absent from
the "Syntax hints" row. The site omits `cv` on _every_ page and omits `wcel` /
`wceq` when their operands are setvars (e.g. `x e. y`) rather than classes.
`weq` and `wel` are `$p` syntax theorems omitted because the site's hint
collector only scanned `$a` statements — fixed in the upstream fix branch
`syntax-hints-def-bodies`.

**Ref-page syntax hints** (`grammar.ts` — `assembleGrammar`): the syntax hints
of every theorem cited in the proof table's Ref column are loaded on top of the
page's own hints. This is a workaround for proof-derived hints: every
constructor used in a proof step is introduced by some cited assertion whose own
syntax hints list it, so the union covers the full proof.

**Breakdown-table fallback** (`grammar.ts` — `extractBreakdownRefUrls`): `$a |-`
definition pages (like `df-mul`) have no "Syntax hints" row at all. As a
fallback, their "Detailed syntax breakdown of definition" table is read instead
— it lists every constructor in the definition body's parse tree. This covers
constructors like `wo` (disjunction) that only appear inside a definition
referenced in the proof.

A residual gap remains for displayed expressions that are _not_ proof steps
(e.g. a definitional cross-reference like `( Disj R <-> ... )` on `disjrel`);
such expressions just fail to parse and are left alone. Closing that gap fully
would need transitive syntax loading (see TODO — "Correctness").

## Key algorithms (where to read)

- **Parsing as proof search** — `parse.ts` + `proof.ts`. A parse tree is a
  proof; parsing an assertion is proving it at the synthetic `$TOP` type. The
  search is memoised so dense/nested expressions don't blow up.
- **Tokenizing the dense Unicode rendering** — `token.ts`: longest-match against
  the constant vocabulary, plus subscript folding (UTF-16-aware for surrogate
  pairs).
- **Choosing the spine** — `spine.ts`: structural overlap of parse trees, then a
  chain of tiebreakers. `structuralOverlap` counts matching positions at the top
  level and one level of children (same rule or both leaves), without recursing
  into the ground substitutions — so an accidentally large shared sub-expression
  does not dominate. Ties resolved in order: (1) non-trivial sub-proof over a
  leaf hypothesis; (2) `firstDivergingPosition` — prefer the hypothesis that
  first diverges from the conclusion at the earliest argument index (preserves
  the trailing arguments, e.g. the consequent of a `syl` step); (3)
  `divergingSubtreeOverlap` — prefer the hypothesis whose diverging part does
  _not_ contain the conclusion's diverging part as a subtree (rules out
  rewrite-rule hypotheses, e.g. `mpjaod`'s `jaod.1`/`jaod.2` both contain the
  conclusion's consequent while `jaod.3` does not); (4) smallest expression
  size; (5) `anchorSpine` (token-level LCS with the parent step's expression)
  for structurally-identical hypotheses — e.g. eqtr...i chains where `A=B` and
  `B=C` have the same parse-tree shape; the anchor identifies `A=B` because it
  shares tokens with the preceding `A=D`; (6) null — no clear spine, renders as
  `⇔ TRUE`.
- **Hover + occurrence highlighting** — `highlight.ts`: smallest containing node
  span, plus `matchingOccurrences` (same token sequence ⇒ same parse tree).
- **Parse-tree whitespace** — `spans.ts` (`gapUnits`) + `space.ts`.
- **Calculational rendering** — `table.ts`/`calculation.ts`/`render.ts`, sized
  and toggled in `index.ts`/`view.ts`. A step whose single premise barely
  differs from its own expression (`isSmallStep`, `spine.ts`) is marked
  `smallSpine`; `render.ts` folds it into its parent's hint (`; using rule`) and
  omits its intermediate expression entirely.

## Deferred directions

Larger ideas not yet built — notably **sub-expression calculations** (relating
sub-expressions by their syntax operator within a context, instead of whole
`|- …` statements along the spine) — are recorded in `TODO.md`.
