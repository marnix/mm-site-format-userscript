# TODO

## 0.3.0 goals

- **Whitespace via parsing**: use the parse tree to add whitespace within
  rendered expressions, improving readability even without hover highlighting.
- **Collapse sub-calculations by default**: render the calculation with
  sub-calculations collapsed, expanding a sub-calculation on click.
- **Spine-choosing heuristics**: replace the trivial `spine = 0` everywhere with
  the first heuristics for picking a more readable spine (main line) per step.

## Possible 0.2.1 (README only)

The README still calls the calculational rendering "in progress", though it
shipped in 0.2.0. Consider a README-only **0.2.1** on a `0.2.x` maintenance
branch that documents the feature. (The main-branch README will be updated for
0.3.0 regardless.)

## Performance

- **Cache linked pages**: currently linked pages are fetched on every page load.
  Cache parsed grammar rules in `sessionStorage` (or `localStorage` for
  longer-lived caching) keyed by URL, to avoid redundant fetches when navigating
  between pages that share dependencies.

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

Shipped in 0.2.0: the proof tree is read from the proof table (`table.ts`) and
rendered as a `<==` calculation above it (`calculation.ts`, `render.ts`), using
a simple structural model — Ref/Expression HTML copied from the table,
`spine = 0` everywhere. Near-term work is under "0.3.0 goals". Further out:

- **Reverse-`wi` rendering**: show implication the other way (`⇒` vs `⇐`) where
  it reads better.
- **Richer model** (deferred): sub-expression contexts and explicit
  transitivity/windowing operators — only if the simple model proves
  insufficient. DESIGN.md still describes that earlier, more complex model and
  is out of date with the shipped code.

## Features

- **Nested hover levels**: clicking a highlighted sub-expression cycles to the
  next-larger enclosing expression.
- **Rule tooltip on hover**: show the name of the matched syntax rule (e.g.
  `wi`) in a tooltip next to the highlighted region.
- **Highlight across steps**: when hovering a sub-expression, also highlight the
  same sub-expression in earlier proof steps that introduce it.
