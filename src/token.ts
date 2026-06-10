// Splits an MM expression into a flat token stream: literal "constant" tokens
// (operators, parentheses, turnstile) and typed "variable" tokens carrying
// their kind (wff / setvar / class). One tokenizer per rendering mode, mirroring
// the find/extract pairs in expression.ts.

import {
  variableKindOfImg,
  type ImageSampler,
  type KindColors,
  type VariableKind,
} from "./kind";

export type Token =
  | { kind: null; text: string } // constant: operator, parenthesis, turnstile
  | { kind: VariableKind; text: string }; // typed variable

function pushWords(text: string, out: Token[]): void {
  for (const word of text.split(/\s+/)) {
    if (word) out.push({ kind: null, text: word });
  }
}

/**
 * Tokenizes a Unicode <span class=math>. A child element whose class is a known
 * kind (e.g. wff) is one typed variable; all other text becomes constant tokens
 * split on whitespace.
 */
export function tokenizeMathSpan(span: Element, kinds: Set<string>): Token[] {
  const tokens: Token[] = [];
  for (const node of span.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const cls = (el.getAttribute("class") ?? "").trim();
      if (kinds.has(cls)) {
        const text = el.textContent?.trim() ?? "";
        if (text) tokens.push({ kind: cls, text });
      } else {
        pushWords(el.textContent ?? "", tokens);
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      pushWords(node.nodeValue ?? "", tokens);
    }
  }
  return tokens;
}

/**
 * Tokenizes a GIF run (img[alt] elements and text nodes, from findGifRuns).
 * Each <img> is one token — a typed variable if its colour matches a variable
 * kind, otherwise a constant; each text node splits into constant words (e.g.
 * defined class-constants like "Disjs"). Colour lookups are memoised per image
 * SRC via the (page-scoped) cache.
 */
export function tokenizeGifRun(
  nodes: Node[],
  colors: KindColors,
  sample: ImageSampler,
  cache: Map<string, VariableKind | null> = new Map(),
): Token[] {
  const tokens: Token[] = [];
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushWords(node.nodeValue ?? "", tokens);
      continue;
    }
    const img = node as Element;
    const text = (img.getAttribute("alt") ?? "").trim();
    const src = img.getAttribute("src") ?? "";
    let kind = cache.get(src);
    if (kind === undefined) {
      kind = variableKindOfImg(img, colors, sample);
      cache.set(src, kind);
    }
    tokens.push(kind === null ? { kind: null, text } : { kind, text });
  }
  return tokens;
}

/** Renders tokens for display, annotating each typed variable as `text:kind`. */
export function formatTokens(tokens: Token[]): string {
  return tokens.map((t) => (t.kind ? `${t.text}:${t.kind}` : t.text)).join(" ");
}
