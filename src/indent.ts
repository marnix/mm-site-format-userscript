// Hang-indents wrapped lines in the proof table's Expression column. Each cell
// begins with a depth "leader" (`<span class=i>. . . n</span>`) and then the
// expression, which starts with the turnstile. Left alone, a long expression
// wraps back under the leader; instead we indent continuation lines to line up
// under the expression body -- past the leader, the turnstile, and the space
// after it -- so the structure stays readable.
//
// The indent is per row (the leader's width varies with proof depth) and needs
// layout to measure, so it is applied as inline padding/text-indent rather than
// a stylesheet rule.

/** The leader (`span.i`) and the turnstile (the expression's first token) of an
 *  Expression cell, or null if the cell has no rendered expression. The
 *  turnstile is the `span.math`'s first child (Unicode) or the first image
 *  (GIF, which has no `span.math`). Pure (no layout). */
export function expressionParts(
  cell: Element,
): { leader: Element; turnstile: Element } | null {
  const leader = cell.querySelector("span.i");
  const math = cell.querySelector("span.math");
  const turnstile = math
    ? math.firstElementChild
    : cell.querySelector("img[alt]");
  return leader && turnstile ? { leader, turnstile } : null;
}

/**
 * Gives every Expression cell of the proof table a hanging indent so wrapped
 * lines align under the expression body rather than under the leader. Measures
 * each row's indent as the distance from the leader's left to the turnstile's
 * right (approx. leader + turnstile + the following space); browser only -- a no-op
 * where the cells are not laid out. Must run while the table is laid out (before
 * any `display:none`); the leading position is unaffected by the whitespace
 * spacers, so it can run before the parse pass.
 */
export function indentProofExpressions(table: Element): void {
  // Batch all layout reads first (avoid interleaving reads/writes which forces
  // reflow on every iteration -- "layout thrashing").
  const measurements: { cell: HTMLElement; indent: number }[] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 4) continue; // header rows / non-step rows
    const cell = tds[3] as HTMLElement; // the Expression column
    const parts = expressionParts(cell);
    if (!parts) continue;
    const indent =
      parts.turnstile.getBoundingClientRect().right -
      parts.leader.getBoundingClientRect().left;
    if (indent > 0) measurements.push({ cell, indent });
  }
  // Apply all writes in one pass (single reflow).
  for (const { cell, indent } of measurements) {
    cell.style.paddingLeft = `${indent}px`;
    cell.style.textIndent = `${-indent}px`;
  }
}
