// Wires the pieces together for a GIF page: tokenise every expression, assemble
// the grammar from the syntax-hint pages, build the kind registry, and parse
// each expression into a proof (= parse tree). Pure logic, independent of the
// browser — index.ts supplies the real fetch + canvas sampler.

import { findGifRuns } from "./expression";
import { parseKindColors, type ImageSampler, type VariableKind } from "./kind";
import { assembleGifGrammar } from "./grammar";
import type { Fetcher } from "./loader";
import { parseExpression, type KindOf } from "./parse";
import type { Proof } from "./proof";
import { tokenizeGifRun, type Token } from "./token";

export interface ParsedExpression {
  tokens: Token[];
  proof: Proof | null; // null when the expression does not parse
}

/**
 * Tokenises and parses every GIF expression on the page. The kind registry is
 * the union of the current page's variable kinds (from colour, via `sample`)
 * and the grammar rules' variable typings (from the fetched syntax pages).
 */
export async function parseGifExpressions(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  sample: ImageSampler,
): Promise<ParsedExpression[]> {
  const colors = parseKindColors(doc);
  const cache = new Map<string, VariableKind | null>();
  const tokenized = findGifRuns(doc).map((run) =>
    tokenizeGifRun(run, colors, sample, cache),
  );

  const rules = await assembleGifGrammar(doc, pageUrl, fetcher);

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

  return tokenized.map((tokens) => {
    const expr = tokens.map((t) => t.text);
    // A "|- …" statement is parsed at the synthetic $TOP type (the $TOP rule
    // consumes the "|-"); any other expression starts with its own typecode.
    const proof =
      expr[0] === "|-"
        ? parseExpression(expr, "$TOP", rules, kindOf)
        : parseExpression(expr.slice(1), expr[0] ?? "", rules, kindOf);
    return { tokens, proof };
  });
}
