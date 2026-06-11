// Hover highlighting via the CSS Custom Highlight API: no DOM mutation (so it
// can't disturb other userscripts), and Ranges can cover text-node substrings
// (e.g. one of a run-together "))" pair). See DESIGN.md "Hover highlighting".

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

/** The DOM Range to highlight when the token at `locationIndex` is hovered. */
export function spanRangeAt(
  locations: TokenLocation[],
  proof: Proof,
  locationIndex: number,
): Range | null {
  const span = spanToHighlight(proof, locations.length, locationIndex);
  return span ? rangeForSpan(locations, span) : null;
}

const HIGHLIGHT_NAME = "mm-site-format";

interface HighlightLike {
  add(range: Range): void;
  clear(): void;
}
declare const Highlight: { new (): HighlightLike };
declare const CSS: { highlights?: Map<string, HighlightLike> } | undefined;

/**
 * Installs hover highlighting for the parsed expressions (browser only; a no-op
 * where the Highlight API is unavailable). Listeners are attached to each
 * element-rendered token; hovering highlights the smallest containing
 * sub-expression. One shared Highlight holds the active range.
 */
export function installHighlighting(expressions: ParsedExpression[]): void {
  if (
    typeof CSS === "undefined" ||
    !CSS?.highlights ||
    typeof Highlight === "undefined"
  ) {
    return;
  }
  const highlight = new Highlight();
  CSS.highlights.set(HIGHLIGHT_NAME, highlight);

  const style = document.createElement("style");
  style.textContent = `::highlight(${HIGHLIGHT_NAME}){background-color:#ffe066}`;
  document.head.appendChild(style);

  for (const expr of expressions) {
    const proof = expr.proof;
    if (!proof) continue;
    expr.locations.forEach((loc, i) => {
      if (loc.type !== "element") return;
      loc.node.addEventListener("mouseenter", () => {
        const range = spanRangeAt(expr.locations, proof, i);
        highlight.clear();
        if (range) highlight.add(range);
      });
      loc.node.addEventListener("mouseleave", () => highlight.clear());
    });
  }
}
