// Chooses a step's spine sub-proof -- the main line a calculation carries down.
// A calculation transforms one expression, so the spine sub-proof is the one
// whose parse tree is "most like" the conclusion's; the others justify the local
// rewrites. Similarity is a top-down structural overlap of the two parse trees
// (the page's ground proofs), which is faithful to shared structure (unlike an
// HTML longest-common-subsequence: it is not fooled by tags, glyph encodings, or
// the whitespace spacers) and linear.
//
// An earlier hand-crafted version scored sub-proofs by a size-aware log-ratio of
// an HTML LCS. That measure does NOT port to node counts -- minimising it picks
// the wrong sub-proof (it would spine `optocl` to its equality hypothesis rather
// than optocl.3); plain maximum overlap is both correct here and simpler.
// Deferred refinement: take the structure from the Ref theorem's *general* rule
// rather than the ground instances, so "optocl always spines to optocl.3"
// becomes intrinsic (substitution-independent).

import type { Proof } from "./proof";

/**
 * Matched nodes when aligning two parse trees from their roots: same rule -> 1
 * plus the matches of paired children; leaf<->leaf -> 1; any mismatch (different
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

/** The number of nodes in a parse tree. */
function treeSize(proof: Proof): number {
  let n = 1;
  for (const child of proof.subproofs) n += treeSize(child);
  return n;
}

/** Length of the longest common subsequence of two token sequences. */
function lcsLength(a: string[], b: string[]): number {
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0; // prev[j-1] before it is overwritten
    for (let j = 1; j <= b.length; j++) {
      const here = prev[j];
      prev[j] =
        a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = here;
    }
  }
  return prev[b.length];
}

/** A step "adds little" when this size-aware difference of its expression and
 *  its continuation's is at most this. Tune by eye. */
const SMALL_STEP_MAX_DIFF = 2;

/**
 * Whether a step's transition to its continuation (its spine child) adds little
 * -- e.g. a definitional unfolding like `eleq2i`, where the premise `Rels = ...`
 * reappears almost verbatim inside the conclusion `( R e. Rels <-> R e. ... )`.
 * Measured on the *expression token sequences* (not the parse trees: a
 * substitution step's premise and conclusion have quite different trees, yet
 * share most of their tokens), by the earlier userscript's size-aware
 * longest-common-subsequence ratio
 * `log2((|continuation| - lcs + 1) / (|step| - lcs + 1)) <= SMALL_STEP_MAX_DIFF`.
 * The caller gates on the step being single-premise (see `index.ts`).
 */
export function isSmallStep(step: string[], continuation: string[]): boolean {
  const lcs = lcsLength(step, continuation);
  const ratio = Math.log2(
    (continuation.length - lcs + 1) / (step.length - lcs + 1),
  );
  return ratio <= SMALL_STEP_MAX_DIFF;
}

/**
 * The index of the spine sub-proof: the one whose parse tree overlaps the
 * conclusion's the most. Among equal-overlap candidates, prefer a non-trivial
 * (derived) sub-proof over a trivial one (a leaf -- a hypothesis / 0-assumption
 * step), so the main line flows through reasoning. When several non-trivial
 * sub-proofs still tie, prefer the smallest: the running expression is one side
 * of the step's rewrite, while a rewrite premise (e.g. `( psi <-> chi )`) carries both
 * sides and is larger. Returns null only when even the smallest is not unique --
 * a genuinely symmetric step (e.g. `bitrd`), which has no clear main line.
 */
export function chooseSpine(
  conclusion: Proof,
  subproofs: { parse: Proof; trivial: boolean }[],
): number | null {
  if (subproofs.length === 0) return null;
  const overlap = subproofs.map((s) => structuralOverlap(conclusion, s.parse));
  const best = Math.max(...overlap);
  const top = subproofs
    .map((s, i) => ({ index: i, trivial: s.trivial, size: treeSize(s.parse) }))
    .filter(({ index }) => overlap[index] === best);
  const nonTrivial = top.filter((t) => !t.trivial);
  if (nonTrivial.length === 0) return top[0].index;
  if (nonTrivial.length === 1) return nonTrivial[0].index;
  const minSize = Math.min(...nonTrivial.map((t) => t.size));
  const smallest = nonTrivial.filter((t) => t.size === minSize);
  return smallest.length === 1 ? smallest[0].index : null;
}
