// Wires the pieces together for a page: tokenise every expression, assemble the
// grammar from the syntax-hint pages, build the kind registry, and parse each
// expression into a proof (= parse tree). Pure logic, independent of the
// browser — index.ts supplies the real fetch + canvas sampler.

import {
  assembleGifGrammar,
  assembleUniGrammar,
  collectConstants,
} from "./grammar";
import { findGifRuns, findMathSpans } from "./expression";
import { parseKindColors, parseKindNames, type ImageSampler } from "./kind";
import type { Fetcher } from "./loader";
import { parseExpression, type KindOf } from "./parse";
import type { InferenceRule, Proof } from "./proof";
import {
  locateGifRun,
  locateMathSpan,
  type LocatedToken,
  type Token,
  type TokenLocation,
} from "./token";

export interface ParsedExpression {
  tokens: Token[];
  locations: TokenLocation[]; // parallel to tokens; where each was rendered
  proof: Proof | null; // null when the expression does not parse
}

/**
 * Builds the kind registry and parses each located expression. The registry is
 * the union of the page's own variable kinds and the grammar rules' variable
 * typings. A statement beginning with the turnstile (the $TOP rule's first
 * pattern token) is parsed at the synthetic $TOP type; any other expression
 * starts with its own typecode.
 */
function parseLocated(
  located: LocatedToken[][],
  rules: InferenceRule[],
): ParsedExpression[] {
  const registry = new Map<string, string>();
  for (const lts of located) {
    for (const { token } of lts)
      if (token.kind) registry.set(token.text, token.kind);
  }
  for (const rule of rules) {
    for (const a of rule.assumptions) {
      if (a.length === 2) registry.set(a[1], a[0]);
    }
  }
  const kindOf: KindOf = (token) => registry.get(token);
  const turnstile = rules[0]?.conclusion[1];

  return located.map((lts) => {
    const tokens = lts.map((lt) => lt.token);
    const locations = lts.map((lt) => lt.location);
    const expr = tokens.map((t) => t.text);
    const proof =
      expr[0] === turnstile
        ? parseExpression(expr, "$TOP", rules, kindOf)
        : parseExpression(expr.slice(1), expr[0] ?? "", rules, kindOf);
    return { tokens, locations, proof };
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
  const located = findGifRuns(doc).map((run) =>
    locateGifRun(run, colors, sample, cache),
  );
  const rules = await assembleGifGrammar(doc, pageUrl, fetcher);
  return parseLocated(located, rules);
}

/** Parses every Unicode expression on the page (kinds via span class). */
export async function parseUniExpressions(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
): Promise<ParsedExpression[]> {
  const kinds = parseKindNames(doc);
  const rules = await assembleUniGrammar(doc, pageUrl, fetcher);
  // Split dense runs of concatenated constants against the grammar's tokens.
  const constants = collectConstants(rules);
  const located = findMathSpans(doc).map((span) =>
    locateMathSpan(span, kinds, constants),
  );
  return parseLocated(located, rules);
}
