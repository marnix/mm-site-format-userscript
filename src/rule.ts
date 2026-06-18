// Extracts an inference (grammar) rule from a GIF syntax-definition page. The
// conclusion is the Assertion expression; the assumptions are the mandatory
// variable typings from the Hypotheses table (e.g. "wff ph"). Both are read as
// plain ALT text -- no colour sampling -- so this works on a fetched, unrendered
// linked page.

import { extractGifText, findGifRuns } from "./expression";
import { parseKindNames } from "./kind";
import type { Expression, InferenceRule } from "./proof";
import { tokenizeMathSpan } from "./token";

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

  // "Hypothesis" (one mandatory hypothesis) or "Hypotheses" (more than one).
  const hypotheses = doc.querySelector('table[summary^="Hypothes"]');
  const assumptions = hypotheses ? findGifRuns(hypotheses).map(runTokens) : [];

  return { assumptions, conclusion: runTokens(conclusionRun) };
}

/**
 * Extracts the grammar rule from a Unicode syntax-definition page: the
 * conclusion from the Assertion's `span.math`, the assumptions from each
 * Hypotheses `span.math`. Variable kinds come from the span classes (no colour).
 */
export function uniAssertionRule(doc: Document): InferenceRule | null {
  const kinds = parseKindNames(doc);
  const tokens = (span: Element): Expression =>
    tokenizeMathSpan(span, kinds).map((t) => t.text);

  const conclusion = doc.querySelector('table[summary="Assertion"] span.math');
  if (!conclusion) return null;

  const assumptions = [
    ...doc.querySelectorAll('table[summary^="Hypothes"] span.math'),
  ].map(tokens);

  return { assumptions, conclusion: tokens(conclusion) };
}
