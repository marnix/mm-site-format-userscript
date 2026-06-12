# MM Site Format

A browser userscript that improves the formatting and readability of
[metamath.org](https://metamath.org) proof pages.

## What it does

On a metamath.org proof page — both the Unicode (`mpeuni`) and GIF (`mpegif`)
renderings — the script parses every Metamath expression and adds **hover
highlighting**: pointing at any token highlights the smallest sub-expression
(parse-tree node) that contains it. Hovering a variable highlights just that
variable, an operator highlights its sub-expression, and the turnstile
highlights the whole statement.

It parses by reconstructing each expression's grammar from the page's "Syntax
hints" links, so an expression is only highlighted once it has been fully
parsed; anything it cannot parse is left untouched.

It also adds **parse-tree-guided whitespace**: extra space around the larger
operators in an expression (more for outer/bigger sub-expressions, tight around
the innermost ones and around brackets), so the structure is readable even
without hovering.

It also renders the proof as a **calculation** — in the style of Dijkstra's
[EWD1300](https://www.cs.utexas.edu/~EWD/transcriptions/EWD13xx/EWD1300.html) —
shown above the "Proof of Theorem" table: each step's statement, followed by the
inference it follows from as a `⇐ { … }` hint. The main line follows the
sub-derivation closest in structure to the step's conclusion (the expression
being transformed); the other sub-derivations are indented and start collapsed
(showing just their conclusion and a `▶` marker), expanding on click. The
calculation's expressions get the same whitespace and hover-highlighting as the
table below.

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
