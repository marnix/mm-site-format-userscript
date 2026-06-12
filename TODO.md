# TODO

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

## Calculational proof rendering (phase 2)

See DESIGN.md "Calculational proof rendering". Roughly in order:

- A `Calculation` data type + a pure `evaluate(calculation): Proof`, tested by
  hand-building the bitrdi calculation and asserting it matches the bitrdi proof
  tree. _(Prerequisite — evaluating the hand-built bitrdi proof tree itself — is
  done.)_
- Build the proof tree of the main `|- …` assertion from the proof `<table>`
  (ground instances read off the table, or fetch theorem rules — to decide).
- The table→calculation algorithm: use the phase-1 parse trees to find the
  context and sub-expressions, handling transitivity and windowing rules.
- Render the calculation as Dijkstra-style HTML above the proof table.
- Reverse-`wi` rendering (the arrow the other way) — separate feature.
- Guard: only run when every Expression-column cell parsed; else log and stop.

## Features

- **Whitespace via parsing**: use the parse tree to add whitespace within
  rendered expressions, improving readability even without hover highlighting.
- **Expand/collapse sub-calculations**: let the reader collapse and expand a
  sub-calculation in the calculational rendering.
- **Nested hover levels**: clicking a highlighted sub-expression cycles to the
  next-larger enclosing expression.
- **Rule tooltip on hover**: show the name of the matched syntax rule (e.g.
  `wi`) in a tooltip next to the highlighted region.
- **Highlight across steps**: when hovering a sub-expression, also highlight the
  same sub-expression in earlier proof steps that introduce it.
