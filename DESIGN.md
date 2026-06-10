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

A page plus its direct links is **self-contained** for parsing: the rules come
from the syntax-hint links (see Grammar rules), and the leaf kinds come from the
page itself by the means above. Note that a variable like `th` is _not_ given an
explicit `wff th` typecode anywhere on the page set — its kind is conveyed only
by class/colour. (Even without it, an unambiguous grammar can often infer a
single token's kind from the hole it occupies; colour/class reading is the
direct signal, inference a fallback.)

## Loading linked pages

On page load the script:

1. Reads **syntax hint links** from the current page → candidate URLs.
2. Reads **Ref-column links** from the proof table → more candidate URLs.
3. **Fetches** each URL (relative URL resolved against the current page URL).
4. For every fetched page that is a syntax definition, extracts a grammar rule.
5. For every fetched page that is a theorem/axiom, collects its syntax hints
   (one level of recursion — see TODO).

Fetching is done eagerly on page load. Each fetch is a plain `fetch()` call; the
result is parsed as HTML using `DOMParser`.

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
- **Proof** — one of:
  - `hyp H` — a leaf; evaluates to `H ==> H` (adds `H` as an assumption).
  - `apply R σ [p1 … pn]` — combines substitution and application: `R` is a base
    inference rule, `σ` a substitution; let `R2 = substitute(σ, R)`. Evaluate
    each `pi`; the set of their conclusions must equal `R2`'s assumptions
    (unordered); the result keeps the union of the `pi`'s assumptions and `R2`'s
    conclusion.

A variable in any rule or goal is recognised via the page's **kind registry**
(`token → kind`, from colour/class detection) — kinds are not embedded in the
token. A rule's **result type** is the first token of its conclusion; the rest
is the pattern matched against an expression.

### Evaluation and validation

`evaluate(proof) → inference rule`. For a correct parse of expression `E`, the
proof of `$TOP |- E` evaluates to a rule whose assumptions are _exactly_ the
kind-typings of `E`'s variables, e.g.

    wff ph & wff ps & wff th  ==>  $TOP |- ( ph -> ( ps <-> th ) )

That cross-checks against the kinds detected by colour: the same multiset of
variable typings, no more and no less.

`evaluate` is a **verification tool for tests only** — it double-checks that a
generated parse tree really proves what it should. The userscript runtime uses
the `Proof` tree directly (e.g. for hover highlighting) and does not need
`evaluate`, so it tree-shakes out of the shipped bundle until something imports
it.

### The parser (proof search)

Recursive descent directed by target type,
`parse(tokens, pos, T) → {proof, nextPos}`:

- If the token at `pos` is a variable of kind `T`, it is a leaf: return
  `hyp([T, token])`, consuming one token.
- Otherwise try each rule whose result type is `T`. Match its pattern against
  the tokens: a literal (constant) token must equal the current token; a hole
  (the rule's variable, of kind `K`) is filled by recursively parsing a
  sub-expression of type `K`, recording the binding and consuming what it
  consumes. On a full match, build `σ` from the hole bindings and return
  `apply(substitute(σ, rule), subProofs)`.

The resulting proof object _is_ the parse tree. If nothing matches the parser
returns failure — which doubles as the filter for accidental non-expressions.
Because MM expressions are fully parenthesised the grammar is unambiguous, so
first-match is expected to be deterministic.

## Hover highlighting

Each parse-tree node spans a contiguous range of DOM tokens. On `mouseenter`
over any token element:

1. Walk up the parse tree to find the smallest node whose token range contains
   the hovered token.
2. Add a CSS highlight class to all DOM elements in that range.
3. Remove the class on `mouseleave`.
