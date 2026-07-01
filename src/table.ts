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
 * (the conclusion). Returns null if the page has no proof table.
 */
export function parseProofTable(doc: Document): ProofTree | null {
  const table = doc.querySelector('table[summary="Proof of theorem"]');
  if (!table) return null;

  const rows = new Map<number, Row>();
  let lastStep = 0;
  for (const tr of table.querySelectorAll("tr")) {
    // Header rows use <th>, so they have no <td> and are skipped.
    const tds = tr.querySelectorAll("td");
    if (tds.length < 4) continue;
    const step = Number(tds[0].textContent?.trim());
    if (!Number.isInteger(step)) continue;
    const hyps = [...(tds[1].textContent ?? "").matchAll(/\d+/g)].map((m) =>
      Number(m[0]),
    );
    rows.set(step, {
      ref: tds[2],
      expression: expressionHtml(tds[3]),
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
      expressionHtml: row.expression,
      expressionCell: row.cell,
      subproofs: row.hyps.map(build),
    };
    memo.set(step, node);
    return node;
  };
  return build(lastStep);
}
