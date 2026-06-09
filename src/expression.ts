/**
 * Finds all MM expressions in a gif-based page (mpegif variant).
 * An expression is any run of ≥3 consecutive img[alt] siblings (whitespace-only
 * text nodes between them are ignored). Alt values are joined and whitespace-
 * normalised to produce a clean space-separated token string.
 */
export function extractGifExpressions(doc: Document): string[] {
  const results: string[] = [];

  function flush(run: string[]): void {
    if (run.length < 3) return;
    const text = run.join("").split(/\s+/).filter(Boolean).join(" ");
    if (text) results.push(text);
  }

  function scan(parent: Node): void {
    let run: string[] = [];
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName === "IMG" && el.hasAttribute("alt")) {
          run.push(el.getAttribute("alt")!);
        } else {
          flush(run);
          run = [];
          scan(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
        flush(run);
        run = [];
      }
    }
    flush(run);
  }

  if (doc.body) scan(doc.body);
  return results;
}

/**
 * Converts a <span class=math> element to a space-separated token string.
 * Each direct child (text node or element) contributes its text; tokens are
 * split on whitespace so adjacent children are separated by exactly one space.
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
