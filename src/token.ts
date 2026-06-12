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

/**
 * Splits a run of concatenated constants by longest-match against the known
 * constant vocabulary (the tokens the grammar defines). The Unicode rendering
 * runs adjacent constants together with no delimiter (e.g. `([⟨`), so plain
 * whitespace/paren splitting cannot recover the token boundaries; matching
 * against the vocabulary can. Whitespace separates tokens; an unrecognised
 * character is emitted on its own (the expression will then fail to parse).
 */
function* munchConstants(
  text: string,
  vocab: Set<string>,
  maxLen: number,
): Iterable<{ text: string; start: number; end: number }> {
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    let len = 0;
    for (let l = Math.min(maxLen, text.length - i); l >= 1; l--) {
      if (vocab.has(text.slice(i, i + l))) {
        len = l;
        break;
      }
    }
    if (len === 0) len = 1; // unrecognised: emit one char, let the parse fail
    yield { text: text.slice(i, i + len), start: i, end: i + len };
    i += len;
  }
}

/** A subscript element (e.g. the `R` in `~R`, `0R`): part of the preceding
 *  token, rendered as `<i><sub><b>R</b></sub></i>` or similar. */
function isSubscript(el: Element): boolean {
  return el.tagName === "SUB" || el.querySelector("sub") !== null;
}

// A character of a constant run, tagged with its source text-node position.
// Folded subscript characters reuse the position of the character they follow,
// so a folded token (e.g. `~R`) is located at its base character (the `~`).
type RunChar = { ch: string; node: Text; offset: number };

/** The text location spanning a token's run characters [start, end). */
function runLocation(
  run: RunChar[],
  start: number,
  end: number,
): TokenLocation {
  const a = run[start];
  const b = run[end - 1];
  const endOffset = b.node === a.node ? b.offset + 1 : a.offset + 1;
  return { type: "text", node: a.node, start: a.offset, end: endOffset };
}

/**
 * Tokenizes a Unicode <span class=math> into located tokens. Variables are their
 * own kind-classed spans; subscript elements are folded into the preceding
 * token. When `vocab` is given, runs of concatenated constants are split by
 * longest-match against it (needed for dense expressions); otherwise constants
 * are split on whitespace/parens only (enough for syntax-definition pages).
 */
export function locateMathSpan(
  span: Element,
  kinds: Set<string>,
  vocab?: Set<string>,
): LocatedToken[] {
  const out: LocatedToken[] = [];
  const maxLen = vocab ? Math.max(1, ...[...vocab].map((c) => c.length)) : 1;

  let run: RunChar[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const text = run.map((c) => c.ch).join("");
    const tokens = vocab
      ? munchConstants(text, vocab, maxLen)
      : splitConstants(text);
    for (const { text: t, start, end } of tokens) {
      out.push({
        token: { kind: null, text: t },
        location: runLocation(run, start, end),
      });
    }
    run = [];
  };

  for (const node of span.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const cls = (el.getAttribute("class") ?? "").trim();
      if (kinds.has(cls)) {
        flush();
        const text = el.textContent?.trim() ?? "";
        if (text)
          out.push({
            token: { kind: cls, text },
            location: { type: "element", node: el },
          });
      } else if (isSubscript(el) && run.length > 0) {
        // Fold the subscript into the preceding token (e.g. `~` + `R` = `~R`),
        // reusing the base character's position so the token stays located there.
        // Push per UTF-16 code unit (not per code point), so run indices stay
        // aligned with the joined run text's offsets — a surrogate-pair subscript
        // (e.g. `𝑟` in `↑𝑟`) would otherwise desync them and the munch's offsets
        // would run off the end of `run`.
        const base = run[run.length - 1];
        const sub = el.textContent ?? "";
        for (let k = 0; k < sub.length; k++)
          run.push({ ch: sub[k], node: base.node, offset: base.offset });
      } else {
        // Non-kind element (turnstile, typecode, or a stray subscript): its text
        // is constant tokens, located at the element itself.
        flush();
        for (const { text } of splitConstants(el.textContent ?? "")) {
          out.push({
            token: { kind: null, text },
            location: { type: "element", node: el },
          });
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const tn = node as Text;
      const value = tn.nodeValue ?? "";
      for (let i = 0; i < value.length; i++) {
        run.push({ ch: value[i], node: tn, offset: i });
      }
    }
  }
  flush();
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
export function tokenizeMathSpan(
  span: Element,
  kinds: Set<string>,
  vocab?: Set<string>,
): Token[] {
  return locateMathSpan(span, kinds, vocab).map((lt) => lt.token);
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
