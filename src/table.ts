// Builds the proof tree from the "Proof of Theorem" table. Each data row's Ref
// cell becomes a node's refHtml; the Hyp column lists the step numbers of that
// node's subproofs, in order (empty for hypotheses). See DESIGN.md.

import type { ProofTree } from "./calculation";

interface Row {
  ref: Element; // the Ref column cell
  hyps: number[]; // step numbers cited in the Hyp column, in order
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
    if (tds.length < 3) continue;
    const step = Number(tds[0].textContent?.trim());
    if (!Number.isInteger(step)) continue;
    const hyps = [...(tds[1].textContent ?? "").matchAll(/\d+/g)].map((m) =>
      Number(m[0]),
    );
    rows.set(step, { ref: tds[2], hyps });
    if (step > lastStep) lastStep = step;
  }
  if (rows.size === 0) return null;

  const build = (step: number): ProofTree => {
    const row = rows.get(step);
    if (!row) throw new Error(`proof table references missing step ${step}`);
    return { refHtml: row.ref, subproofs: row.hyps.map(build) };
  };
  return build(lastStep);
}
