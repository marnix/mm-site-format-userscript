# TODO

## Whitespace

The `gapUnits` scheme is in place and matches the site (verified visually): for
an operator (a pattern token with a hole immediately before and after it) both
adjacent gaps get the operator's subtree height (`spacingOf`: leaf `−1`, else
`1 + max(child heights)`, at least 1); word-like prefixes and adjacent-variable
gaps get a fixed 1 unit; symbol prefixes, single-letter prefixes, paren tokens,
and subscript-bracket delimiters stay tight (`csb [_ A / x ]_ B` → `⦋A / x⦌B`).

- **Reduce depth-based spacing around `∈` in binder and class-builder
  patterns**: `{ 𝑥 ∈ On ∣ … }` (`crab`) and `∀ 𝑎 ∈ 𝑝 …` (`wral`) give the
  shallow `∈` the full depth-based gap even though the depth comes only from the
  trailing `…` expression, which is the part that should carry the space. An
  operator's gap is sized by the whole containing node's height (`spacingOf(p)`
  = `1 + max` over *all* children), so a deep non-adjacent sibling operand
  inflates a shallow operator's gaps. Want a consistent way to size operator
  gaps from the operator's own adjacent operands only -- `∈` stays small and the
  deep trailing expression carries the room -- while keeping everything
  achieved. `wi`/`co` are unaffected: every child of those rules is adjacent to
  the operator.

## Upstream issues to report

- **Incomplete "Syntax hints"**: a theorem page's "Syntax hints" row can omit a
  constructor the page actually displays. This looks like a site-generation bug
  (the hints are meant to list the syntax used). Patterns observed (raw material
  for a bug report), found via our parser-based check (`missingSyntaxHints`,
  which `console.warn`s on any affected page):
  - `cv` (the setvar→class coercion) is omitted on **every** page — categorical.
  - `wcel` (∈) and `wceq` (=) are omitted exactly when their operands are
    **setvars** (`x ∈ y`, `x = y`), but listed when they are **classes**
    (`A ∈ B`, `A = B`). Minimal controlled repro: `elirr` (`⊢ ¬ A ∈ A`, class)
    lists `wcel`; `elirrv` (`⊢ ¬ 𝑥 ∈ 𝑥`, setvar) does not. Likewise `elequ1`,
    `cleljust`.
  - The listed hints seem **proof-derived, not assertion-derived**: `elirrv`
    lists `wi`, `wb`, `wa`, `wal`, `wex` (connectives from its proof, absent
    from its assertion) yet drops the `wcel` that its assertion shows.
  - A separate gap: syntax shown only in a **non-step** expression (e.g. the
    `<->` of disjrel's definitional cross-reference `( Disj R <-> … )`) is
    hinted by neither the page nor any Ref page.

  Reported as
  [metamath-exe issue #187](https://github.com/metamath/metamath-exe/issues/187).
  A local branch `syntax-hints-def-bodies` (not yet pushed upstream) adds hints
  from `$a |-` definition bodies and includes `$p` syntax theorems (fixing the
  `weq`/`wel` omission). Worked around here by always loading the omitted
  primitives `cv`/`wcel`/`wceq`/`weq`/`wel` (see `database-assumptions.ts`) and
  by reading the Ref pages' hints with a breakdown-table fallback for `$a |-`
  definition pages (see `grammar.ts`). Once the upstream fix is merged and
  ships: `weq`/`wel` could be dropped from `PRIMITIVE_SYNTAX_PAGES`, and the
  breakdown-table fallback (`extractBreakdownRefUrls` in `grammar.ts`) could be
  simplified or removed. The categorical `cv` omission on every page is a
  separate gap not covered by #187. The non-step gap would need transitive
  loading (see Correctness — though that cannot recover a constructor listed on
  _no_ reachable page).

- **ILE / iset.mm rendering inconsistencies**: ilegif pages (e.g.
  `speano5.html`) render the "Colors of variables" legend with the old
  `<FONT COLOR="#hex">` markup instead of the newer
  `<SPAN CLASS=… STYLE="color:…">`, and label the setvar kind `set` rather than
  its actual typecode `setvar`. Both are worked around in `parseKindColors`.
  Check whether these are already reported on
  <https://groups.google.com/g/metamath> or
  <https://github.com/metamath/metamath-exe>; if a fix is wanted, it likely
  belongs in the site-generation repos
  <https://github.com/metamath/metamath-website-scripts> and
  <https://github.com/metamath/metamath-website-seed>.

## Build / CI

- **Warnings must fail the build**: `npm run ci` currently passes even when the
  build emits warnings, so a real problem could hide behind a warning. Concrete
  case today: the IIFE build warns on `src/config.ts:41` -- `import.meta.env` in
  a non-ESM bundle makes esbuild warn "You need to set the output format to
  'esm' for import.meta to work correctly" (the cast
  `(import.meta as unknown as …)` silences the type error, not the warning; the
  warning is spurious here because the check only runs under vitest, where the
  code is bundled as ESM). Two separate steps:
  1. Make the build fail on warnings (tsup/esbuild `logLevel` / `onwarn`) so
     `npm run ci` catches them.
  2. Then remove the `import.meta` access in `src/config.ts` so the build is
     clean again (e.g. derive the test-mode check from a build-injected constant
     instead of `import.meta.env.MODE`).

## Calculational proof rendering

- **Deduplicate shared sub-derivations**: when a proof step is cited multiple
  times (e.g. `sgnrn.html` step 6, `|- sgn Fn RR*`, used 4 times), its
  sub-calculation currently appears 4 times in the expanded view. The root cause
  is that `table.ts` builds a tree (not a DAG): `build(step)` is called fresh
  for each reference, duplicating the entire sub-derivation. Not every reused
  step needs extraction -- only those that would otherwise appear in **multiple
  distinct sub-calculations** (the collapsed `▶` blocks). The fix depends on
  where the shared step appears:

  - **On the spine** (option 2): label the step `(b)` where it appears on the
    spine, and forward-reference it from earlier hints with "using (b) below".
    This is safe for reading order: the spine goes from conclusion toward
    premises (top-down), so a prerequisite step is always further _down_ -- the
    reader will reach its derivation by continuing to read. No separate block
    needed; the label just deduplicates the collapsed `▶` blocks that would
    otherwise re-derive it.

  - **Only in sub-calculations** (option 1): if the shared step never appears on
    any spine (only inside collapsed `▶` blocks), extract it as a separate
    "Proof of (b):" mini-calculation shown before the main calculation. Each use
    site cites `(b)` like a hypothesis/given, ending its branch there.

  Implementation: (a) memoize `build` in `table.ts` so the proof graph is a DAG
  with shared nodes; (b) in `proofTreeToCalculation`, detect nodes with multiple
  parents; (c) apply option 2 or option 1 depending on whether the node is on
  the spine. `nmulprop.html` (step 71 used 16x, step 69 used 14x) is the
  stress-test fixture.

- **Hint `Ref` ordering**: in a calculation step hint, the `Ref` key should
  always be put first after the initial "using …" (only the first step of a
  calculation may put the hypothesis-derived refs first). Example: on
  `rhmkerinj` (us.metamath.org/mpeuni/rhmkerinj.html) the last calculation step
  `((7) <=> TRUE)` should read "using kerf1ghm, …" with `kerf1ghm` first,
  whereas the first step's "using rhmghm and …" is already correct. The ordering
  depends on whether a step is the first of its calculation.

- **Reverse-`wi` rendering**: show implication the other way (`⇒` vs `⇐`) where
  it reads better.
- **Sub-expression calculations**: instead of relating whole `|- …` statements
  along the spine, relate _sub-expressions_ by their syntax operator (`<->` =
  `wb`, `->` = `wi`, …) within a surrounding context, so an inference reads as a
  chain of sub-expression rewrites. Considerably more involved — contexts,
  per-step operators, transitivity/windowing rules; deferred.

## Features

- **Insert newlines at break points**: actually insert newlines into a long
  rendered expression at its main operator (recursively at outer operators)
  rather than relying on CSS `white-space` wrapping. Distinct from the CSS
  approach below; should pick break points from the same per-gap spacing
  (`spans.gapUnits`).
- **Break long expressions at natural (operator) points**: when an expression
  wraps, break around its main operator (and recursively at outer operators)
  rather than mid-expression. CSS has no break-_priority_ ("break here first,
  then here") — line breaking is greedy first-fit over the _allowed_ break
  opportunities. But we can control _where_ breaks are allowed: wrap each
  parse-tree node's tokens in `white-space:nowrap` so breaks fall only at the
  operator gaps, and bias which gaps break by the existing per-gap "spacing" =
  subtree height (`spans.gapUnits`), so outer operators break first. Slots into
  the spacer system (`space.ts`). Caveats: still greedy (not a global
  pretty-printer), and a `nowrap` node wider than the column overflows rather
  than breaking, so leaves need a fallback opportunity or accept overflow.
- **Nested hover levels**: clicking a highlighted sub-expression cycles to the
  next-larger enclosing expression.
- **Make the hover highlight a clean rectangle** (low priority): the highlight's
  top/bottom edge currently moves up and down across a region, following
  subscripts/superscripts and differing image heights. See whether it can always
  be rendered as a single rectangle spanning the line's full height.
- **Spine: symmetric case-split detection** (pm2.61dan on binomcxp): when two
  hypotheses are logically symmetric (e.g. one has `psi` and the other `-.psi`),
  the calculation should show both as sub-derivations (=> TRUE) rather than
  picking one as spine. The current size tiebreaker picks the smaller one.
  Attempted fix: unwrap $TOP + use commonSubtreeDiff/LCS as tiebreaker, but
  `divergingSubtreeOverlap` (which calls `maxSubtreeOverlap` recursively) blows
  up on large unwrapped trees (fouriersw hangs). A correct fix needs either: (a)
  depth-bound `maxSubtreeOverlap` when using unwrapped trees, or (b) a different
  symmetry criterion that doesn't require deep tree comparison (e.g. check if
  both hypotheses use the same set of the rule's variables relative to the
  conclusion).

  Also affects `3eqtr*` transitivity chains (e.g. ballotfilemth step 153): all
  three hypotheses are equivalent chain links, but one wins by size. Proposed
  tiebreaker: count how many of the _inference rule's_ conclusion variables
  appear in each hypothesis (from the rule's general form, not the ground
  instance). A hypothesis sharing fewer conclusion variables is purely auxiliary
  (e.g. the middle link `C = B` in `3eqtr2i` proving `A = D`); prefer those with
  the most, and return null when they tie. This requires passing the inference
  rule's assumption patterns into `chooseSpine` -- currently it only receives
  grammar-level parse trees of the expressions, not the theorem's hypothesis
  structure.

  The shared-vars metric was prototyped and verified manually on dvelimf (picks
  .3), bi2anan9 (null), 3eqtr2i (null), sylanbrc (null), ax-mp (picks .2), bitrd
  (null), isermulc2 (picks .5). The algorithm: exclude "context" variables
  (those appearing in every assumption AND the conclusion), then count remaining
  conclusion-variables per hypothesis; pick the max, null on tie. It works as a
  primary metric before structural overlap. Implementation blocked on
  architecture: the inference rule's assumption patterns are not available at
  spine-selection time (only grammar-level parse trees are). Would need to fetch
  and cache each rule page's hypotheses, or extract them from the proof table's
  Hyp/Ref columns.
