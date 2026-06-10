// Assembles the grammar (set of inference rules) for a page: the built-in $TOP
// rule plus one rule per syntax-hint linked page. See DESIGN.md.

import { extractSyntaxHintUrls, type Fetcher } from "./loader";
import type { InferenceRule } from "./proof";
import { gifAssertionRule } from "./rule";

/** The single built-in rule: "wff chi" ==> "$TOP |- chi". */
export const TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "|-", "chi"],
};

/**
 * Assembles the grammar for a GIF page: the built-in $TOP rule followed by one
 * rule per syntax-hint linked page (its Assertion, via gifAssertionRule). One
 * level deep — the syntax-hint pages are not themselves recursed into.
 */
export async function assembleGifGrammar(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
): Promise<InferenceRule[]> {
  const parser = new DOMParser();
  const urls = extractSyntaxHintUrls(doc, pageUrl);
  const rules = await Promise.all(
    urls.map(async (url) => {
      const linked = parser.parseFromString(await fetcher(url), "text/html");
      return gifAssertionRule(linked);
    }),
  );
  return [TOP_RULE, ...rules.filter((r): r is InferenceRule => r !== null)];
}
