// Builds tooltip content for inference rule refs: clones conclusion/hypothesis
// spans from linked theorem pages and attaches tooltips to the page-wide
// `<a href>…</a>&nbsp;<span class="r">…</span>` ref pattern.

import { attachTooltip } from "./tooltip";

/**
 * Builds tooltip content from a fetched theorem page by cloning its
 * `span.math` expression cells. Returns null if the page has no Assertion table
 * (e.g. it is not a proof page or failed to parse).
 */
export function buildRuleContent(doc: Document): Node | null {
  const conclusionSpan = doc.querySelector(
    'table[summary="Assertion"] span.math',
  );
  if (!conclusionSpan) return null;

  const hypSpans = [
    ...doc.querySelectorAll('table[summary^="Hypothes"] span.math'),
  ];

  const container = document.createElement("span");
  container.appendChild(conclusionSpan.cloneNode(true));

  if (hypSpans.length > 0) {
    hypSpans.forEach((hyp, i) => {
      container.append(document.createElement("br"), i === 0 ? " ⇐  " : " &  ");
      container.appendChild(hyp.cloneNode(true));
    });
  }

  return container;
}

/**
 * Attaches rule tooltips to every `<a href>…</a>&nbsp;<span class="r">…</span>`
 * pattern found in `root`. Covers the proof table's Ref column and any other
 * cross-reference links on the page that follow that pattern.
 */
export function attachRuleTooltipsToPage(
  root: ParentNode,
  fetchRuleTooltip: (href: string) => Promise<Node | null>,
): void {
  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = a.getAttribute("href")!;
    if (href.startsWith("#")) continue;
    const next = a.nextSibling;
    if (
      next?.nodeType === Node.TEXT_NODE &&
      next.textContent === " " &&
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
