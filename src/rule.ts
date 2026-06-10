// Extracts an inference (grammar) rule from a GIF syntax-definition page. The
// conclusion is the Assertion expression; the assumptions are the mandatory
// variable typings from the Hypotheses table (e.g. "wff ph"). Both are read as
// plain ALT text — no colour sampling — so this works on a fetched, unrendered
// linked page. See DESIGN.md "Grammar rules".

import { extractGifText, findGifRuns } from "./expression";
import type { Expression, InferenceRule } from "./proof";

/** The tokens of one GIF run (img alts + literal text), as a token sequence. */
function runTokens(run: Node[]): Expression {
  return extractGifText(run).split(" ");
}

/**
 * Extracts the grammar rule from a GIF syntax-definition page: the conclusion
 * from `SUMMARY="Assertion"`, the assumptions from `SUMMARY="Hypotheses"` (each
 * row a variable typing). Returns null if there is no Assertion.
 */
export function gifAssertionRule(doc: Document): InferenceRule | null {
  const assertion = doc.querySelector('table[summary="Assertion"]');
  if (!assertion) return null;
  const [conclusionRun] = findGifRuns(assertion);
  if (!conclusionRun) return null;

  const hypotheses = doc.querySelector('table[summary="Hypotheses"]');
  const assumptions = hypotheses ? findGifRuns(hypotheses).map(runTokens) : [];

  return { assumptions, conclusion: runTokens(conclusionRun) };
}
