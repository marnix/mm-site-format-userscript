// Token spans of parse-tree nodes, used to decide what to highlight on hover.
// A span is a half-open [start, end) range of token indices within the parsed
// expression. Pure logic over a Proof — no DOM, no data-type changes.

import type { Proof } from "./proof";

export type Span = [start: number, end: number];

/**
 * Returns the token span of every node in the proof. Offsets are relative to
 * the proof's own token sequence. A node's width is the number of tokens it
 * consumed: each literal in its rule's pattern is one token, each hole consumes
 * its sub-proof's span (in pattern order — rules are linear).
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
