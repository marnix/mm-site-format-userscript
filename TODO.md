# TODO

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

- **Reverse-`wi` rendering**: show implication the other way (`⇒` vs `⇐`) where
  it reads better.
- **Sub-expression calculations**: instead of relating whole `|- …` statements
  along the spine, relate _sub-expressions_ by their syntax operator (`<->` =
  `wb`, `->` = `wi`, …) within a surrounding context, so an inference reads as a
  chain of sub-expression rewrites. Considerably more involved — contexts,
  per-step operators, transitivity/windowing rules; deferred.

## Features

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
