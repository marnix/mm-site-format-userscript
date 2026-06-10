// Assembles the grammar (set of inference rules) for a page: a built-in $TOP
// rule plus one rule per syntax-hint linked page. See DESIGN.md.

import { extractSyntaxHintUrls, type Fetcher } from "./loader";
import type { InferenceRule } from "./proof";
import { gifAssertionRule, uniAssertionRule } from "./rule";

/** Built-in top rule for GIF pages: "wff chi" ==> "$TOP |- chi". */
export const GIF_TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "|-", "chi"],
};

/** Built-in top rule for Unicode pages: "wff chi" ==> "$TOP ⊢ chi". */
export const UNI_TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "⊢", "chi"],
};

type RuleExtractor = (doc: Document) => InferenceRule | null;

/**
 * Assembles a grammar: `topRule` followed by one rule per syntax-hint linked
 * page (extracted with `extract`). One level deep — the syntax-hint pages are
 * not themselves recursed into.
 */
async function assembleGrammar(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  topRule: InferenceRule,
  extract: RuleExtractor,
): Promise<InferenceRule[]> {
  const parser = new DOMParser();
  const urls = extractSyntaxHintUrls(doc, pageUrl);
  const rules = await Promise.all(
    urls.map(async (url) =>
      extract(parser.parseFromString(await fetcher(url), "text/html")),
    ),
  );
  return [topRule, ...rules.filter((r): r is InferenceRule => r !== null)];
}

export const assembleGifGrammar = (
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
): Promise<InferenceRule[]> =>
  assembleGrammar(doc, pageUrl, fetcher, GIF_TOP_RULE, gifAssertionRule);

export const assembleUniGrammar = (
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
): Promise<InferenceRule[]> =>
  assembleGrammar(doc, pageUrl, fetcher, UNI_TOP_RULE, uniAssertionRule);
