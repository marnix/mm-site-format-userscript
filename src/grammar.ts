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
 * page (extracted with `extract`), plus `cv.html`. One level deep — the
 * syntax-hint pages are not themselves recursed into.
 *
 * `cv` (the setvar→class coercion, `class x` from `setvar x`) is always read
 * because it is needed wherever a setvar appears in a class position, yet it is
 * never listed in a page's syntax hints. A failed fetch (e.g. no such page) is
 * skipped rather than fatal.
 */
async function assembleGrammar(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  topRule: InferenceRule,
  extract: RuleExtractor,
): Promise<InferenceRule[]> {
  const parser = new DOMParser();
  const cvUrl = new URL("cv.html", pageUrl).href;
  const urls = [...new Set([...extractSyntaxHintUrls(doc, pageUrl), cvUrl])];
  const rules = await Promise.all(
    urls.map(async (url) => {
      try {
        return extract(parser.parseFromString(await fetcher(url), "text/html"));
      } catch {
        return null;
      }
    }),
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
