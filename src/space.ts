// Inserts parse-tree-guided whitespace into a rendered expression: an empty
// inline spacer before each token whose gap (from spans.gapUnits) is non-zero.
// The original glyphs are untouched — only spacers are inserted (text nodes are
// split where a gap falls mid-text). The caller re-runs its tokenizer afterward
// to refresh hover locations: spacers are empty so the tokenizer ignores them.

import type { LocatedToken, TokenLocation } from "./token";

/** Width of one spacing unit. */
const EX_PER_UNIT = 0.2;

function spacer(units: number): HTMLElement {
  const span = document.createElement("span");
  span.className = "mm-site-format-space";
  span.style.cssText = `display:inline-block;width:${(units * EX_PER_UNIT).toFixed(2)}ex`;
  return span;
}

/**
 * Inserts spacers before the located tokens per `units` (in the proof's token
 * space; `units[0]` is the gap before the first proof token). Right-to-left, so
 * earlier offsets stay valid as text nodes are split. `onSplit(old, fresh)` lets
 * a GIF caller keep its run's node array in sync with the split.
 */
export function insertSpacers(
  located: LocatedToken[],
  units: number[],
  onSplit?: (oldNode: Text, freshNode: Text) => void,
): void {
  const base = located.length - units.length;
  if (base < 0) return;
  for (let i = units.length - 1; i >= 1; i--) {
    if (units[i] <= 0) continue;
    insertBefore(located[base + i].location, spacer(units[i]), onSplit);
  }
}

function insertBefore(
  loc: TokenLocation,
  node: HTMLElement,
  onSplit?: (oldNode: Text, freshNode: Text) => void,
): void {
  if (loc.type === "element") {
    loc.node.parentNode?.insertBefore(node, loc.node);
  } else if (loc.start === 0) {
    loc.node.parentNode?.insertBefore(node, loc.node);
  } else {
    const fresh = loc.node.splitText(loc.start);
    onSplit?.(loc.node, fresh);
    fresh.parentNode?.insertBefore(node, fresh);
  }
}
