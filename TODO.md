# TODO

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

- **Transitive syntax loading** (workaround for the incomplete-syntax-hints
  upstream issue below): currently only the syntax hints of the main page and
  one level of Ref links are loaded. A fully general parse requires following
  transitive dependencies (syntax hints of syntax hints, etc.) until a fixed
  point. Add depth-limited or full transitive loading. This would also close the
  residual gap where a displayed expression that is not a proof step (e.g. a
  definitional cross-reference) fails to parse.

## Upstream issues to report

- **Incomplete "Syntax hints"**: a theorem page's "Syntax hints" row can omit a
  constructor that the page actually displays — both in proof-step expressions
  and in non-step expressions (e.g. the `<->` of a definitional cross-reference
  like disjrel's `( Disj R <-> … )`). The hints are meant to list the syntax
  used, so this looks like a generation bug. Worked around here by also reading
  the Ref pages' hints, and — when done — by transitive syntax loading (see
  Correctness above). Check whether it is already reported on
  <https://groups.google.com/g/metamath> /
  <https://github.com/metamath/metamath-exe>; a fix likely belongs in the
  site-generation repos.
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
  per-step operators, transitivity/windowing rules; deferred.

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

## Refactoring

- **Inject a stylesheet instead of inline styles**: styling is currently spread
  across inline `style.cssText` / `style.*` assignments (`render.ts`,
  `space.ts`, `view.ts`, `highlight.ts`, the `index.ts` banner). Move the
  styling that is common across the page into one injected `<style>` with
  sensible class names, so the generated HTML reads cleanly and style tweaks are
  localized to a single place in the source. Keep genuinely dynamic values (e.g.
  a measured width, a per-spacer padding) inline.
