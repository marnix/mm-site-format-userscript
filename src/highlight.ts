// Hover highlighting via the CSS Custom Highlight API: no DOM mutation (so it
// can't disturb other userscripts), and Ranges can cover text-node substrings
// (e.g. one of a run-together "))" pair). See DESIGN.md "Hover highlighting".

import { HIGHLIGHT_COLOR, HIGHLIGHT_MATCH_COLOR } from "./config";
import type { ParsedExpression } from "./page";
import type { Proof } from "./proof";
import { SPACE_CLASS } from "./space";
import { nodeLocationSpans, smallestSpanContaining, type Span } from "./spans";
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
  else if (first.type === "folded") range.setStart(first.node, first.offset);
  else range.setStart(first.node, first.start);
  if (last.type === "element") range.setEndAfter(last.node);
  else if (last.type === "folded") range.setEndAfter(last.sub);
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
  return (
    smallestSpanContaining(nodeLocationSpans(proof, locationCount), index) ??
    null
  );
}

/** One occurrence of a sub-expression: which expression, and its span there. */
export interface Occurrence {
  expr: ParsedExpression;
  span: Span;
}

/**
 * Every sub-expression node, across all `expressions`, whose token sequence
 * equals `tokens`. The token sequence determines the parse tree (the grammar is
 * unambiguous), so equal tokens means the same sub-expression; rendered spacing
 * is irrelevant because spacers are not tokens. Includes the hovered occurrence
 * itself — callers filter it out. Pure (no DOM).
 */
export function matchingOccurrences(
  expressions: ParsedExpression[],
  tokens: string[],
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const expr of expressions) {
    if (!expr.proof) continue;
    for (const span of nodeLocationSpans(expr.proof, expr.locations.length)) {
      const seq = expr.tokens.slice(span[0], span[1]);
      if (
        seq.length === tokens.length &&
        seq.every((t, i) => t.text === tokens[i])
      )
        out.push({ expr, span });
    }
  }
  return out;
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
    } else if (loc.type === "folded") {
      // the base character, or anywhere inside the subscript element
      if (loc.node === node && offset >= loc.offset && offset < loc.offset + 1)
        return i;
      if (loc.sub === node || loc.sub.contains(node)) return i;
    } else if (loc.node === node || loc.node.contains(node)) {
      return i;
    }
  }
  return null;
}

const HIGHLIGHT_NAME = "mm-site-format";
const HIGHLIGHT_CLASS = "mm-site-format-hl";
const MATCH_NAME = "mm-site-format-match";
const MATCH_CLASS = "mm-site-format-match-hl";

interface HighlightLike {
  add(range: Range): void;
  clear(): void;
}
declare const Highlight: { new (): HighlightLike };
declare const CSS: { highlights?: Map<string, HighlightLike> } | undefined;

/** A sub-expression to paint: where its tokens are, and which span of them. */
interface PaintItem {
  locations: TokenLocation[];
  span: Span;
}

/** Paints highlights: text via the Highlight API, elements via a background
 * class (the Highlight API does not paint replaced elements like the
 * transparent-background GIF glyphs). One painter owns one named highlight. */
interface Painter {
  paint(items: PaintItem[]): void;
  clear(): void;
}

// One Highlight registration shared per name: the page and the calculation each
// install hover handlers, and registering a second Highlight under the same
// name would unregister (silently break) the first.
const sharedHighlights = new Map<string, HighlightLike>();

/** Creates a painter over the shared highlight of the given name (defaulting to
 *  the primary hover highlight), or null where the Highlight API is
 *  unavailable. */
export function createPainter(
  name: string = HIGHLIGHT_NAME,
  className: string = HIGHLIGHT_CLASS,
  color: string = HIGHLIGHT_COLOR,
): Painter | null {
  if (
    typeof CSS === "undefined" ||
    !CSS?.highlights ||
    typeof Highlight === "undefined"
  ) {
    return null;
  }
  let highlight = sharedHighlights.get(name);
  if (!highlight) {
    highlight = new Highlight();
    CSS.highlights.set(name, highlight);
    sharedHighlights.set(name, highlight);
    const style = document.createElement("style");
    style.textContent =
      `::highlight(${name}){background-color:${color}}` +
      `.${className}{background-color:${color}}`;
    document.head.appendChild(style);
  }

  let painted: Element[] = [];
  const clear = () => {
    highlight.clear();
    for (const el of painted) el.classList.remove(className);
    painted = [];
  };
  const paintOne = ({ locations, span: [start, end] }: PaintItem) => {
    const range = rangeForSpan(locations, [start, end]);
    highlight.add(range);
    for (let i = start; i < end; i++) {
      const loc = locations[i];
      if (loc.type === "element") {
        loc.node.classList.add(className);
        painted.push(loc.node);
      }
    }
    // Spacers are empty, so the Highlight API does not paint them; colour the
    // ones inside the range by hand so the highlight has no gaps.
    const ancestor = range.commonAncestorContainer;
    const root =
      ancestor.nodeType === Node.ELEMENT_NODE
        ? (ancestor as Element)
        : ancestor.parentElement;
    for (const spacer of root?.querySelectorAll(`.${SPACE_CLASS}`) ?? []) {
      if (range.intersectsNode(spacer)) {
        spacer.classList.add(className);
        painted.push(spacer);
      }
    }
  };
  return {
    clear,
    paint(items) {
      clear();
      for (const item of items) paintOne(item);
    },
  };
}

/** Coordinates the two highlights: the hovered sub-expression in the bright
 * colour, plus its other occurrences across the same expressions in a lighter
 * shade. Null where the Highlight API is unavailable. */
export interface Highlighter {
  highlight(all: ParsedExpression[], expr: ParsedExpression, span: Span): void;
  clear(): void;
}

export function createHighlighter(): Highlighter | null {
  const primary = createPainter();
  const secondary = createPainter(
    MATCH_NAME,
    MATCH_CLASS,
    HIGHLIGHT_MATCH_COLOR,
  );
  if (!primary || !secondary) return null;
  return {
    clear() {
      primary.clear();
      secondary.clear();
    },
    highlight(all, expr, span) {
      const [start, end] = span;
      const tokens = expr.tokens.slice(start, end).map((t) => t.text);
      const others = matchingOccurrences(all, tokens).filter(
        (o) => o.expr !== expr || o.span[0] !== start || o.span[1] !== end,
      );
      secondary.paint(
        others.map((o) => ({ locations: o.expr.locations, span: o.span })),
      );
      primary.paint([{ locations: expr.locations, span }]);
    },
  };
}

/**
 * GIF pages: every token is an element (img / variable span), so attach
 * mouseenter/mouseleave to each and highlight the smallest containing
 * sub-expression. Browser only; a no-op where the Highlight API is unavailable.
 */
export function installHoverByElement(expressions: ParsedExpression[]): void {
  const highlighter = createHighlighter();
  if (!highlighter) return;
  for (const expr of expressions) {
    const proof = expr.proof;
    if (!proof) continue;
    expr.locations.forEach((loc, i) => {
      if (loc.type !== "element") return;
      loc.node.addEventListener("mouseenter", () => {
        const span = spanToHighlight(proof, expr.locations.length, i);
        if (span) highlighter.highlight(expressions, expr, span);
        else highlighter.clear();
      });
      loc.node.addEventListener("mouseleave", () => highlighter.clear());
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
  const highlighter = createHighlighter();
  if (!highlighter) return;
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
      if (span) highlighter.highlight(expressions, expr, span);
      else highlighter.clear();
    });
    container.addEventListener("mouseleave", () => highlighter.clear());
  }
}
