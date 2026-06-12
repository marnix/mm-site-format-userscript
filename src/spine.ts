// Chooses a step's spine sub-proof — the main line a calculation carries down.
// A calculation transforms one expression, so the spine sub-proof is the one
// whose parse tree is "most like" the conclusion's; the others justify the local
// rewrites. Similarity is a top-down structural overlap of the two parse trees
// (the page's ground proofs), which is faithful to shared structure (unlike an
// HTML LCS) and linear. See DESIGN.md "Choosing the spine".

import type { Proof } from "./proof";

/**
 * Matched nodes when aligning two parse trees from their roots: same rule → 1
 * plus the matches of paired children; leaf↔leaf → 1; any mismatch (different
 * rule, or leaf vs node) stops that branch at 0.
 */
export function structuralOverlap(a: Proof, b: Proof): number {
  const aLeaf = a.subproofs.length === 0;
  const bLeaf = b.subproofs.length === 0;
  if (aLeaf && bLeaf) return 1;
  if (aLeaf || bLeaf) return 0;
  if (a.rule.conclusion.join(" ") !== b.rule.conclusion.join(" ")) return 0;
  if (a.subproofs.length !== b.subproofs.length) return 0;
  let matched = 1;
  for (let i = 0; i < a.subproofs.length; i++)
    matched += structuralOverlap(a.subproofs[i], b.subproofs[i]);
  return matched;
}

/**
 * The index of the spine sub-proof: the one whose parse tree overlaps the
 * conclusion's the most. Among equal-overlap candidates, prefer a non-trivial
 * (derived) sub-proof over a trivial one (a leaf — a hypothesis / 0-assumption
 * step), so the main line flows through reasoning. Returns null when two or more
 * non-trivial candidates tie — there is no clear main line (end of spine).
 */
export function chooseSpine(
  conclusion: Proof,
  subproofs: { parse: Proof; trivial: boolean }[],
): number | null {
  if (subproofs.length === 0) return null;
  const overlap = subproofs.map((s) => structuralOverlap(conclusion, s.parse));
  const best = Math.max(...overlap);
  const top = subproofs
    .map((s, i) => ({ index: i, trivial: s.trivial }))
    .filter(({ index }) => overlap[index] === best);
  const nonTrivial = top.filter((t) => !t.trivial);
  if (nonTrivial.length >= 2) return null;
  if (nonTrivial.length === 1) return nonTrivial[0].index;
  return top[0].index;
}
