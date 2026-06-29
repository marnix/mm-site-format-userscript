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
  for (let i = 0; i < a.subproofs.length; i++) {
    const ai = a.subproofs[i];
    const bi = b.subproofs[i];
    const aiLeaf = ai.subproofs.length === 0;
    const biLeaf = bi.subproofs.length === 0;
    if (aiLeaf && biLeaf) matched++;
    else if (
      !aiLeaf &&
      !biLeaf &&
      ai.rule.conclusion.join(" ") === bi.rule.conclusion.join(" ")
    )
      matched++;
  }
  return matched;
}

/** The number of nodes in a parse tree. */
function treeSize(proof: Proof): number {
  let n = 1;
  for (const child of proof.subproofs) n += treeSize(child);
  return n;
}

/** Length of the longest common subsequence of two token sequences. */
export function lcsLength(a: string[], b: string[]): number {
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

/**
 * Tiebreaker for `chooseSpine` when structural metrics return null: among
 * `subproofTokens`, pick the hypothesis whose token sequence has the highest
 * LCS with `anchorTokens` (the previous step's expression in the calculation
 * chain). Returns null when no hypothesis has tokens, or when the best score
 * is shared by two or more. Null entries in `subproofTokens` are skipped.
 */
export function anchorSpine(
  anchorTokens: string[],
  subproofTokens: (string[] | null)[],
): number | null {
  const scores = subproofTokens.map((t) =>
    t !== null ? lcsLength(anchorTokens, t) : -1,
  );
  const best = Math.max(...scores);
  if (best < 0) return null;
  const bestIndices = scores.reduce<number[]>(
    (acc, s, i) => (s === best ? [...acc, i] : acc),
    [],
  );
  return bestIndices.length === 1 ? bestIndices[0] : null;
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

/** Maximum structural overlap between `target` and any subtree of `tree`. */
function maxSubtreeOverlap(target: Proof, tree: Proof): number {
  let best = structuralOverlap(target, tree);
  for (const child of tree.subproofs) {
    const c = maxSubtreeOverlap(target, child);
    if (c > best) best = c;
  }
  return best;
}

/**
 * Measures how much of the "diverging" part of `conclusion` reappears as a
 * subtree in the corresponding "diverging" part of `hypothesis`. Walks down
 * their shared top-level structure (same rule, paired children); at each point
 * where they diverge, asks whether the conclusion's sub-tree reappears anywhere
 * inside the hypothesis's sub-tree (maxSubtreeOverlap). Sum over all diverging
 * branches. A high score means the hypothesis "contains" the conclusion -- it is
 * a rewrite rule, not the main transformed expression. Use as a tiebreaker:
 * prefer the candidate with the LOWEST score.
 *
 * Unlike maxSubtreeOverlap applied to the whole conclusion, this is not
 * dominated by the shared prefix (e.g. a large common antecedent `ph`), so it
 * correctly distinguishes mpjaod's jaod.1 (consequent wi(ps,ch) contains ch)
 * from jaod.3 (consequent wo(ps,th) does not contain ch) regardless of ph's size.
 */
export function divergingSubtreeOverlap(
  conclusion: Proof,
  hypothesis: Proof,
): number {
  const cLeaf = conclusion.subproofs.length === 0;
  const hLeaf = hypothesis.subproofs.length === 0;
  if (cLeaf && hLeaf) return 0;
  if (
    cLeaf ||
    hLeaf ||
    conclusion.rule.conclusion.join(" ") !==
      hypothesis.rule.conclusion.join(" ") ||
    conclusion.subproofs.length !== hypothesis.subproofs.length
  )
    return maxSubtreeOverlap(conclusion, hypothesis);
  let total = 0;
  for (let i = 0; i < conclusion.subproofs.length; i++)
    total += divergingSubtreeOverlap(
      conclusion.subproofs[i],
      hypothesis.subproofs[i],
    );
  return total;
}

/**
 * The position index of the first argument where `conclusion` and `hypothesis`
 * structurally diverge (different rule, or leaf vs. non-leaf). Treats leaf vs.
 * leaf as a match regardless of identity (same convention as structuralOverlap).
 * Returns `conclusion.subproofs.length` when no diverging position is found.
 * Only meaningful when both proofs share the same root rule.
 */
function firstDivergingPosition(conclusion: Proof, hypothesis: Proof): number {
  for (let i = 0; i < conclusion.subproofs.length; i++) {
    const ci = conclusion.subproofs[i];
    const hi = hypothesis.subproofs[i];
    const ciLeaf = ci.subproofs.length === 0;
    const hiLeaf = hi.subproofs.length === 0;
    if (ciLeaf && hiLeaf) continue;
    if (
      !ciLeaf &&
      !hiLeaf &&
      ci.rule.conclusion.join(" ") === hi.rule.conclusion.join(" ")
    )
      continue;
    return i;
  }
  return conclusion.subproofs.length;
}

/**
 * The index of the spine sub-proof: the one whose parse tree overlaps the
 * conclusion's the most. Among equal-overlap candidates, prefer a non-trivial
 * (derived) sub-proof over a trivial one (a leaf -- a hypothesis / 0-assumption
 * step), so the main line flows through reasoning. When several non-trivial
 * sub-proofs still tie, prefer the one that first diverges from the conclusion
 * at the earliest argument position (lower index = the hypothesis preserves more
 * of the conclusion's trailing arguments, e.g. the consequent of a `syl` step).
 * When that still ties, prefer the one with the lowest divergingSubtreeOverlap:
 * a hypothesis whose diverging part contains the conclusion's diverging part as
 * a subtree is a rewrite rule, not the main transformed input (e.g. mpjaod's
 * jaod.1/jaod.2 contain the conclusion's consequent ch inside wi(ps,ch); jaod.3,
 * the disjunction being eliminated, does not). Falls back to smallest size, then
 * returns null for a genuinely symmetric step (e.g. `bitrd`).
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
  const fdp = nonTrivial.map((t) =>
    firstDivergingPosition(conclusion, subproofs[t.index].parse),
  );
  const minFdp = Math.min(...fdp);
  const fdpTop = nonTrivial.filter((_, i) => fdp[i] === minFdp);
  if (fdpTop.length === 1) return fdpTop[0].index;
  const mso = fdpTop.map((t) =>
    divergingSubtreeOverlap(conclusion, subproofs[t.index].parse),
  );
  const minMso = Math.min(...mso);
  const msoTop = fdpTop.filter((_, i) => mso[i] === minMso);
  if (msoTop.length === 1) return msoTop[0].index;
  const minSize = Math.min(...msoTop.map((t) => t.size));
  const smallest = msoTop.filter((t) => t.size === minSize);
  return smallest.length === 1 ? smallest[0].index : null;
}
