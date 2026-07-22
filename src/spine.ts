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

import { DEV_SPINE_LOG } from "./config";

/**
 * Matched nodes when aligning two parse trees from their roots: same rule -> 1
 * plus the recursive matches of paired children; leaf<->leaf -> 1; any mismatch
 * (different rule, or leaf vs node) stops that branch at 0.
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
    matched += structuralOverlap(a.subproofs[i], b.subproofs[i]);
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
 * The index of the spine sub-proof: the one whose parse tree is most like the
 * conclusion's. Among candidates, prefer a non-trivial (derived) sub-proof over
 * a trivial one (a leaf). Among non-trivial candidates, the tiebreaker cascade:
 *
 * 1. First diverging position (FDP): prefer the hypothesis that first diverges
 *    from the conclusion at the EARLIEST child position (lower = more trailing
 *    arguments are preserved, e.g. the consequent of a `syl` step).
 * 2. Structural overlap: recursive count of shared tree nodes from the root.
 *    Higher is better -- the hypothesis that shares more internal structure
 *    with the conclusion is more likely to be the main derivation line.
 * 3. Diverging subtree overlap (DSO): prefer LOWER -- a hypothesis whose
 *    diverging part contains the conclusion's diverging part as a subtree is a
 *    rewrite rule, not the main transformed expression.
 * 4. Size: prefer the larger hypothesis (it usually carries the main derivation
 *    forward rather than being a helper lemma).
 * 5. Null: genuinely symmetric step (e.g. `bitrd`) -- no clear main line.
 */
export function chooseSpine(
  conclusion: Proof,
  subproofs: { parse: Proof; trivial: boolean }[],
  label?: string,
): number | null {
  if (subproofs.length === 0) return null;

  // Trivial filter: prefer non-trivial (derived) sub-proofs.
  const candidates = subproofs.map((s, i) => ({
    index: i,
    trivial: s.trivial,
    size: treeSize(s.parse),
  }));
  const nonTrivial = candidates.filter((t) => !t.trivial);
  if (nonTrivial.length === 0) {
    const result = candidates.length === 1 ? candidates[0].index : null;
    if (DEV_SPINE_LOG)
      console.log(`[spine] ${label ?? "?"}: all trivial => ${result}`);
    return result;
  }
  if (nonTrivial.length === 1) {
    if (DEV_SPINE_LOG)
      console.log(
        `[spine] ${label ?? "?"}: single non-trivial #${nonTrivial[0].index}`,
      );
    return nonTrivial[0].index;
  }

  // 1. First diverging position: lower = better (preserves trailing args).
  const fdp = nonTrivial.map((t) =>
    firstDivergingPosition(conclusion, subproofs[t.index].parse),
  );
  const minFdp = Math.min(...fdp);
  const fdpTop = nonTrivial.filter((_, i) => fdp[i] === minFdp);
  if (fdpTop.length === 1) {
    if (DEV_SPINE_LOG)
      console.log(
        `[spine] ${label ?? "?"}: fdp winner #${fdpTop[0].index}, fdp=[${fdp.map((f, i) => `${nonTrivial[i].index}:${f}`)}]`,
      );
    return fdpTop[0].index;
  }

  // 2. Structural overlap: higher = better (more shared structure).
  const overlap = fdpTop.map((t) =>
    structuralOverlap(conclusion, subproofs[t.index].parse),
  );
  const maxOverlap = Math.max(...overlap);
  const overlapTop = fdpTop.filter((_, i) => overlap[i] === maxOverlap);
  if (overlapTop.length === 1) {
    if (DEV_SPINE_LOG)
      console.log(
        `[spine] ${label ?? "?"}: overlap winner #${overlapTop[0].index}, fdp=[${fdp.map((f, i) => `${nonTrivial[i].index}:${f}`)}] overlap=[${overlap.map((o, i) => `${fdpTop[i].index}:${o}`)}]`,
      );
    return overlapTop[0].index;
  }

  // 3. Diverging subtree overlap: lower = better (not a rewrite rule).
  const dso = overlapTop.map((t) =>
    divergingSubtreeOverlap(conclusion, subproofs[t.index].parse),
  );
  const minDso = Math.min(...dso);
  const dsoTop = overlapTop.filter((_, i) => dso[i] === minDso);
  if (dsoTop.length === 1) {
    if (DEV_SPINE_LOG)
      console.log(
        `[spine] ${label ?? "?"}: dso winner #${dsoTop[0].index}, fdp=[${fdp.map((f, i) => `${nonTrivial[i].index}:${f}`)}] overlap=[${overlap.map((o, i) => `${fdpTop[i].index}:${o}`)}] dso=[${dso.map((d, i) => `${overlapTop[i].index}:${d}`)}]`,
      );
    return dsoTop[0].index;
  }

  // 4. Size: prefer larger (main derivation is typically more complex).
  const maxSize = Math.max(...dsoTop.map((t) => t.size));
  const largest = dsoTop.filter((t) => t.size === maxSize);
  const result = largest.length === 1 ? largest[0].index : null;
  if (DEV_SPINE_LOG)
    console.log(
      `[spine] ${label ?? "?"}: size/tie, fdp=[${fdp.map((f, i) => `${nonTrivial[i].index}:${f}`)}] overlap=[${overlap.map((o, i) => `${fdpTop[i].index}:${o}`)}] dso=[${dso.map((d, i) => `${overlapTop[i].index}:${d}`)}] size=[${dsoTop.map((t) => `${t.index}:${t.size}`)}] => ${result}`,
    );
  return result;
}
