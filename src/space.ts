// Inserts parse-tree-guided whitespace into a rendered expression: an empty
// inline spacer before each token whose gap (from spans.gapUnits) is non-zero.
// The page's whitespace in every gap is removed, whether or not a spacer is
// inserted for it: the whitespace in the gap (trailing whitespace of the
// preceding text, or of the previous sibling when the token is an element) is
// stripped, so a spacer's padding is the whole gap, and a zero-unit gap leaves
// no literal whitespace behind. Text nodes are split where a gap falls
// mid-text. The caller re-runs its tokenizer afterward to refresh hover
// locations: spacers are empty so the tokenizer ignores them.

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
    // No special case for zero-unit gaps: the page's whitespace in the gap is
    // removed either way, and only a non-zero gap gets a spacer inserted.
    const node = units[i] > 0 ? spacer(units[i]) : null;
    insertBefore(located[base + i].location, node, onSplit);
  }
}

function insertBefore(
  loc: TokenLocation,
  node: HTMLElement | null,
  onSplit?: (oldNode: Text, freshNode: Text) => void,
): void {
  if (loc.type === "element") {
    // The whitespace before an element token is the trailing whitespace of its
    // previous sibling (the text run ends before the element).
    stripTrailingWhitespace(loc.node.previousSibling);
    if (node) loc.node.parentNode?.insertBefore(node, loc.node);
    return;
  }
  // text or folded: the gap goes before the token's first character.
  const at = loc.type === "folded" ? loc.offset : loc.start;
  if (at === 0) {
    stripTrailingWhitespace(loc.node.previousSibling);
    if (node) loc.node.parentNode?.insertBefore(node, loc.node);
    return;
  }
  // A token anchored to a non-text node (an inline element at the start of its
  // run): the gap is before the element itself.
  const value = loc.node.nodeValue;
  if (value === null) {
    stripTrailingWhitespace(loc.node.previousSibling);
    if (node) loc.node.parentNode?.insertBefore(node, loc.node);
    return;
  }
  if (at >= value.length) {
    // An inline element's characters inherit the text position of the character
    // they follow, so a token can share the offset of an already-processed
    // (right-hand) token; that gap split this node at `at`, the token's
    // characters now begin at the next sibling, and its gap's whitespace was
    // already removed by that split's strip.
    if (node && loc.node.nextSibling) {
      loc.node.nextSibling.parentNode?.insertBefore(node, loc.node.nextSibling);
    }
    return;
  }
  const fresh = loc.node.splitText(at);
  onSplit?.(loc.node, fresh);
  // The whitespace between the previous token and this one now ends the left
  // fragment (`loc.node`): remove it, so the gap is the spacer's padding
  // alone -- and a zero-unit gap leaves no literal space.
  const left = loc.node.nodeValue ?? "";
  const trimmed = left.replace(/\s+$/, "");
  if (trimmed.length < left.length) loc.node.nodeValue = trimmed;
  if (node) fresh.parentNode?.insertBefore(node, fresh);
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
