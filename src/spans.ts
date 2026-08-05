// Token spans of parse-tree nodes, used to decide what to highlight on hover.
// A span is a half-open [start, end) range of token indices within the parsed
// expression. Pure logic over a Proof -- no DOM, no data-type changes.

import type { Proof } from "./proof";

export type Span = [start: number, end: number];

/**
 * Returns the token span of every node in the proof. Offsets are relative to
 * the proof's own token sequence. A node's width is the number of tokens it
 * consumed: each literal in its rule's pattern is one token, each hole consumes
 * its sub-proof's span (in pattern order -- rules are linear).
 */
const nodeSpansCache = new WeakMap<Proof, Span[]>();

export function nodeSpans(proof: Proof): Span[] {
  const cached = nodeSpansCache.get(proof);
  if (cached) return cached;

  const spans: Span[] = [];

  function walk(p: Proof, start: number): number {
    let offset = start;
    let nextSub = 0;
    for (const patternToken of p.rule.conclusion.slice(1)) {
      if (p.subst.has(patternToken)) {
        offset = walk(p.subproofs[nextSub++], offset); // hole
      } else {
        offset += 1; // literal
      }
    }
    spans.push([start, offset]);
    return offset;
  }

  walk(proof, 0);
  nodeSpansCache.set(proof, spans);
  return spans;
}

/**
 * The proof's node spans shifted into location-index space, so they align with
 * a `ParsedExpression`'s `locations`/`tokens`. A "|-" statement parses the whole
 * token list (shift 0); a typecode statement drops its leading typecode
 * (shift 1). `locationCount` is the number of rendered tokens. Pure.
 */
export function nodeLocationSpans(proof: Proof, locationCount: number): Span[] {
  const spans = nodeSpans(proof);
  const rootEnd = Math.max(...spans.map((s) => s[1]));
  const base = locationCount - rootEnd;
  return spans.map(([s, e]) => [s + base, e + base]);
}

/**
 * The narrowest span that contains `index` (the deepest, i.e. smallest,
 * sub-expression node covering that token), or undefined if none does.
 */
export function smallestSpanContaining(
  spans: Span[],
  index: number,
): Span | undefined {
  let best: Span | undefined;
  for (const [start, end] of spans) {
    if (start <= index && index < end) {
      if (!best || end - start < best[1] - best[0]) best = [start, end];
    }
  }
  return best;
}

/**
 * The whitespace "size" of a node: -1 for a leaf, else the max of its children
 * plus 1 (i.e. the subtree height). A simple, local heuristic -- bigger
 * sub-expressions get more space around their operator. Easy to swap out.
 */
function spacingOf(proof: Proof, memo: Map<Proof, number>): number {
  const cached = memo.get(proof);
  if (cached !== undefined) return cached;
  const s =
    proof.subproofs.length === 0
      ? -1
      : Math.max(...proof.subproofs.map((p) => spacingOf(p, memo))) + 1;
  memo.set(proof, s);
  return s;
}

/**
 * Units of extra whitespace to put *before* each token of the proof's token
 * sequence (`units[0]` is 0). A gap gets spacing only when it is adjacent to an
 * *operator*: a pattern token with a hole immediately before and after it. The
 * operator can be a literal (e.g. `->` or `e.`) or a hole -- `co` is
 * `class ( A F B )`, so an operator like `+no` fills the hole `F` and is itself
 * a sub-expression. Both sides of an operator get the same value: the operator's
 * own subtree height (`spacingOf`), but at least 1 unit even when both operands
 * are leaves (height 0) -- an infix operator between two simple classes like
 * `( F o. G )` or `( A +no B )` must still show some spacing. A parent
 * operator's height strictly exceeds its children's, so the whitespace grows
 * with operator level -- a high-level `->` gets more room than a `<->` nested
 * inside it, which gets more than an inner `=`. Everything follows from the
 * parse-tree heights and each rule's own pattern structure -- nothing is keyed
 * on a rule name or paren token.
 */
export function gapUnits(proof: Proof): number[] {
  const memo = new Map<Proof, number>();
  const units: number[] = [];

  function walk(p: Proof, start: number): number {
    const pattern = p.rule.conclusion.slice(1);
    const isHole = (j: number) =>
      j >= 0 && j < pattern.length && p.subst.has(pattern[j]);

    let offset = start;
    let nextSub = 0;
    pattern.forEach((tok, j) => {
      if (j > 0) {
        // The gap before pattern token j is adjacent to an operator when the
        // token right before it has sub-expressions on both sides (tok is the
        // right operand), or when j itself is an operator. An operator is a
        // token with a hole immediately before and after it -- either a literal
        // (e.g. `->` in ( ph -> ps )) or a hole (e.g. `co`'s operator F in
        // ( A F B ), filled by a class constant like +no in ( A +no B )).
        const beforeIsInfix =
          isHole(j - 2) && !p.subst.has(pattern[j - 1]) && isHole(j);
        const jIsInfix = isHole(j - 1) && !p.subst.has(tok) && isHole(j + 1);
        const beforeIsOp = isHole(j - 2) && isHole(j - 1) && isHole(j);
        const jIsOp = isHole(j - 1) && isHole(j) && isHole(j + 1);
        units[offset] =
          beforeIsInfix || jIsInfix || beforeIsOp || jIsOp
            ? Math.max(spacingOf(p, memo), 1)
            : 0;
      }
      if (p.subst.has(tok)) offset = walk(p.subproofs[nextSub++], offset);
      else offset += 1;
    });
    return offset;
  }

  walk(proof, 0);
  units[0] = 0;
  return units;
}
