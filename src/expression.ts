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
