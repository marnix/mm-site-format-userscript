// Wires the pieces together for a page: tokenise every expression, assemble the
// grammar from the syntax-hint pages, build the kind registry, and parse each
// expression into a proof (= parse tree). Pure logic, independent of the
// browser — index.ts supplies the real fetch + canvas sampler.

import { assembleGifGrammar, assembleUniGrammar } from "./grammar";
import { findGifRuns, findMathSpans } from "./expression";
import { parseKindColors, parseKindNames, type ImageSampler } from "./kind";
import type { Fetcher } from "./loader";
import { parseExpression, type KindOf } from "./parse";
import type { InferenceRule, Proof } from "./proof";
import { tokenizeGifRun, tokenizeMathSpan, type Token } from "./token";

export interface ParsedExpression {
  tokens: Token[];
  proof: Proof | null; // null when the expression does not parse
}

/**
 * Builds the kind registry and parses each tokenised expression. The registry
 * is the union of the page's own variable kinds and the grammar rules' variable
 * typings. A statement beginning with the turnstile (the $TOP rule's first
 * pattern token) is parsed at the synthetic $TOP type; any other expression
 * starts with its own typecode.
 */
function parseTokenized(
  tokenized: Token[][],
  rules: InferenceRule[],
): ParsedExpression[] {
  const registry = new Map<string, string>();
  for (const tokens of tokenized) {
    for (const t of tokens) if (t.kind) registry.set(t.text, t.kind);
  }
  for (const rule of rules) {
    for (const a of rule.assumptions) {
      if (a.length === 2) registry.set(a[1], a[0]);
    }
  }
  const kindOf: KindOf = (token) => registry.get(token);
  const turnstile = rules[0]?.conclusion[1];

  return tokenized.map((tokens) => {
    const expr = tokens.map((t) => t.text);
    const proof =
      expr[0] === turnstile
        ? parseExpression(expr, "$TOP", rules, kindOf)
        : parseExpression(expr.slice(1), expr[0] ?? "", rules, kindOf);
    return { tokens, proof };
  });
}

/** Parses every GIF expression on the page (kinds via colour sampling). */
export async function parseGifExpressions(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  sample: ImageSampler,
): Promise<ParsedExpression[]> {
  const colors = parseKindColors(doc);
  const cache = new Map<string, string | null>();
  const tokenized = findGifRuns(doc).map((run) =>
    tokenizeGifRun(run, colors, sample, cache),
  );
  const rules = await assembleGifGrammar(doc, pageUrl, fetcher);
  return parseTokenized(tokenized, rules);
}

/** Parses every Unicode expression on the page (kinds via span class). */
export async function parseUniExpressions(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
): Promise<ParsedExpression[]> {
  const kinds = parseKindNames(doc);
  const tokenized = findMathSpans(doc).map((span) =>
    tokenizeMathSpan(span, kinds),
  );
  const rules = await assembleUniGrammar(doc, pageUrl, fetcher);
  return parseTokenized(tokenized, rules);
}
