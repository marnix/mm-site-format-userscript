# TODO

## 0.5.0 goals

- **End-of-spine choice**: when `chooseSpine` finds no clear main line (two or
  more non-trivial sub-proofs tied at the maximum overlap), end the spine
  explicitly instead of falling back to the first sub-proof — the choice the
  earlier hand-crafted script made. Use `bitrd` as the example (its two premises
  are symmetric, so the spine ties and should end). See "Calculational proof
  rendering" below.
- **Calculation / Table view toggle**: a "Calculation version" / "Table version"
  control in the top-right; show one and hide the other. Default to the
  calculational version; remember the choice via a query parameter that switches
  the calculation _off_ (so a plain URL stays calculational). Use `@match …/*`
  URL matching — a path/query-constrained `@include` would block the param.

## Bugs

- **GIF hover: `Disj` not highlightable on its own** (mpegif/disjrel.html only):
  in `|- ( Disj R -> Rel R )`, hovering the `Disj` token does not highlight
  `Disj R`, though hovering `Rel` highlights `Rel R` fine, and `Disj` does
  highlight as part of larger expressions. GIF-specific; not seen elsewhere.

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
HTML copied from the table, the spine chosen by parse-tree overlap (`spine.ts`),
each leaf's Ref shown in the left column, the step hint naming the non-spine
premises, and the clones re-parsed for whitespace and hover. Further out:

- **End-of-spine terminal**: render the no-clear-main-line case (see the 0.5.0
  goal) as an explicit ended spine — e.g. a synthetic `… <==> TRUE` line with
  every sub-proof shown as a side calculation, rather than threading on through
  the first sub-proof.
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
