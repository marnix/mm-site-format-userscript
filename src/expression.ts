// Each rendering mode of a metamath page provides two functions: a `find*`
// that locates the HTML for every expression on the page, and an `extract*`
// that turns one such piece of HTML into a space-separated MM token string.
// Both modes are run on every page; on a given page only one finds anything.

/** mpeuni mode: every expression is wrapped in a <span class=math>. */
export function findMathSpans(doc: Document): Element[] {
  return [...doc.querySelectorAll("span.math")];
}

/**
 * Extracts the MM expression from one <span class=math>. Each direct child
 * (text node or element) contributes its text; tokens are split on whitespace
 * so adjacent children are separated by exactly one space.
 */
export function extractMathText(span: Element): string {
  const tokens: string[] = [];
  for (const node of span.childNodes) {
    const raw =
      node.nodeType === Node.TEXT_NODE
        ? (node.nodeValue ?? "")
        : ((node as Element).textContent ?? "");
    for (const token of raw.split(/\s+/)) {
      if (token) tokens.push(token);
    }
  }
  return tokens.join(" ");
}

/**
 * mpegif mode: an expression is any run of ≥3 consecutive img[alt] siblings
 * (whitespace-only text nodes between them are ignored). There is no wrapper
 * element, so we scan the whole document and return each run as a group.
 */
export function findGifRuns(doc: Document): Element[][] {
  const runs: Element[][] = [];

  function scan(parent: Node): void {
    let run: Element[] = [];
    const flush = () => {
      if (run.length >= 3) runs.push(run);
      run = [];
    };
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName === "IMG" && el.hasAttribute("alt")) {
          run.push(el);
        } else {
          flush();
          scan(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
        flush();
      }
    }
    flush();
  }

  if (doc.body) scan(doc.body);
  return runs;
}

/**
 * Extracts the MM expression from one run of img elements by joining their
 * alt attributes and normalising whitespace to single spaces.
 */
export function extractGifText(imgs: Element[]): string {
  return imgs
    .map((img) => img.getAttribute("alt") ?? "")
    .join("")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
