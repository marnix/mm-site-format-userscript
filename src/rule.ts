// Extracts an inference (grammar) rule from a syntax-definition page. The rule's
// conclusion is the tokenised Assertion; its assumptions are the kind-typings of
// the distinct variables occurring in that conclusion (the mandatory $f
// hypotheses). See DESIGN.md "Grammar rules" / "Parsing as proof search".

import { findGifRuns } from "./expression";
import type { ImageSampler, KindColors } from "./kind";
import type { Expression, InferenceRule } from "./proof";
import { tokenizeGifRun, type Token } from "./token";

/**
 * Builds an inference rule from a tokenised expression: the tokens are the
 * conclusion, and each distinct typed-variable token contributes a kind-typing
 * assumption (`ph` of kind `wff` → assumption `wff ph`).
 */
export function ruleFromTokens(tokens: Token[]): InferenceRule {
  const conclusion: Expression = tokens.map((t) => t.text);
  const assumptions: Expression[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (t.kind !== null && !seen.has(t.text)) {
      seen.add(t.text);
      assumptions.push([t.kind, t.text]);
    }
  }
  return { assumptions, conclusion };
}

/**
 * Extracts the grammar rule from a GIF syntax-definition page by tokenising the
 * expression in its `SUMMARY="Assertion"` table. Returns null if absent.
 */
export function gifAssertionRule(
  doc: Document,
  colors: KindColors,
  sample: ImageSampler,
): InferenceRule | null {
  const table = doc.querySelector('table[summary="Assertion"]');
  if (!table) return null;
  const [run] = findGifRuns(table);
  return run ? ruleFromTokens(tokenizeGifRun(run, colors, sample)) : null;
}
