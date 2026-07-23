import type { ParsedExpression } from "./page";

/**
 * True when the expression's first token is inside the Assertion table, the
 * Hypotheses table, or the Expression column (4th TD) of the proof table --
 * the cells whose parse failures matter for the calculation view.
 * Returns false for math in description paragraphs or other non-proof contexts.
 */
export function isProofExpression(expr: ParsedExpression): boolean {
  const loc = expr.locations[0];
  if (!loc) return false;
  const el = loc.node instanceof Element ? loc.node : loc.node.parentElement;
  if (!el) return false;
  if (el.closest('table[summary="Assertion"]')) return true;
  if (el.closest('table[summary^="Hypothes"]')) return true;
  const proofTable = el.closest('table[summary="Proof of theorem"]');
  if (!proofTable) return false;
  const td = el.closest("td");
  if (!td) return false;
  return [...(td.parentElement?.children ?? [])].indexOf(td) === 3;
}

/**
 * Adds a parse-warning indicator to the script banner when expressions failed
 * to parse -- meaning the grammar was insufficient even after workarounds.
 * Does nothing if all expressions parsed successfully.
 */
export function installParseWarning(
  banner: HTMLElement,
  failureCount: number,
): void {
  if (failureCount === 0) return;
  const span = banner.ownerDocument.createElement("span");
  span.className = "mm-site-format-parse-warn";
  const noun = failureCount === 1 ? "expression" : "expressions";
  span.title = `${failureCount} ${noun} could not be parsed`;
  span.textContent = " \u26a0"; // warning sign
  banner.appendChild(span);
}
