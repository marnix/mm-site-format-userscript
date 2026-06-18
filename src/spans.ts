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
export function nodeSpans(proof: Proof): Span[] {
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
 * sequence (`units[0]` is 0). A node contributes its spacing to the gaps
 * strictly between its first and last sub-expression -- i.e. around its operators
 * -- and nothing before the first or after the last, so brackets stay tight and
 * the space around an operator is symmetric.
 */
export function gapUnits(proof: Proof): number[] {
  const memo = new Map<Proof, number>();
  const units: number[] = [];

  function walk(p: Proof, start: number): number {
    const spacing = spacingOf(p, memo);
    const pattern = p.rule.conclusion.slice(1);
    const holes = pattern.flatMap((tok, j) => (p.subst.has(tok) ? [j] : []));
    const firstHole = holes[0];
    const lastHole = holes[holes.length - 1];

    let offset = start;
    let nextSub = 0;
    pattern.forEach((tok, j) => {
      if (j > 0) {
        const interior =
          firstHole !== undefined && j - 1 >= firstHole && j <= lastHole;
        units[offset] = interior ? spacing : 0;
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
