# TODO

## 0.9.0 goals

- **Move implementation detail out of DESIGN.md into the code**: DESIGN.md
  should keep only _navigation_ — a starting point for a human, a map of the
  source files and the algorithms — not the how-it-works detail. Move that
  detail into the code, preferably by making the code self-documenting through
  renames and small refactors, and only as comments where a rename/refactor
  cannot carry the meaning. Do not lose information that would help a future
  change: relocate it, don't delete it. Work section by section through
  DESIGN.md, checking after each that the prose removed is genuinely recoverable
  from the code it now lives near.
- **Deemphasize "small" calculation steps** (`stepIsSmall`): visually fade (e.g.
  lower opacity) spine steps that add little new information, so the eye skips
  to the steps that matter. In the earlier userscript a step counted as small
  when it had a single premise and its spine child's expression was barely
  different from the conclusion — measured by the longest common subsequence of
  the two expression _texts_:
  `diffLengthDiff = log2((len(child) − lcs + 1) / (len(conclusion) − lcs + 1))`,
  small iff one subproof and `diffLengthDiff ≤ 2`. Adapt to this codebase: we
  already have the parse trees and the spine, so a cleaner similarity measure is
  parse-tree overlap (cf. `spine.ts`) or a token (not character) LCS between the
  step and its spine child. Decide the fade styling and the threshold; keep the
  threshold a named constant.

## Performance

- **Longer-lived cache**: processing results are cached in `sessionStorage` (see
  `cache.ts`), so they survive navigation within a tab session but not a fresh
  tab. Consider `localStorage` for cross-session reuse — weigh against staleness
  when set.mm is regenerated (the `GRAMMAR_CACHE_VERSION` bump only covers our
  own format changes, not upstream content changes).
- **Invalidate the cache when a page's contents change** (low priority): nothing
  currently detects that a linked page changed upstream (e.g. after a set.mm
  regeneration) — a stale cached rule would simply be reused. Investigate keying
  entries on something content-derived (an `ETag` / `Last-Modified` from the
  fetch, or a hash of the relevant extracted markup) so a changed page misses
  rather than serving stale extraction. Lower urgency for `sessionStorage`
  (per-tab, short-lived) than it would be for a `localStorage` move.

## Correctness / completeness

- **Transitive syntax loading**: currently only the syntax hints of the main
  page and one level of Ref links are loaded. A fully general parse requires
  following transitive dependencies (syntax hints of syntax hints, etc.) until a
  fixed point. Add depth-limited or full transitive loading.

## Upstream issues to report

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

Shipped: the proof tree is read from the proof table (`table.ts`) and rendered
as a `<==` calculation above it (`calculation.ts`, `render.ts`): Ref/Expression
HTML copied from the table, the spine chosen by parse-tree overlap (`spine.ts`)
and ending at a `⇔ TRUE` terminal when symmetric, each leaf's Ref shown in the
left column, the step hint naming the non-spine premises, and the clones
re-parsed for whitespace and hover. A Calculation / Table view switch
(`view.ts`) shows one and hides the other, calculation by default, and carries
the table choice onto metamath.org links. Further out:

- **Drop the calc-box width fudge** (low priority): the calculation box is sized
  to its measured fully-expanded `max-content` width × 1.1, because the measured
  width comes out slightly too small and a few lines still wrap. Find the real
  cause and remove the arbitrary 10%. Lead: the whitespace spacers may not be
  fully counted at measurement time — the measurement is meant to run after the
  second parse pass inserts them, but check whether their `ex`-based padding is
  actually reflected in the measured `max-content` (or whether the spacing
  effectively lands after the measurement).
- **Reverse-`wi` rendering**: show implication the other way (`⇒` vs `⇐`) where
  it reads better.
- **Sub-expression calculations**: instead of relating whole `|- …` statements
  along the spine, relate _sub-expressions_ by their syntax operator (`<->` =
  `wb`, `->` = `wi`, …) within a surrounding context, so an inference reads as a
  chain of sub-expression rewrites. Considerably more involved — contexts,
  per-step operators, transitivity/windowing rules; deferred. See DESIGN.md.

## Features

- **Indent wrapped Expression-column lines**: in the proof table's Expression
  column, a long expression that wraps should hang-indent its continuation lines
  — ideally by the width of the leading "leader" (the `. . . n` step-depth
  marker) plus the first token and the following space — so wrapped lines line
  up under the expression rather than under the leader.
- **Nested hover levels**: clicking a highlighted sub-expression cycles to the
  next-larger enclosing expression.
- **Rule tooltip on hover**: show the name of the matched syntax rule (e.g.
  `wi`) in a tooltip next to the highlighted region.
