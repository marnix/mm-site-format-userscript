# TODO

## Upstream issues to report

- **Incomplete "Syntax hints" — the parts not yet reported**: the core issue
  (proofs using `$a |-` definitions omit constructors from the body) is reported
  as
  [metamath-exe issue #187](https://github.com/metamath/metamath-exe/issues/187)
  (open; upstream fix branch `syntax-hints-def-bodies` not yet merged). The
  reported issue, the current workarounds, and the post-merge cleanup conditions
  are documented in DESIGN.md ("Site-generation limitations and workarounds").
  Two further gaps are **not** covered by #187 and still need a bug report:

  - `cv` (the setvar→class coercion) is omitted on **every** page — categorical.
  - Syntax shown only in a **non-step** expression (e.g. the `<->` of disjrel's
    definitional cross-reference `( Disj R <-> … )`) is hinted by neither the
    page nor any Ref page. (Cannot be recovered from any reachable page; would
    need transitive syntax loading — see Correctness.)

  Repro material for the report (found via our parser check
  `missingSyntaxHints`, which `console.warn`s on affected pages):
  - `wcel` (∈) and `wceq` (=) are omitted exactly when their operands are
    **setvars** (`x ∈ y`, `x = y`), but listed when they are **classes**
    (`A ∈ B`, `A = B`). Minimal controlled repro: `elirr` (`⊢ ¬ A ∈ A`, class)
    lists `wcel`; `elirrv` (`⊢ ¬ 𝑥 ∈ 𝑥`, setvar) does not. Likewise `elequ1`,
    `cleljust`. (Note: `weq`/`wel` — the `$p` syntax theorems behind these — are
    covered by #187's fix branch, but the categorical `cv` omission and the
    setvar-operand pattern above are the residual, unreported part.)
  - The listed hints seem **proof-derived, not assertion-derived**: `elirrv`
    lists `wi`, `wb`, `wa`, `wal`, `wex` (connectives from its proof, absent
    from its assertion) yet drops the `wcel` that its assertion shows.

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

Note: a baseline auto-wrap already exists -- every non-zero gap's spacer carries
a `wbr` soft-wrap opportunity (`space.ts`), so a long expression wraps at gap
boundaries instead of overflowing. It is un-prioritized (greedy first-fit over
all gaps), so the items below are refinements: bias which gaps break, and/or
insert real newlines.

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
- **Spine: transitivity-chain case-split** (e.g. ballotfilemth step 153): a
  `3eqtr*` step's three hypotheses are equivalent chain links (`A = B`, `B = C`,
  `C = D` proving `A = D`), so none is the main line, yet one wins by size. This
  is a different symmetry from the negation-based `caseSymmetric` (pm2.61d,
  already handled): the hypotheses are not identical-up-to-a-negation but
  successive links. Proposed tiebreaker: count how many of the _inference
  rule's_ conclusion variables appear in each hypothesis (from the rule's
  general form, not the ground instance). A hypothesis sharing fewer conclusion
  variables is purely auxiliary (e.g. the middle link `C = B` in `3eqtr2i`
  proving `A = D`); prefer those with the most, and return null when they tie.
  This requires passing the inference rule's assumption patterns into
  `chooseSpine` -- currently it only receives grammar-level parse trees of the
  expressions, not the theorem's hypothesis structure. (The earlier attempt to
  reuse `divergingSubtreeOverlap`/`maxSubtreeOverlap` on unwrapped trees was
  abandoned because it blew up on large trees; the linear `caseSymmetric` path
  now covers the negation case, but does not cover these chains.)
