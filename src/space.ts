// Inserts parse-tree-guided whitespace into a rendered expression: an empty
// inline spacer before each token whose gap (from spans.gapUnits) is non-zero.
// The spacer REPLACES the page's existing whitespace rather than adding to it:
// the whitespace in the gap (trailing whitespace of the preceding text, or of
// the previous sibling when the token is an element) is removed, so the spacer's
// padding is the whole gap. Text nodes are split where a gap falls mid-text.
// The caller re-runs its tokenizer afterward to refresh hover locations:
// spacers are empty so the tokenizer ignores them.

import type { LocatedToken, TokenLocation } from "./token";

/** Width of one spacing unit (a single "gap"). */
const EX_PER_UNIT = 0.3;

/** Class on inserted spacers, so the highlighter can colour them too. */
export const SPACE_CLASS = "mm-site-format-space";

// An inline element whose left padding makes the gap: inline (not inline-block)
// so it has the line's height and its padding shows a background when the
// highlighter colours it (an empty inline-block would be zero-height).
function spacer(units: number): HTMLElement {
  const span = document.createElement("span");
  span.className = SPACE_CLASS;
  span.style.cssText = `padding-left:${(units * EX_PER_UNIT).toFixed(2)}ex`;
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
    // The whitespace before an element token is the trailing whitespace of its
    // previous sibling (the text run ends before the element).
    stripTrailingWhitespace(loc.node.previousSibling);
    loc.node.parentNode?.insertBefore(node, loc.node);
    return;
  }
  // text or folded: the gap goes before the token's first character.
  const at = loc.type === "folded" ? loc.offset : loc.start;
  if (at === 0) {
    stripTrailingWhitespace(loc.node.previousSibling);
    loc.node.parentNode?.insertBefore(node, loc.node);
  } else {
    const fresh = loc.node.splitText(at);
    onSplit?.(loc.node, fresh);
    // The whitespace between the previous token and this one now ends the left
    // fragment (`loc.node`): remove it, so the spacer replaces the page's
    // existing space instead of adding to it.
    const value = loc.node.nodeValue ?? "";
    const trimmed = value.replace(/\s+$/, "");
    if (trimmed.length < value.length) loc.node.nodeValue = trimmed;
    fresh.parentNode?.insertBefore(node, fresh);
  }
}

/** Removes the trailing whitespace of a text node -- the space a spacer
 *  replaces when the token it precedes is an element or starts a text node. */
function stripTrailingWhitespace(node: Node | null): void {
  if (node && node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    const value = text.nodeValue ?? "";
    const trimmed = value.replace(/\s+$/, "");
    if (trimmed.length < value.length) text.nodeValue = trimmed;
  }
}
