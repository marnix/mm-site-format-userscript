# MM Site Format

[![CI](https://github.com/marnix/mm-site-format-userscript/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/marnix/mm-site-format-userscript/actions/workflows/ci.yml)

A browser userscript that improves the formatting and readability of
[metamath.org](https://metamath.org) proof pages.

## What it does

It renders the proof as a **calculation** — in the style of Dijkstra's
[EWD1300](https://www.cs.utexas.edu/~EWD/transcriptions/EWD13xx/EWD1300.html) —
shown above the "Proof of Theorem" table: each step's statement, followed by a
`⇐ { using … }` hint naming the inference rule and the facts it uses. The main
line follows the sub-derivation closest in structure to the step's conclusion
(the expression being transformed); the other sub-derivations are indented and
start collapsed (showing just their conclusion and a `▶` marker), expanding on
click, while leaf facts (hypotheses and axioms) show their reference inline.
Where a step combines two symmetric premises with no clear main line, the
calculation ends that branch at `⇔ TRUE`. The calculation's expressions get the
same whitespace and hover-highlighting as the table below.

A **Calculation version / Table version** switch — added to the page's top-right
"… version" links — shows one and hides the other, with the calculation shown by
default. (Add `?view=table` to a proof URL to start in the table view.) Choosing
the table view carries onto the metamath.org links you follow, so the whole site
stays in that view until you switch back.

On a metamath.org proof page — both the Unicode (`mpeuni`) and GIF (`mpegif`)
renderings — the script parses every Metamath expression and adds **hover
highlighting**: pointing at any token highlights the smallest sub-expression
(parse-tree node) that contains it. Hovering a variable highlights just that
variable, an operator highlights its sub-expression, and the turnstile
highlights the whole statement. Every other occurrence of that same
sub-expression (regardless of spacing) is highlighted too, in a lighter shade,
so you can see where it recurs.

It parses by reconstructing each expression's grammar from the page's "Syntax
hints" links, so an expression is only highlighted once it has been fully
parsed; anything it cannot parse is left untouched, and a ⚠ indicator in the
page banner reports how many expressions failed to parse (if any).

Hovering the `⇐` operator between two consecutive steps in a calculation
**highlights the changed sub-expressions** in both: the tokens that differ
between the two steps are highlighted in red, while unchanged sub-expressions
stay uncoloured. This makes it easy to see at a glance what each step actually
changes.

It also adds **parse-tree-guided whitespace**: extra space around the larger
operators in an expression (more for outer/bigger sub-expressions, tight around
the innermost ones and around brackets), so the structure is readable even
without hovering. And in the proof table, a long Expression that wraps now
hang-indents its continuation lines under the expression body rather than under
the step-depth leader.

Hovering any inference-rule reference link — the short step-count links in the
proof table's Ref column and in the "Referenced by:" section — shows a **rule
tooltip**: the linked theorem's conclusion, followed by its hypotheses separated
by `⇐` and `&`, so you can read the rule without navigating away. Works on both
Unicode and GIF pages.

## Installation

1. Install a userscript manager such as
   [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. Open this URL — your userscript manager will offer to install the script:

   <https://github.com/marnix/mm-site-format-userscript/releases/latest/download/mm-site-format.user.js>

It tracks the latest release and updates itself from that URL.

(To build from source instead, see [CONTRIBUTING.md](CONTRIBUTING.md).)

## Design and roadmap

See [DESIGN.md](DESIGN.md) for architecture and [TODO.md](TODO.md) for planned
work.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

_Much of the code in this repository was generated with the assistance of an
LLM._
