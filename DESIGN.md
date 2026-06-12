# Design

## Goal

Improve readability of [metamath.org](https://metamath.org) proof pages by
parsing the MM expressions on those pages and adding interactive features.

Initial feature: **hover highlighting** — hovering over any token in an MM
expression highlights the smallest sub-expression (parse-tree node) containing
that token.

## HTML interpretation principle

When querying the metamath page DOM, prefer **semantic selectors** — CSS
classes, meaningful attribute values (e.g. `CLASS=math`,
`SUMMARY="Proof of theorem"`) — over structural/positional selectors (tag
nesting, `:nth-child`, etc.). Semantic selectors are stable across cosmetic
layout changes and make the intent of each query self-documenting.

## Page structure

A typical proof page (e.g. `bitrdi.html`) contains:

- **Expressions** inside `<SPAN CLASS=math>` elements. Variables are coloured
  child spans: `<SPAN CLASS=wff>` (blue), `<SPAN CLASS=setvar>` (red),
  `<SPAN CLASS=class>` (magenta). Operators and punctuation appear as plain text
  nodes or HTML entities.
- **Syntax hints row** — `<B>Syntax hints:</B>` lists the syntax-definition
  pages used on this page, each as `<A HREF="wi.html">wi</A>` etc.
- **Proof table** — `<TABLE SUMMARY="Proof of theorem">` with columns Step, Hyp,
  Ref, Expression. The Ref column links each step to the axiom or theorem it
  cites, e.g. `<A HREF="a1i.html">a1i</A>`.

Linked pages are of two kinds:

| Kind              | Heading                | MM type     | What it provides                                                       |
| ----------------- | ---------------------- | ----------- | ---------------------------------------------------------------------- |
| Syntax definition | "Syntax Definition wi" | `$a`        | A grammar rule (see below)                                             |
| Theorem / axiom   | "Theorem a1i"          | `$p` / `$a` | Its own syntax hints and Ref links (may contain further grammar rules) |

## Grammar rules

A **grammar rule** is read from a syntax-definition page. It contains:

- **Name** — the label used in Ref columns (e.g. `wi`).
- **Result type** — the type of the expression it builds (e.g. `wff`).
- **Pattern** — the sequence of literal tokens and typed holes that matches a
  sub-expression. Extracted from the Assertion table
  (`<TABLE SUMMARY="Assertion">`). Example for `wi`: `( <wff> → <wff> )`.
- **Hypothesis types** — from the Hypotheses table
  (`<TABLE SUMMARY="Hypotheses">`), the ordered list of types expected at each
  hole.

Variable leaves have no pattern; each is a single variable of a known **kind**
(`wff`, `setvar`, or `class`). The kind is what lets a leaf fill a typed hole.

## Variable kinds (leaf types)

Every variable occurrence on the page carries its kind; how to read it differs
by rendering mode:

- **Unicode pages** — each variable is a `<SPAN CLASS=wff>` / `CLASS=setvar` /
  `CLASS=class`. The kind is read directly off the class, definitively and
  synchronously.
- **GIF pages** — the kind is the _colour_ of the variable image. The image
  carries no class or colour attribute (the colour is baked into the pixels), so
  it must be sampled by drawing the `<img>` to a `<canvas>` and reading a pixel.
  The images are same-origin (`us.metamath.org`), so the canvas is not tainted
  and `getImageData` is allowed. The colour→kind map comes from the "Colors of
  variables:" legend on the same page, which is itself machine-readable, e.g.
  `<SPAN CLASS=wff STYLE="color:blue">wff</SPAN>` (blue→wff, red→setvar,
  `#C3C`→class). Confirmed empirically: the dominant ink pixel of each variable
  GIF is an _exact_ match to a legend colour (`_varphi.gif`→`(0,0,255)`,
  `_x.gif`→`(255,0,0)`, `_ca.gif`→`(204,51,204)`), so kind lookup is an exact
  colour-equality test — no nearest-colour tolerance needed. Recipe: draw the
  `<img>` to a canvas, take the most common opaque non-white pixel, match it to
  the legend.

**Colour is only ever needed on the current, rendered page.** A
syntax-definition page states its variables' kinds as text typecodes in its
Hypotheses table (`wff ph`, read from the ALT), so rule extraction from a
fetched (unrendered) linked page needs no colour sampling. Sampling — which
requires a rendered `<img>` — is confined to the current page, where it supplies
the kinds of the goal expressions' own variables (e.g. `th`), which carry no
typecode.

A page plus its direct links is **self-contained** for parsing: the rules come
from the syntax-hint links (see Grammar rules), and the leaf kinds come from the
page itself by the means above. Note that a variable like `th` is _not_ given an
explicit `wff th` typecode anywhere on the page set — its kind is conveyed only
by class/colour. (Even without it, an unambiguous grammar can often infer a
single token's kind from the hole it occupies; colour/class reading is the
direct signal, inference a fallback.)

## Loading linked pages

On page load the script assembles the grammar from:

1. The current page's **syntax hint** links → syntax-definition pages.
2. Each **Ref-column** theorem/axiom page (from the proof table): fetched, and
   _its_ syntax hints added too. Every constructor in a proof step is introduced
   by some cited assertion, so the union of syntax hints over the page and its
   Ref pages covers the whole proof table — a workaround for incomplete syntax
   hints (see below).
3. `cv.html` always (the setvar→class coercion, needed wherever a setvar sits in
   a class position, yet never listed in syntax hints).

Each syntax-definition page yields one grammar rule. Fetching is eager; each
fetch is a plain `fetch()` parsed with `DOMParser`. A failed fetch is skipped.

## Parse tree

An expression is represented as a tree:

- **Leaf**: a single typed variable (`<SPAN CLASS=wff>` etc.).
- **Rule node**: a grammar rule applied to an ordered list of child sub-trees.

Example — expression `(φ → (ψ ↔ χ))`:

```
wi
├── φ   (wff leaf)
└── wb
    ├── ψ   (wff leaf)
    └── χ   (wff leaf)
```

## Parsing as proof search (GIF pages first)

A parse tree _is_ a proof, exactly as the metamath program builds one with
`improve all` (see the `/tmp/parse-example.mm` experiment). We reproduce that
model directly. This is built for GIF-based expressions first.

### Config section (top of the userscript)

`$TOP` is just an ordinary token (like `|-`, `)`, or `Disj`), chosen because
`$…` is never a valid MM token, so it cannot clash. The _only_ thing built in
globally is one inference rule:

    "wff chi"  ==>  "$TOP |- chi"

Parsing an assertion `E` (which itself begins with `|-`) means **proving it with
target type `$TOP`** — i.e. proving the statement `$TOP <E>`.

### Data types

- **Expression** — a sequence of tokens (each token a string). _Not_ a single
  string, because Unicode pages render without spaces between tokens. (Whether
  to embed the variable kind in a token is undecided; for now it is not — a
  token is recognised as a variable via the page's kind registry.)
- **Inference rule** — a (possibly empty) **unordered** set of assumption
  expressions and one conclusion, `A1 & A2 & … ==> C`. Grammar rules
  (`wi: wff ph & wff ps ==> wff ( ph -> ps )`), variable typings, and config
  rules are all inference rules.
- **Substitution** — a map from variable token to expression. `substitute(σ, R)`
  returns a variant of rule `R` with all variables replaced simultaneously.
  (This is a plain function on rules, not a proof node.)
- **Proof** — `apply R σ [p1 … pn]`: combines substitution and application. `R`
  is a base inference rule, `σ` a substitution; let `R2 = substitute(σ, R)`.
  Evaluate each `pi`; the set of their conclusions must equal `R2`'s assumptions
  (unordered); the result keeps the union of the `pi`'s assumptions and `R2`'s
  conclusion. A **leaf** is the degenerate case: a zero-assumption rule (a
  variable's kind-typing, `() ==> wff ph`) applied to no sub-proofs.

A variable in any rule or goal is recognised via the page's **kind registry**
(`token → kind`, from colour/class detection) — kinds are not embedded in the
token. A rule's **result type** is the first token of its conclusion; the rest
is the pattern matched against an expression.

### Evaluation and validation

`evaluate(proof) → inference rule`. A complete parse of expression `E` evaluates
to a **closed** rule — no open assumptions —

    ==>  $TOP |- ( ph -> ( ps <-> th ) )

because every variable typing is discharged by a zero-assumption leaf rule. A
successful evaluation thus confirms the tree is a valid, complete proof: at each
step the sub-proofs' conclusions exactly match the (substituted) rule's
assumptions. The variable kinds live in the leaf rules.

`evaluate` is a **verification tool for tests only** — it double-checks that a
generated parse tree really proves what it should. The userscript runtime uses
the `Proof` tree directly (e.g. for hover highlighting) and does not need
`evaluate`, so it tree-shakes out of the shipped bundle until something imports
it.

### The parser (proof search)

Recursive descent directed by target type,
`parse(tokens, pos, T) → {proof, nextPos}`:

- If the token at `pos` is a variable of kind `T`, it is a leaf: apply the
  zero-assumption rule `() ==> T token` with no sub-proofs, consuming one token.
- Otherwise try each rule whose result type is `T`. Match its pattern against
  the tokens: a literal (constant) token must equal the current token; a hole
  (the rule's variable, of kind `K`) is filled by recursively parsing a
  sub-expression of type `K`, recording the binding and consuming what it
  consumes. On a full match, build `σ` from the hole bindings and return the
  `apply` node `(rule, σ, subProofs)`.

The resulting proof object _is_ the parse tree. If nothing matches the parser
returns failure — which doubles as the filter for accidental non-expressions.
Because MM expressions are fully parenthesised the grammar is unambiguous, so
first-match is expected to be deterministic.

### Limitation: incomplete syntax hints

A page's own "Syntax hints" can omit a constructor that a proof step actually
displays. Loading the syntax hints of the Ref-linked theorem pages too (see
"Loading linked pages") covers the constructors the proof's steps introduce,
since each is brought in by some cited assertion. A residual gap remains for
displayed expressions that are _not_ proof steps — e.g. the definitional
cross-reference on `mpegif/disjrel.html`, `( Disj R <-> … )`, whose `<->` (`wb`)
etc. are hinted by neither the page nor any Ref page. Such an expression is left
unparsed (the ignore-if-no-parse-tree principle); fully resolving it would need
transitive syntax loading (see TODO).

### Tokenizing the Unicode rendering

GIF pages mark each token (one `<img alt>` per token), so tokenizing is direct.
The Unicode rendering instead runs constants together with no delimiter (e.g.
`([⟨`) and renders subscript tokens (`~R`, `0R`) with the `R` in a `<sub>`
element. So the Unicode tokenizer folds a subscript element into the preceding
token, and splits a run of concatenated constants by longest-match against the
grammar's constant tokens. That constant vocabulary is reliable because each
constant appears delimited (by the variable spans) on its own syntax-definition
page, even though it is run together in dense theorem expressions.

## Hover highlighting

Each parse-tree node spans a contiguous range of DOM tokens. On `mouseenter`
over any token element:

1. Walk up the parse tree to find the smallest node whose token range contains
   the hovered token.
2. Add a CSS highlight class to all DOM elements in that range.
3. Remove the class on `mouseleave`.

## Whitespace from the parse tree

To make structure readable without hovering, extra space is added between
tokens, guided by the parse tree (`spans.gapUnits`). Each node has a `spacing` =
its subtree height (a leaf is -1, else `max(children) + 1`), and contributes
that spacing to the gaps **strictly between its first and last sub-expression**
— i.e. symmetric space around its operators — and nothing before the first or
after the last child, so brackets stay tight. Bigger sub-expressions therefore
get more space around their operator; the innermost get none.

Rendering (`space.ts`) inserts an empty inline spacer (left padding ∝ units)
before each such gap, splitting text nodes where a gap falls mid-text; the
original glyphs are untouched. The tokenizer is then re-run to refresh hover
locations (spacers are empty, so they are ignored). Spacers are also coloured by
the highlighter, since the CSS Highlight API does not paint empty elements.

## Calculational proof rendering

The proof is also shown as a calculation in the style of Dijkstra's
[EWD1300](https://www.cs.utexas.edu/~EWD/transcriptions/EWD13xx/EWD1300.html),
above the "Proof of Theorem" table. The proof tree is read straight from the
table (`table.ts`): each row's Ref cell and Expression cell become a node, with
one sub-proof per Hyp entry. That tree is rendered (`render.ts`) as a chain of
`|- …` statements joined by `⇐ { … }` hints — each hint naming the inference
rule, with sub-derivations indented — following a chosen _spine_ (the main line;
currently the first sub-proof of each step). It is purely structural: the page's
own Ref/Expression HTML is cloned into place, so no re-parsing is needed.

Each sub-derivation starts **collapsed**, showing only its conclusion and a `▶`
disclosure marker in the left column; clicking the marker expands it (and the
hint collapses it again).

### Choosing the spine

Each step picks a _spine_ sub-proof — the main line carried downward — or
decides there is none. The guiding idea: a calculation transforms one
expression, so the spine sub-proof is the one whose conclusion is **most like
the step's conclusion** (it is the running expression, rewritten in one place),
while the other sub-proofs justify that local rewrite and become side
calculations.

An earlier hand-crafted version measured this on the expression **HTML
strings**: for each sub-proof it took the longest-common-subsequence length `l`
of the sub-proof's and the conclusion's expression HTML, then a size-aware
relative difference `log2((|sub| − l + 1) / (|concl| − l + 1))`, and chose the
sub-proof minimising it. If two non-trivial sub-proofs scored within ~0.2 it
chose **none** (a "trivial" sub-proof being a leaf — a hypothesis or
0-assumption step); reused ("shared") steps were treated as auxiliary.

When no sub-proof is the clear continuation, the spine **ends**: render a
synthetic `… <==> TRUE` and show every sub-proof as a side calculation. (Not yet
implemented; relates to the leaf-Ref TODO.)

Direction: do this on **parse trees** rather than HTML. A top-down structural
overlap — count nodes that apply the same rule, recursing into paired children,
with leaf↔leaf counting — is a truer measure of shared structure than an HTML
LCS: it is not fooled by tags, glyph encodings, or the inserted whitespace
spacers; it is linear rather than quadratic; and it can pinpoint the rewrite
site (where the trees diverge). The same size-aware comparison, the ties→none
rule, and the trivial-leaf handling carry over, now over node counts. (A further
refinement, deferred: take the structure from the Ref theorem's _general_ rule
instead of the ground instances, so "optocl always spines to optocl.3" becomes
an intrinsic, substitution-independent fact.)

### Possible future direction

Instead of relating whole `|- …` statements along the spine, a calculation could
relate _sub-expressions_ by their syntax operator — e.g. `<->` (`wb`) or `->`
(`wi`) — within a surrounding context, so a single inference reads as a chain of
sub-expression rewrites. This is considerably more involved (contexts, per-step
operators, transitivity/windowing rules) and is deferred; the current model is
intentionally simple.
