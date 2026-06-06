# Design

## Goal

Improve readability of [metamath.org](https://metamath.org) proof pages by
parsing the MM expressions on those pages and adding interactive features.

Initial feature: **hover highlighting** — hovering over any token in an MM
expression highlights the smallest sub-expression (parse-tree node) containing
that token.

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

Variable leaves have no pattern; they are identified by `<SPAN CLASS=wff>` etc.
directly inside the expression.

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

## Parsing algorithm

Given the collected grammar rules and the DOM of a `<SPAN CLASS=math>` element:

1. **Tokenise**: walk DOM children to produce a flat list of tokens — either a
   typed-variable span or a literal string (operator / punctuation).
2. **Recursive-descent parse**: try each grammar rule in turn; a rule matches
   when its pattern of literals and typed sub-expressions aligns with the
   remaining token list. Return the first match. Variables are matched by type.

Because MM expressions are fully parenthesised, the grammar is unambiguous and
the parse is deterministic.

## Hover highlighting

Each parse-tree node spans a contiguous range of DOM tokens. On `mouseenter`
over any token element:

1. Walk up the parse tree to find the smallest node whose token range contains
   the hovered token.
2. Add a CSS highlight class to all DOM elements in that range.
3. Remove the class on `mouseleave`.
