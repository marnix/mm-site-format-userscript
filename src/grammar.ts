// Assembles the grammar (set of inference rules) for a page: a built-in $TOP
// rule plus one rule per syntax-hint linked page. See DESIGN.md.

import { extractRefUrls, extractSyntaxHintUrls, type Fetcher } from "./loader";
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
 * Assembles a grammar: `topRule` followed by one rule per syntax-definition
 * page. The syntax-definition pages come from the current page's syntax hints,
 * from each Ref-linked theorem page's syntax hints, and from `cv.html`.
 *
 * Pulling in the Ref pages' syntax hints is a workaround for incomplete syntax
 * hints: every constructor appearing in a proof step is introduced by some cited
 * assertion, whose own syntax hints list it — so the union over the page and its
 * Ref pages covers the whole proof table. `cv` (the setvar→class coercion) is
 * always read because it is needed wherever a setvar appears in a class
 * position, yet is never listed in syntax hints. A failed fetch is skipped
 * rather than fatal.
 */
async function assembleGrammar(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  topRule: InferenceRule,
  extract: RuleExtractor,
): Promise<InferenceRule[]> {
  const parser = new DOMParser();
  const fetchDoc = async (url: string) =>
    parser.parseFromString(await fetcher(url), "text/html");

  const syntaxUrls = new Set(extractSyntaxHintUrls(doc, pageUrl));
  syntaxUrls.add(new URL("cv.html", pageUrl).href);

  // Add the syntax hints of each Ref-linked theorem page (resolving their hrefs
  // against that page's own URL).
  const refPages = await Promise.all(
    extractRefUrls(doc, pageUrl).map(async (url) => {
      try {
        return { url, doc: await fetchDoc(url) };
      } catch {
        return null;
      }
    }),
  );
  for (const page of refPages) {
    if (!page) continue;
    for (const url of extractSyntaxHintUrls(page.doc, page.url))
      syntaxUrls.add(url);
  }

  const rules = await Promise.all(
    [...syntaxUrls].map(async (url) => {
      try {
        return extract(await fetchDoc(url));
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
