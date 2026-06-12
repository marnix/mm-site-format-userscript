// Each rendering mode of a metamath page provides two functions: a `find*`
// that locates the HTML for every expression on the page, and an `extract*`
// that turns one such piece of HTML into a space-separated MM token string.
// Both modes are run on every page; on a given page only one finds anything.

/** mpeuni mode: every expression is wrapped in a <span class=math>. */
export function findMathSpans(root: ParentNode): Element[] {
  return [...root.querySelectorAll("span.math")];
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
 * mpegif mode: an expression is any run of ≥2 consecutive img[alt] siblings
 * Some tokens are plain text rather than images (e.g. defined class-constants
 * like "Disjs", or the "class" typecode on a definition page), so a run is a
 * maximal stretch of img[alt] elements *and* non-whitespace text nodes,
 * uninterrupted by any other element. A run is an expression when it has at
 * least one image and at least two tokens (images + text words) — that keeps
 * the smallest real expressions ("wff ph", "class Rels") while rejecting prose
 * (no images) and isolated syntax-hint symbols (one token).
 *
 * `root` may be the whole document or any element (e.g. one Assertion table).
 */
export function findGifRuns(root: Node): Node[][] {
  const runs: Node[][] = [];

  function scan(parent: Node): void {
    let run: Node[] = [];
    let images = 0;
    let tokens = 0;
    const flush = () => {
      if (images >= 1 && tokens >= 2) runs.push(run);
      run = [];
      images = 0;
      tokens = 0;
    };
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName === "IMG" && el.hasAttribute("alt")) {
          run.push(el);
          images++;
          tokens++;
        } else {
          flush();
          scan(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const words = (node.nodeValue ?? "").split(/\s+/).filter(Boolean);
        if (words.length) {
          run.push(node);
          tokens += words.length;
        }
      }
    }
    flush();
  }

  scan(root);
  return runs;
}

/** The MM token text of one run node: an img's alt, or a text node's words. */
function gifNodeText(node: Node): string {
  return node.nodeType === Node.TEXT_NODE
    ? (node.nodeValue ?? "")
    : ((node as Element).getAttribute("alt") ?? "");
}

/**
 * Extracts the MM expression from one run by joining its nodes' text (img alt
 * attributes and literal text) and normalising whitespace to single spaces.
 */
export function extractGifText(nodes: Node[]): string {
  return nodes
    .map(gifNodeText)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
