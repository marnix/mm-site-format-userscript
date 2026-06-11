// Splits an MM expression into a flat token stream: literal "constant" tokens
// (operators, parentheses, turnstile) and typed "variable" tokens carrying
// their kind (wff / setvar / class). One tokenizer per rendering mode, mirroring
// the find/extract pairs in expression.ts.
//
// Each token also has a DOM location (where it was rendered), captured in the
// same walk so the two stay aligned. Locations drive hover highlighting; the
// Token type itself is unchanged.

import {
  variableKindOfImg,
  type ImageSampler,
  type KindColors,
  type VariableKind,
} from "./kind";

export type Token =
  | { kind: null; text: string } // constant: operator, parenthesis, turnstile
  | { kind: VariableKind; text: string }; // typed variable

/** Where a token was rendered, enough to build a DOM Range for highlighting. */
export type TokenLocation =
  | { type: "element"; node: Element } // whole element (img / variable span)
  | { type: "text"; node: Text; start: number; end: number }; // text substring

export interface LocatedToken {
  token: Token;
  location: TokenLocation;
}

/**
 * Splits text into individual MM constant tokens with their char offsets.
 * Besides whitespace, parentheses are separated, because the Unicode rendering
 * runs adjacent constants together by omitting whitespace (e.g. ") )" → "))").
 */
function* splitConstants(
  text: string,
): Iterable<{ text: string; start: number; end: number }> {
  const re = /[()]|[^()\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    yield { text: m[0], start: m.index, end: m.index + m[0].length };
  }
}

/** Tokenizes a Unicode <span class=math> into located tokens. */
export function locateMathSpan(
  span: Element,
  kinds: Set<string>,
): LocatedToken[] {
  const out: LocatedToken[] = [];
  for (const node of span.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const cls = (el.getAttribute("class") ?? "").trim();
      const location: TokenLocation = { type: "element", node: el };
      if (kinds.has(cls)) {
        const text = el.textContent?.trim() ?? "";
        if (text) out.push({ token: { kind: cls, text }, location });
      } else {
        // Non-kind element (turnstile, typecode): its text is constant tokens,
        // all located at the element itself.
        for (const { text } of splitConstants(el.textContent ?? "")) {
          out.push({ token: { kind: null, text }, location });
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const tn = node as Text;
      for (const { text, start, end } of splitConstants(tn.nodeValue ?? "")) {
        out.push({
          token: { kind: null, text },
          location: { type: "text", node: tn, start, end },
        });
      }
    }
  }
  return out;
}

/** Tokenizes a GIF run (img[alt] elements and text nodes) into located tokens. */
export function locateGifRun(
  nodes: Node[],
  colors: KindColors,
  sample: ImageSampler,
  cache: Map<string, VariableKind | null> = new Map(),
): LocatedToken[] {
  const out: LocatedToken[] = [];
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const tn = node as Text;
      for (const { text, start, end } of splitConstants(tn.nodeValue ?? "")) {
        out.push({
          token: { kind: null, text },
          location: { type: "text", node: tn, start, end },
        });
      }
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
    out.push({
      token: kind === null ? { kind: null, text } : { kind, text },
      location: { type: "element", node: img },
    });
  }
  return out;
}

/** Tokenizes a Unicode <span class=math> (tokens only). */
export function tokenizeMathSpan(span: Element, kinds: Set<string>): Token[] {
  return locateMathSpan(span, kinds).map((lt) => lt.token);
}

/** Tokenizes a GIF run (tokens only). */
export function tokenizeGifRun(
  nodes: Node[],
  colors: KindColors,
  sample: ImageSampler,
  cache: Map<string, VariableKind | null> = new Map(),
): Token[] {
  return locateGifRun(nodes, colors, sample, cache).map((lt) => lt.token);
}

/** Renders tokens for display, annotating each typed variable as `text:kind`. */
export function formatTokens(tokens: Token[]): string {
  return tokens.map((t) => (t.kind ? `${t.text}:${t.kind}` : t.text)).join(" ");
}
