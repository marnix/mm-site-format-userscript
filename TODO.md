# TODO

## 0.6.0 goals

- **Preserve the chosen view across navigation**: add the `view` query parameter
  to every outbound link to a metamath.org host (proof-step Refs,
  related-theorem links, etc.), so the chosen view (table, or the calculational
  default) carries over as the user follows links.

## Bugs

- **GIF hover: `Disj` not highlightable on its own** (mpegif/disjrel.html only):
  in `|- ( Disj R -> Rel R )`, hovering the `Disj` token does not highlight
  `Disj R`, though hovering `Rel` highlights `Rel R` fine, and `Disj` does
  highlight as part of larger expressions. GIF-specific; not seen elsewhere.
- **Highlight on a green-background cell misses part of the expression**: where
  the proof table shades a cell green, the hover highlight does not cover
  everything it should. (Images to come when this is picked up.)
- **Subscripted token only partly highlighted** (e.g. `0R` — `0` with subscript
  `R`): hovering the base `0` highlights only `0`; the subscript `R` highlights
  only as part of a larger expression, never the `0R` token on its own. Likely
  the subscript-folding in `token.ts` (the folded subscript char reuses the base
  char's location).

## Performance

- **Cache linked pages**: currently linked pages are fetched on every page load.
  Cache parsed grammar rules in `sessionStorage` (or `localStorage` for
  longer-lived caching) keyed by URL, to avoid redundant fetches when navigating
  between pages that share dependencies. (Would also drop the cost of the
  calculation's second parse pass, which re-assembles the grammar from the
  now-memoised fetches rather than reusing the first pass's rules.)

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
(`view.ts`) shows one and hides the other, calculation by default. Further out:

- **Reverse-`wi` rendering**: show implication the other way (`⇒` vs `⇐`) where
  it reads better.
- **Sub-expression calculations**: instead of relating whole `|- …` statements
  along the spine, relate _sub-expressions_ by their syntax operator (`<->` =
  `wb`, `->` = `wi`, …) within a surrounding context, so an inference reads as a
  chain of sub-expression rewrites. Considerably more involved — contexts,
  per-step operators, transitivity/windowing rules; deferred. See DESIGN.md.

## Features

- **Nested hover levels**: clicking a highlighted sub-expression cycles to the
  next-larger enclosing expression.
- **Rule tooltip on hover**: show the name of the matched syntax rule (e.g.
  `wi`) in a tooltip next to the highlighted region.
- **Highlight across steps**: when hovering a sub-expression, also highlight the
  same sub-expression in earlier proof steps that introduce it.
