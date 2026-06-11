// Hover highlighting via the CSS Custom Highlight API: no DOM mutation (so it
// can't disturb other userscripts), and Ranges can cover text-node substrings
// (e.g. one of a run-together "))" pair). See DESIGN.md "Hover highlighting".

import { HIGHLIGHT_COLOR } from "./config";
import type { ParsedExpression } from "./page";
import type { Proof } from "./proof";
import { nodeSpans, smallestSpanContaining, type Span } from "./spans";
import type { TokenLocation } from "./token";

/** Builds a DOM Range covering the tokens in [start, end) of `locations`. */
export function rangeForSpan(
  locations: TokenLocation[],
  [start, end]: Span,
): Range {
  const range = document.createRange();
  const first = locations[start];
  const last = locations[end - 1];
  if (first.type === "element") range.setStartBefore(first.node);
  else range.setStart(first.node, first.start);
  if (last.type === "element") range.setEndAfter(last.node);
  else range.setEnd(last.node, last.end);
  return range;
}

/**
 * The location-index span to highlight when the token at `index` is hovered:
 * the smallest sub-expression node containing it, or null if none. Proof spans
 * are in the parsed token space; they are shifted into location-index space — a
 * "|-" statement parses the whole token list (base 0), a typecode statement
 * drops its leading typecode (base 1). Pure (no DOM).
 */
export function spanToHighlight(
  proof: Proof,
  locationCount: number,
  index: number,
): Span | null {
  const spans = nodeSpans(proof);
  const rootEnd = Math.max(...spans.map((s) => s[1]));
  const base = locationCount - rootEnd;
  const shifted: Span[] = spans.map(([s, e]) => [s + base, e + base]);
  return smallestSpanContaining(shifted, index) ?? null;
}

/**
 * Index of the token whose location covers the caret position `(node, offset)`,
 * or null. A text token matches a position inside its substring; an element
 * token (e.g. a variable span) matches a position anywhere inside it. Pure.
 */
export function findTokenAt(
  locations: TokenLocation[],
  node: Node,
  offset: number,
): number | null {
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    if (loc.type === "text") {
      if (loc.node === node && offset >= loc.start && offset < loc.end)
        return i;
    } else if (loc.node === node || loc.node.contains(node)) {
      return i;
    }
  }
  return null;
}

const HIGHLIGHT_NAME = "mm-site-format";
const HIGHLIGHT_CLASS = "mm-site-format-hl";

interface HighlightLike {
  add(range: Range): void;
  clear(): void;
}
declare const Highlight: { new (): HighlightLike };
declare const CSS: { highlights?: Map<string, HighlightLike> } | undefined;

/** Paints the active highlight: text via the Highlight API, elements via a
 * background class (the Highlight API does not paint replaced elements like the
 * transparent-background GIF glyphs). */
interface Painter {
  paint(locations: TokenLocation[], span: Span): void;
  clear(): void;
}

/** Creates the shared painter, or null where the Highlight API is unavailable. */
function createPainter(): Painter | null {
  if (
    typeof CSS === "undefined" ||
    !CSS?.highlights ||
    typeof Highlight === "undefined"
  ) {
    return null;
  }
  const highlight = new Highlight();
  CSS.highlights.set(HIGHLIGHT_NAME, highlight);
  const style = document.createElement("style");
  style.textContent =
    `::highlight(${HIGHLIGHT_NAME}){background-color:${HIGHLIGHT_COLOR}}` +
    `.${HIGHLIGHT_CLASS}{background-color:${HIGHLIGHT_COLOR}}`;
  document.head.appendChild(style);

  let painted: Element[] = [];
  const clear = () => {
    highlight.clear();
    for (const el of painted) el.classList.remove(HIGHLIGHT_CLASS);
    painted = [];
  };
  return {
    clear,
    paint(locations, [start, end]) {
      clear();
      highlight.add(rangeForSpan(locations, [start, end]));
      for (let i = start; i < end; i++) {
        const loc = locations[i];
        if (loc.type === "element") {
          loc.node.classList.add(HIGHLIGHT_CLASS);
          painted.push(loc.node);
        }
      }
    },
  };
}

/**
 * GIF pages: every token is an element (img / variable span), so attach
 * mouseenter/mouseleave to each and highlight the smallest containing
 * sub-expression. Browser only; a no-op where the Highlight API is unavailable.
 */
export function installHoverByElement(expressions: ParsedExpression[]): void {
  const painter = createPainter();
  if (!painter) return;
  for (const expr of expressions) {
    const proof = expr.proof;
    if (!proof) continue;
    expr.locations.forEach((loc, i) => {
      if (loc.type !== "element") return;
      loc.node.addEventListener("mouseenter", () => {
        const span = spanToHighlight(proof, expr.locations.length, i);
        if (span) painter.paint(expr.locations, span);
        else painter.clear();
      });
      loc.node.addEventListener("mouseleave", () => painter.clear());
    });
  }
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as unknown as {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const c = d.caretPositionFromPoint(x, y);
    return c ? { node: c.offsetNode, offset: c.offset } : null;
  }
  if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

/**
 * Unicode pages: many tokens are bare text (operators, parentheses) with no
 * element to listen on, so hit-test the caret position under the pointer on
 * mousemove over each expression's container. Browser only.
 */
export function installHoverByCaret(expressions: ParsedExpression[]): void {
  const painter = createPainter();
  if (!painter) return;
  for (const expr of expressions) {
    const proof = expr.proof;
    const container = expr.locations[0]?.node.parentElement;
    if (!proof || !container) continue;
    container.addEventListener("mousemove", (event) => {
      const caret = caretAt(event.clientX, event.clientY);
      const i = caret
        ? findTokenAt(expr.locations, caret.node, caret.offset)
        : null;
      const span =
        i === null ? null : spanToHighlight(proof, expr.locations.length, i);
      if (span) painter.paint(expr.locations, span);
      else painter.clear();
    });
    container.addEventListener("mouseleave", () => painter.clear());
  }
}
