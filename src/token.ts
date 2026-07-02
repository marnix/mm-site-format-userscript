// Splits an MM expression into a flat token stream: literal "constant" tokens
// (operators, parentheses, turnstile) and typed "variable" tokens carrying
// their kind (wff / setvar / class). One tokenizer per rendering mode, mirroring
// the find/extract pairs in expression.ts.
//
// Each token also has a DOM location (where it was rendered), captured in the
// same walk so the two stay aligned. Locations drive hover highlighting; the
// Token type itself is unchanged.

import {
  parseCssColor,
  rgbKey,
  variableKindOfImg,
  type ImageSampler,
  type KindColors,
  type VariableKind,
} from "./kind";

export type Token =
  | { kind: null; text: string } // constant: operator, parenthesis, turnstile
  | { kind: VariableKind; text: string }; // typed variable

/** A chunk for the chunk-based parser: same shape as Token. */
export type Chunk = Token;

/** Where a token was rendered, enough to build a DOM Range for highlighting. */
export type TokenLocation =
  | { type: "element"; node: Element } // whole element (img / variable span)
  | { type: "text"; node: Text; start: number; end: number } // text substring
  // a token folded with a subscript: from char `offset` in `node` through the
  // subscript element `sub` (e.g. the `~` text char and the `<sub>R</sub>` of `~R`)
  | { type: "folded"; node: Text; offset: number; sub: Element };

export interface LocatedToken {
  token: Token;
  location: TokenLocation;
}

/**
 * Splits text into individual MM constant tokens with their char offsets.
 * Besides whitespace, parentheses are separated, because the Unicode rendering
 * runs adjacent constants together by omitting whitespace (e.g. ") )" -> "))").
 */
function* splitConstants(
  text: string,
): Iterable<{ text: string; start: number; end: number }> {
  const re = /[(){}]|[^(){}\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    yield { text: m[0], start: m.index, end: m.index + m[0].length };
  }
}

/**
 * Splits a run of concatenated constants by longest-match against the known
 * constant vocabulary (the tokens the grammar defines). The Unicode rendering
 * runs adjacent constants together with no delimiter (e.g. `([\u27e8`), so plain
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

/** Inline presentational tags that may wrap a constant token mid-expression
 *  (e.g. `<B>&middot;</B>` in mpeuni `\u00B7` scalar-mult operator). Their text
 *  content is absorbed into the current run so subscript folding still works.
 *  SUB is included: its text is folded with `sub` tagging for location tracking. */
const INLINE_FORMATTING_TAGS = new Set([
  "B",
  "SMALL",
  "I",
  "EM",
  "STRONG",
  "TT",
  "FONT",
  "SUB",
]);

// A character of a constant run, tagged with its source text-node position.
// Folded subscript characters reuse the position of the character they follow
// and carry the subscript element they came from, so a folded token (e.g. `~R`)
// is located from its base character through that subscript element.
type RunChar = { ch: string; node: Text; offset: number; sub?: Element };

/** The location spanning a token's run characters [start, end): a plain text
 *  substring, or -- if any character was folded from a subscript -- a span from
 *  the base character through the (last) subscript element. */
function runLocation(
  run: RunChar[],
  start: number,
  end: number,
): TokenLocation {
  const a = run[start];
  let sub: Element | undefined;
  for (let k = start; k < end; k++) sub = run[k].sub ?? sub;
  if (sub) return { type: "folded", node: a.node, offset: a.offset, sub };
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
  colors?: KindColors,
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
      } else if (cls === "symvar" && colors) {
        // `symvar` is set.mm's rendering variant for dot-prefixed "operator as
        // variable" tokens (e.g. .||. renders as \u2225 with a dotted underline).
        // It is always class-typed; the kind is not the CSS class name but the
        // inline color, which matches the `class` entry in the colors legend.
        const style = el.getAttribute("style") ?? "";
        const m = style.match(/color\s*:\s*([^;]+)/i);
        const rgb = m ? parseCssColor(m[1]) : null;
        const kind = rgb ? (colors.get(rgbKey(rgb)) ?? null) : null;
        if (kind) {
          flush();
          const text = el.textContent?.trim() ?? "";
          if (text)
            out.push({
              token: { kind, text },
              location: { type: "element", node: el },
            });
        }
      } else if (INLINE_FORMATTING_TAGS.has(el.tagName) && run.length > 0) {
        // Inline formatting or subscript: absorb text into the current run.
        // Subscript characters are tagged with `sub: el` so the token location
        // spans from the base character through the subscript element.
        // Push per UTF-16 code unit (not per code point), so run indices stay
        // aligned with the joined run text's offsets.
        const base = run[run.length - 1];
        const isSub = isSubscript(el);
        const chars = el.textContent ?? "";
        for (let k = 0; k < chars.length; k++)
          run.push({
            ch: chars[k],
            node: base.node,
            offset: base.offset,
            ...(isSub && { sub: el }),
          });
      } else if (INLINE_FORMATTING_TAGS.has(el.tagName)) {
        // Same tags but at the START of a run (run.length === 0): no base to
        // inherit position from, so use the element itself as position anchor.
        const chars = el.textContent ?? "";
        for (let k = 0; k < chars.length; k++)
          run.push({ ch: chars[k], node: node as unknown as Text, offset: k });
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
  colors?: KindColors,
): Token[] {
  return locateMathSpan(span, kinds, vocab, colors).map((lt) => lt.token);
}

/**
 * Produces raw chunks from a Unicode <span class=math> for the chunk-based
 * parser. Variable spans become typed chunks; all constant text (including
 * concatenated parens/operators) becomes a single text chunk per run. No
 * splitting of text runs is performed -- the chunk parser handles tokenization
 * boundaries directly.
 */
export function chunkifyMathSpan(
  span: Element,
  kinds: Set<string>,
  colors?: KindColors,
): { chunks: Chunk[]; locations: TokenLocation[] } {
  // Walk the DOM directly (like locateMathSpan) but collect raw text content
  // (preserving whitespace) into text chunks. Variable spans flush the current
  // text accumulator and emit a variable chunk.
  const chunks: Chunk[] = [];
  const locations: TokenLocation[] = [];
  let textAccum = "";
  let firstLoc: TokenLocation | null = null;

  const flushText = () => {
    if (textAccum) {
      chunks.push({ kind: null, text: textAccum });
      locations.push(firstLoc!);
      textAccum = "";
      firstLoc = null;
    }
  };

  const addText = (text: string, loc: TokenLocation) => {
    if (!text) return;
    if (!firstLoc) firstLoc = loc;
    textAccum += text;
  };

  for (const node of span.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const cls = (el.getAttribute("class") ?? "").trim();
      if (kinds.has(cls)) {
        flushText();
        const text = el.textContent?.trim() ?? "";
        if (text) {
          chunks.push({ kind: cls, text });
          locations.push({ type: "element", node: el });
        }
      } else if (cls === "symvar" && colors) {
        const style = el.getAttribute("style") ?? "";
        const m = style.match(/color\s*:\s*([^;]+)/i);
        const rgb = m ? parseCssColor(m[1]) : null;
        const kind = rgb ? (colors.get(rgbKey(rgb)) ?? null) : null;
        if (kind) {
          flushText();
          const text = el.textContent?.trim() ?? "";
          if (text) {
            chunks.push({ kind, text });
            locations.push({ type: "element", node: el });
          }
        }
      } else if (INLINE_FORMATTING_TAGS.has(el.tagName)) {
        // Inline formatting (including SUB): absorb text content into the run.
        const text = el.textContent ?? "";
        addText(text, { type: "element", node: el });
      } else {
        // Non-kind element (turnstile, typecode): absorb its text content.
        const text = el.textContent ?? "";
        addText(text, { type: "element", node: el });
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const tn = node as Text;
      const value = tn.nodeValue ?? "";
      if (value)
        addText(value, { type: "text", node: tn, start: 0, end: value.length });
    }
  }
  flushText();
  return { chunks, locations };
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
