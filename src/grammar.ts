// Assembles the grammar (set of inference rules) for a page: a built-in $TOP
// rule plus one rule per syntax-hint linked page.

import { createCache, type Cache } from "./cache";
import { extractRefUrls, extractSyntaxHintUrls, type Fetcher } from "./loader";
import type { InferenceRule, Proof } from "./proof";
import { gifAssertionRule, uniAssertionRule } from "./rule";

/** Bump when the cached extraction format (grammar rules / URL lists) changes,
 *  so stale entries from an older build are ignored. */
export const GRAMMAR_CACHE_VERSION = "1";

// Parsing an assertion (which begins with "|-") means proving it at the
// synthetic target type `$TOP`: the one built-in rule "wff chi" ==> "$TOP |- chi"
// turns "prove this statement" into "parse a wff after the turnstile". `$TOP`
// (like any `$…`) is never a valid MM token, so it cannot clash with a real one.

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
 * The set of constant token strings the grammar uses: every conclusion-pattern
 * token that is neither a type code (a result/assumption type) nor a variable
 * (a single-typing assumption's variable). Used to split runs of concatenated
 * constants in dense Unicode expressions.
 */
export function collectConstants(rules: InferenceRule[]): Set<string> {
  const types = new Set<string>();
  const variables = new Set<string>();
  for (const rule of rules) {
    types.add(rule.conclusion[0]);
    for (const a of rule.assumptions) {
      types.add(a[0]);
      if (a.length === 2) variables.add(a[1]);
    }
  }
  const constants = new Set<string>();
  for (const rule of rules) {
    for (const token of rule.conclusion.slice(1)) {
      if (!types.has(token) && !variables.has(token)) constants.add(token);
    }
  }
  return constants;
}

/**
 * Assembles a grammar: `topRule` followed by one rule per syntax-definition
 * page. The syntax-definition pages come from the current page's syntax hints,
 * from each Ref-linked theorem page's syntax hints, and from `cv.html`.
 *
 * Pulling in the Ref pages' syntax hints is a workaround for incomplete syntax
 * hints: every constructor appearing in a proof step is introduced by some cited
 * assertion, whose own syntax hints list it — so the union over the page and its
 * Ref pages covers the whole proof table. A residual gap remains for displayed
 * expressions that are *not* proof steps — e.g. a definitional cross-reference
 * like `( Disj R <-> … )` on disjrel, whose `<->` is hinted by neither the page
 * nor any Ref page; such an expression just fails to parse and is left alone.
 * Closing it fully would need transitive syntax loading (see TODO).
 * `cv` (the setvar→class coercion) is
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
  kind: string, // "uni" / "gif": rules differ by mode, so they key separately
  cache: Cache,
): Promise<InferenceRule[]> {
  const parser = new DOMParser();
  const fetchDoc = async (url: string) =>
    parser.parseFromString(await fetcher(url), "text/html");

  const syntaxUrls = new Set(extractSyntaxHintUrls(doc, pageUrl));
  syntaxUrls.add(new URL("cv.html", pageUrl).href);

  // Add the syntax hints of each Ref-linked theorem page (resolving their hrefs
  // against that page's own URL). Cache the extracted URL list per Ref page.
  const refHints = await Promise.all(
    extractRefUrls(doc, pageUrl).map((url) =>
      cache
        .get(`hints:${url}`, async () =>
          extractSyntaxHintUrls(await fetchDoc(url), url),
        )
        .catch(() => [] as string[]),
    ),
  );
  for (const urls of refHints) for (const url of urls) syntaxUrls.add(url);

  // One rule per syntax-definition page, cached per kind+URL. Each rule is
  // labelled with its page (e.g. `wcel`), so a parse tree records which
  // constructors it used (see `missingSyntaxHints`).
  const rules = await Promise.all(
    [...syntaxUrls].map((url) =>
      cache
        .get<InferenceRule | null>(`rule:${kind}:${url}`, async () => {
          const rule = extract(await fetchDoc(url));
          if (rule) rule.label = labelOf(url);
          return rule;
        })
        .catch(() => null),
    ),
  );
  return [topRule, ...rules.filter((r): r is InferenceRule => r !== null)];
}

/** The syntax-definition label of a page URL, e.g. `…/wcel.html` → `wcel`. */
const labelOf = (url: string): string =>
  (url.split("/").pop() ?? "").replace(/\.html$/, "");

/** Collects the labels of every grammar rule a proof tree uses. */
function usedLabels(proof: Proof, into: Set<string>): void {
  if (proof.rule.label) into.add(proof.rule.label);
  for (const sub of proof.subproofs) usedLabels(sub, into);
}

/**
 * The syntax-definition labels used by `proofs` (the page's parsed expressions)
 * that are not in `declared` (the page's own "Syntax hints"), sorted — i.e. the
 * constructors the page displays but failed to list. `cv` is excluded: it is
 * categorically omitted upstream and always loaded regardless. Pure (no DOM).
 *
 * Used to warn about incomplete syntax hints (a metamath site-generation bug;
 * see TODO) — e.g. `wcel`/`wceq` for setvar membership/equality like `x ∈ y`.
 */
export function missingSyntaxHints(
  proofs: Proof[],
  declared: Set<string>,
): string[] {
  const used = new Set<string>();
  for (const proof of proofs) usedLabels(proof, used);
  return [...used].filter((l) => l !== "cv" && !declared.has(l)).sort();
}

// The default is a memo-only cache (no persistent store): it coalesces repeated
// work within one assembly and is exercised by every caller/test, while a fresh
// instance per call keeps callers independent. Pass a store-backed cache (see
// `createCache`) to also reuse results across page loads.
const memoOnly = () => createCache(null, GRAMMAR_CACHE_VERSION);

export const assembleGifGrammar = (
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  cache: Cache = memoOnly(),
): Promise<InferenceRule[]> =>
  assembleGrammar(
    doc,
    pageUrl,
    fetcher,
    GIF_TOP_RULE,
    gifAssertionRule,
    "gif",
    cache,
  );

export const assembleUniGrammar = (
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  cache: Cache = memoOnly(),
): Promise<InferenceRule[]> =>
  assembleGrammar(
    doc,
    pageUrl,
    fetcher,
    UNI_TOP_RULE,
    uniAssertionRule,
    "uni",
    cache,
  );
