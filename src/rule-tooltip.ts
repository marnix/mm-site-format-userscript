// Builds tooltip content for inference rule refs: clones conclusion/hypothesis
// spans from linked theorem pages and attaches tooltips to the page-wide
// `<a href>...</a>&nbsp;<span class="r">...</span>` ref pattern.

import { findGifRuns } from "./expression";
import { attachTooltip } from "./tooltip";

// Operator separators: leading space (small indent after <br>) and NBSP*2
// after (non-collapsing extra space before the next expression).
const OP_IMPLIES = " \u21d0\u00a0\u00a0"; // " <==  " with NBSP (\u00a0)
const OP_AND = " &\u00a0\u00a0"; //          " &  " with NBSP (\u00a0)

/**
 * Builds tooltip content from a fetched theorem page by cloning its expression
 * nodes. Handles both Unicode pages (span.math) and GIF pages (img[alt] runs).
 * Returns null if the page has no Assertion table.
 */
export function buildRuleContent(doc: Document): Node | null {
  const conclusionSpan = doc.querySelector(
    'table[summary="Assertion"] span.math',
  );

  if (conclusionSpan) {
    const hypSpans = [
      ...doc.querySelectorAll('table[summary^="Hypothes"] span.math'),
    ];
    const container = document.createElement("span");
    container.appendChild(conclusionSpan.cloneNode(true));
    hypSpans.forEach((hyp, i) => {
      container.append(
        document.createElement("br"),
        i === 0 ? OP_IMPLIES : OP_AND,
      );
      container.appendChild(hyp.cloneNode(true));
    });
    return container;
  }

  // GIF page: expressions are img[alt] runs.
  const assertionTable = doc.querySelector('table[summary="Assertion"]');
  if (!assertionTable) return null;
  const [conclusionRun] = findGifRuns(assertionTable);
  if (!conclusionRun) return null;

  const hypTable = doc.querySelector('table[summary^="Hypothes"]');
  const hypRuns = hypTable ? findGifRuns(hypTable) : [];

  const container = document.createElement("span");
  for (const node of conclusionRun) container.appendChild(node.cloneNode(true));
  hypRuns.forEach((run, i) => {
    container.append(
      document.createElement("br"),
      i === 0 ? OP_IMPLIES : OP_AND,
    );
    for (const node of run) container.appendChild(node.cloneNode(true));
  });
  return container;
}

/**
 * Attaches rule tooltips to every `<a href>...</a>&nbsp;<span class="r">...</span>`
 * pattern found in `root`. Covers the proof table's Ref column and the
 * "Referenced by:" section (where a newline precedes the &nbsp;).
 */
export function attachRuleTooltipsToPage(
  root: ParentNode,
  fetchRuleTooltip: (href: string) => Promise<Node | null>,
): void {
  // Regex: optional whitespace, then exactly one NBSP, then optional whitespace.
  // trim() cannot be used because it removes NBSP in ES2015+ engines.
  const nbspOnly = /^\s*\u00a0\s*$/;
  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = a.getAttribute("href")!;
    if (href.startsWith("#")) continue;
    const next = a.nextSibling;
    if (
      next?.nodeType === Node.TEXT_NODE &&
      nbspOnly.test(next.textContent ?? "") &&
      (next.nextSibling as Element | null)?.classList?.contains("r")
    ) {
      attachTooltip(a, () => fetchRuleTooltip(href));
    }
  }
}

/**
 * Returns a function that fetches a theorem page by its href (resolved against
 * `pageUrl`) and returns a tooltip Node built from its expression cells.
 * Results are cached per resolved URL so each page is fetched at most once.
 */
export function makeRuleTooltipFetcher(
  pageUrl: string,
  fetcher: (url: string) => Promise<string>,
): (href: string) => Promise<Node | null> {
  const cache = new Map<string, Promise<Node | null>>();
  const parser = new DOMParser();

  return function fetchRuleTooltip(href: string): Promise<Node | null> {
    const url = new URL(href, pageUrl).href;
    let pending = cache.get(url);
    if (!pending) {
      pending = fetcher(url)
        .then((html) =>
          buildRuleContent(parser.parseFromString(html, "text/html")),
        )
        .catch(() => null);
      cache.set(url, pending);
    }
    return pending;
  };
}
