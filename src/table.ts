// Builds the proof tree from the "Proof of Theorem" table. Each data row's Ref
// cell becomes a node's refHtml and its Expression cell (with the leading
// indentation stripped) its expressionHtml; the Hyp column lists the step
// numbers of that node's subproofs, in order (empty for hypotheses).

import type { ProofTree } from "./calculation";

interface Row {
  ref: Element; // the Ref column cell
  expression: Element; // the Expression column, indentation stripped
  cell: Element; // the original Expression cell (to match its parsed expression)
  hyps: number[]; // step numbers cited in the Hyp column, in order
}

/**
 * The Expression cell, copied with its leading ". . . n" indentation marker
 * (`span.i`) and the step anchor removed, leaving just the rendered expression.
 */
function expressionHtml(cell: Element): Element {
  const clone = cell.cloneNode(true) as Element;
  for (const node of clone.querySelectorAll("span.i, a[name]")) node.remove();
  return clone;
}

/**
 * Builds the proof tree from the page's proof table, rooted at the final step
 * (the conclusion). Returns null if the page has no proof table. Also returns
 * a map from ProofTree node to its step number.
 *
 * Expression cells are deep-cloned eagerly (to capture state before the spacer
 * pass modifies them). On large GIF pages this is the dominant cost; call
 * `parseProofTableLazy` + `materializeExpressions` to defer cloning.
 */
export function parseProofTable(
  doc: Document,
): { tree: ProofTree; stepOf: Map<ProofTree, number> } | null {
  const result = parseProofTableLazy(doc);
  if (!result) return null;
  materializeExpressions(result.tree);
  return result;
}

/**
 * Like `parseProofTable`, but stores raw cell references instead of clones.
 * Call `materializeExpressions` before the spacer pass modifies the cells.
 */
export function parseProofTableLazy(
  doc: Document,
): { tree: ProofTree; stepOf: Map<ProofTree, number> } | null {
  const table = doc.querySelector('table[summary="Proof of theorem"]');
  if (!table) return null;

  const rows = new Map<number, Row>();
  let lastStep = 0;
  for (const tr of table.querySelectorAll("tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 4) continue;
    const step = Number(tds[0].textContent?.trim());
    if (!Number.isInteger(step)) continue;
    const hyps = [...(tds[1].textContent ?? "").matchAll(/\d+/g)].map((m) =>
      Number(m[0]),
    );
    rows.set(step, {
      ref: tds[2],
      expression: tds[3], // raw cell -- clone deferred
      cell: tds[3],
      hyps,
    });
    if (step > lastStep) lastStep = step;
  }
  if (rows.size === 0) return null;

  const memo = new Map<number, ProofTree>();
  const build = (step: number): ProofTree => {
    const cached = memo.get(step);
    if (cached) return cached;
    const row = rows.get(step);
    if (!row) throw new Error(`proof table references missing step ${step}`);
    const node: ProofTree = {
      refHtml: row.ref,
      expressionHtml: row.expression, // still the raw cell
      expressionCell: row.cell,
      subproofs: row.hyps.map(build),
    };
    memo.set(step, node);
    return node;
  };
  const tree = build(lastStep);
  const stepOf = new Map<ProofTree, number>();
  for (const [step, node] of memo) stepOf.set(node, step);
  return { tree, stepOf };
}

/**
 * Installs lazy expression cloning on every node in the proof tree. Each node's
 * `expressionHtml` starts as the raw cell reference; on first property access it
 * is reconstructed from a pre-captured HTML snapshot (taken NOW, before spacers
 * modify the cells) and cached. This avoids upfront cost of constructing hundreds
 * of DOM trees from image-heavy cells when only a subset (spine + visible
 * subcalcs) are actually rendered.
 *
 * Must be called after `indentProofExpressions` (which reads leader widths from
 * the original cells) but before the spacer/parse pass (which modifies cells
 * in-place). Visits each unique node once (DAG-safe via identity check).
 */
export function materializeExpressions(tree: ProofTree): void {
  const visited = new Set<ProofTree>();
  const walk = (node: ProofTree) => {
    if (visited.has(node)) return;
    visited.add(node);
    // Capture the cell's HTML now (string copy is cheap); build the DOM lazily.
    const cell = node.expressionHtml;
    const html = cell.innerHTML;
    const ownerDoc = cell.ownerDocument;
    let cached: Element | null = null;
    Object.defineProperty(node, "expressionHtml", {
      get() {
        if (!cached) {
          cached = ownerDoc.createElement("span");
          cached.innerHTML = html;
          for (const el of cached.querySelectorAll("span.i, a[name]"))
            el.remove();
        }
        return cached;
      },
      set(v: Element) {
        cached = v;
      },
      configurable: true,
      enumerable: true,
    });
    for (const sub of node.subproofs) walk(sub);
  };
  walk(tree);
}
