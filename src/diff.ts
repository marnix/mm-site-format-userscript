// Tree diff for consecutive calculation expressions: finds the maximal common
// subtrees between two parse trees and computes which token spans are "changed".
// The algorithm is pluggable; the default is Zhang-Shasha tree edit distance.

import type { Proof } from "./proof";
import { substitute } from "./proof";
import type { Span } from "./spans";

/** Roots of the maximal subtrees of a and b that appear (by expression) in the other. */
export interface DiffResult {
  unchangedInA: Set<Proof>;
  unchangedInB: Set<Proof>;
}

/** A diff algorithm: given two parse trees, return the maximal shared subtrees. */
export type DiffAlgorithm = (a: Proof, b: Proof) => DiffResult;

// ---------------------------------------------------------------------------
// Zhang-Shasha tree edit distance
// ---------------------------------------------------------------------------

/** Flattened node for the Zhang-Shasha algorithm (post-order indexed). */
interface ZSNode {
  proof: Proof;
  label: string; // rule label or leaf variable token
  leftmost: number; // post-order index of leftmost leaf descendant
}

/** Compute the label for a proof node: rule label for internal, token for leaf. */
function nodeLabel(p: Proof): string {
  if (p.subproofs.length === 0) {
    // Leaf: the variable token itself (the conclusion minus the kind prefix)
    return p.rule.conclusion.slice(1).join(" ");
  }
  // Internal node: the rule's label (e.g. "wi", "wb") or fallback to conclusion pattern
  return p.rule.label ?? p.rule.conclusion.join(" ");
}

/** Flatten a proof tree into post-order ZSNode array. */
function flatten(root: Proof): ZSNode[] {
  const nodes: ZSNode[] = [];
  function walk(p: Proof): number {
    let leftmost = nodes.length; // tentative: will be overwritten if children exist
    if (p.subproofs.length > 0) {
      // Visit children in order; leftmost of first child is our leftmost
      let first = true;
      for (const child of p.subproofs) {
        const childLeft = walk(child);
        if (first) {
          leftmost = childLeft;
          first = false;
        }
      }
    }
    // Post-order: add self after all children
    const idx = nodes.length;
    nodes.push({ proof: p, label: nodeLabel(p), leftmost });
    return leftmost;
  }
  walk(root);
  return nodes;
}

/** Compute keyroots: nodes where leftmost != parent's leftmost, plus the root. */
function keyroots(nodes: ZSNode[]): number[] {
  // A node i is a keyroot iff no node j > i has leftmost[j] == leftmost[i].
  // Equivalently: for each distinct leftmost value, the largest index with that value.
  const seen = new Map<number, number>(); // leftmost -> largest index
  for (let i = 0; i < nodes.length; i++) {
    seen.set(nodes[i].leftmost, i);
  }
  const kr = [...seen.values()];
  kr.sort((a, b) => a - b);
  return kr;
}

/**
 * Zhang-Shasha TED: computes the optimal node matching between two ordered
 * labelled trees. Returns the set of (indexA, indexB) pairs that are matched
 * (i.e. not inserted, deleted, or relabelled).
 *
 * Cost model: delete = insert = 1, relabel = 0 if same label else 1.
 * We only care about the matching, not the distance number.
 */
function zhangShashaMatching(
  nodesA: ZSNode[],
  nodesB: ZSNode[],
): [number, number][] {
  const m = nodesA.length;
  const n = nodesB.length;

  const krA = keyroots(nodesA);
  const krB = keyroots(nodesB);

  // Tree distance matrix (only needed for the final traceback)
  // td[i][j] = edit distance between subtree rooted at i and subtree rooted at j
  const td: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

  // Partial results: which operations were chosen (for traceback)
  // We store the full forest-distance matrices per keyroot pair for traceback.
  // For efficiency in small trees, store operations inline.

  // Operation enum for traceback
  const DEL = 0,
    INS = 1,
    MATCH = 2;

  // Store operations for traceback: ops[i][j] stores per-keyroot-pair results
  // We'll do a two-pass: first compute distances, then trace back.
  // For small trees this is fine.

  // Forest distance + operation storage per keyroot pair
  type FDEntry = { cost: number; op: number };

  // We need to trace back globally. Store forest-dist for each keyroot pair.
  // Key: `${krAi},${krBj}` -> 2D array of FDEntry
  const fdStore = new Map<string, FDEntry[][]>();

  for (const krAi of krA) {
    for (const krBj of krB) {
      const lA = nodesA[krAi].leftmost;
      const lB = nodesB[krBj].leftmost;
      const sizeA = krAi - lA + 2; // +1 for the empty forest row/col
      const sizeB = krBj - lB + 2;

      // fd[iOff][jOff] where iOff = i - lA + 1, jOff = j - lB + 1
      // fd[0][*] and fd[*][0] are the empty-forest base cases
      const fd: FDEntry[][] = Array.from({ length: sizeA }, () =>
        Array.from({ length: sizeB }, () => ({ cost: 0, op: -1 })),
      );

      // Base cases: deleting all of one forest
      for (let i = 1; i < sizeA; i++) fd[i][0] = { cost: i, op: DEL };
      for (let j = 1; j < sizeB; j++) fd[0][j] = { cost: j, op: INS };

      for (let i = lA; i <= krAi; i++) {
        const iOff = i - lA + 1;
        for (let j = lB; j <= krBj; j++) {
          const jOff = j - lB + 1;
          const lAi = nodesA[i].leftmost;
          const lBj = nodesB[j].leftmost;

          if (lAi === lA && lBj === lB) {
            // Both i and j are in the same relative position as the keyroots
            const costDel = fd[iOff - 1][jOff].cost + 1;
            const costIns = fd[iOff][jOff - 1].cost + 1;
            const relabel = nodesA[i].label === nodesB[j].label ? 0 : 1;
            const costMatch = fd[iOff - 1][jOff - 1].cost + relabel;

            if (costMatch <= costDel && costMatch <= costIns) {
              fd[iOff][jOff] = { cost: costMatch, op: MATCH };
            } else if (costDel <= costIns) {
              fd[iOff][jOff] = { cost: costDel, op: DEL };
            } else {
              fd[iOff][jOff] = { cost: costIns, op: INS };
            }
            td[i][j] = fd[iOff][jOff].cost;
          } else {
            // Use previously computed tree distances
            const lAiOff = lAi - lA + 1;
            const lBjOff = lBj - lB + 1;
            const costDel = fd[iOff - 1][jOff].cost + 1;
            const costIns = fd[iOff][jOff - 1].cost + 1;
            const costTD = fd[lAiOff - 1][lBjOff - 1].cost + td[i][j];

            if (costTD <= costDel && costTD <= costIns) {
              fd[iOff][jOff] = { cost: costTD, op: MATCH };
            } else if (costDel <= costIns) {
              fd[iOff][jOff] = { cost: costDel, op: DEL };
            } else {
              fd[iOff][jOff] = { cost: costIns, op: INS };
            }
          }
        }
      }

      fdStore.set(`${krAi},${krBj}`, fd);
      td[krAi][krBj] = fd[krAi - lA + 1][krBj - lB + 1].cost;
    }
  }

  // Traceback: extract the matching pairs from the edit script.
  // We trace through the forest-distance matrices recursively.
  const matched: [number, number][] = [];

  function traceback(krAi: number, krBj: number): void {
    const lA = nodesA[krAi].leftmost;
    const lB = nodesB[krBj].leftmost;
    const fd = fdStore.get(`${krAi},${krBj}`)!;

    let i = krAi;
    let j = krBj;

    while (i >= lA && j >= lB) {
      const iOff = i - lA + 1;
      const jOff = j - lB + 1;
      const entry = fd[iOff][jOff];

      if (entry.cost === 0 && iOff === 0 && jOff === 0) break;

      const lAi = nodesA[i].leftmost;
      const lBj = nodesB[j].leftmost;

      if (lAi === lA && lBj === lB) {
        // Simple case: single-node comparison
        if (entry.op === DEL) {
          i--;
        } else if (entry.op === INS) {
          j--;
        } else {
          // MATCH (relabel with cost 0 = true match, cost 1 = relabel)
          if (nodesA[i].label === nodesB[j].label) {
            matched.push([i, j]);
          }
          i--;
          j--;
        }
      } else {
        // Compound case: need to recurse into sub-tree-distance
        if (entry.op === DEL) {
          i--;
        } else if (entry.op === INS) {
          j--;
        } else {
          // op === MATCH: the sub-tree td[i][j] was used
          // Recurse into that subtree's matching
          traceSubtree(i, j);
          // Skip past the subtrees
          i = lAi - 1;
          j = lBj - 1;
        }
      }
    }
    // Handle remaining deletions/insertions
    // (already handled by the while loop stopping)
  }

  function traceSubtree(i: number, j: number): void {
    // Find the keyroot pair that computed td[i][j]
    // i is a keyroot of its own subtree (rooted at i with leftmost = nodesA[i].leftmost)
    // We need to find the fdStore entry that contains this computation.
    // Actually, td[i][j] was computed when i's subtree was handled as a keyroot.
    // The relevant keyroot pair is (i, j) itself if i and j are keyroots,
    // otherwise we need the enclosing keyroot computation.
    // Since td[i][j] is set when lAi === lA && lBj === lB for some keyroot pair,
    // and the subtree rooted at i has its own keyroots, we just recurse with i as root.

    // For the subtree rooted at i: its keyroots are computed from nodesA[leftmost..i]
    // For small trees, we can just re-run the matching on the subtrees.
    const subA = nodesA.slice(nodesA[i].leftmost, i + 1);
    const subB = nodesB.slice(nodesB[j].leftmost, j + 1);

    // Re-index: the sub-arrays have local indices
    const offsetA = nodesA[i].leftmost;
    const offsetB = nodesB[j].leftmost;

    // Adjust leftmost values to be local
    const localA: ZSNode[] = subA.map((n) => ({
      ...n,
      leftmost: n.leftmost - offsetA,
    }));
    const localB: ZSNode[] = subB.map((n) => ({
      ...n,
      leftmost: n.leftmost - offsetB,
    }));

    const subMatched = zhangShashaMatching(localA, localB);
    for (const [a, b] of subMatched) {
      matched.push([a + offsetA, b + offsetB]);
    }
  }

  traceback(m - 1, n - 1);
  return matched;
}

/**
 * Zhang-Shasha tree edit distance diff: computes the optimal matching between
 * two parse trees and marks matched subtree roots as "unchanged". A node is
 * unchanged if it is matched (same label, same position in edit script) AND all
 * its descendants are also matched to the corresponding descendants.
 *
 * We report the *maximal* matched subtrees: a matched node whose entire subtree
 * is matched is reported; its matched descendants are not (they're subsumed).
 */
export const zhangShashaDiff: DiffAlgorithm = (a, b) => {
  if (a === b) {
    return { unchangedInA: new Set([a]), unchangedInB: new Set([b]) };
  }

  const nodesA = flatten(a);
  const nodesB = flatten(b);
  const matching = zhangShashaMatching(nodesA, nodesB);

  // Build match maps: indexA -> indexB and vice versa
  const matchA = new Map<number, number>(); // A index -> B index
  const matchB = new Map<number, number>(); // B index -> A index
  for (const [ai, bi] of matching) {
    matchA.set(ai, bi);
    matchB.set(bi, ai);
  }

  // Determine which matched nodes have their entire subtree matched.
  // A subtree rooted at post-order index i spans [leftmost[i], i].
  // It's fully matched if every node in [leftmost[i], i] is matched and
  // maps to a contiguous range in B that corresponds to the partner's subtree.

  // Simpler approach: a matched node is "fully matched" if:
  // 1. It is matched (label-equal) to some node in B
  // 2. All descendants in its subtree are also matched
  // 3. The matched partners form the complete subtree of the B partner

  // We compute this bottom-up: a leaf is fully-matched if it's matched.
  // An internal node is fully-matched if it's matched AND all its immediate
  // children (in post-order range) are fully-matched AND the partner's subtree
  // has the same structure.

  // For efficiency on small trees: check if the entire subtree [leftmost, i]
  // maps bijectively to [partner's leftmost, partner].
  const fullyMatchedA = new Set<number>();

  function isFullyMatched(i: number): boolean {
    if (!matchA.has(i)) return false;
    const j = matchA.get(i)!;
    const lA = nodesA[i].leftmost;
    const lB = nodesB[j].leftmost;
    const sizeA = i - lA + 1;
    const sizeB = j - lB + 1;
    if (sizeA !== sizeB) return false;

    // Check that every node in [lA, i] is matched to [lB, j] in order
    for (let k = 0; k < sizeA; k++) {
      const ak = lA + k;
      const bk = lB + k;
      if (matchA.get(ak) !== bk) return false;
    }
    return true;
  }

  // Find maximal fully-matched subtrees in A (top-down: skip into children if parent is fully matched)
  const unchangedInA = new Set<Proof>();
  const unchangedInB = new Set<Proof>();

  function findMaximalA(i: number): void {
    if (i < 0) return;
    if (isFullyMatched(i)) {
      unchangedInA.add(nodesA[i].proof);
      unchangedInB.add(nodesB[matchA.get(i)!].proof);
      return; // don't recurse -- this is maximal
    }
    // Not fully matched: recurse into children
    // Children in post-order are in [leftmost[i], i-1]; find direct children
    // by walking the proof's subproofs
    for (const child of nodesA[i].proof.subproofs) {
      // Find the post-order index of this child
      const childIdx = nodesA.findIndex((n) => n.proof === child);
      if (childIdx >= 0) findMaximalA(childIdx);
    }
  }

  findMaximalA(nodesA.length - 1);
  return { unchangedInA, unchangedInB };
};

// ---------------------------------------------------------------------------
// Legacy common-subtree diff (kept for comparison/testing)
// ---------------------------------------------------------------------------

// Canonical token-sequence string for a proof node's concluded expression, memoized.
const keyCache = new WeakMap<Proof, string>();
function proofKey(p: Proof): string {
  let k = keyCache.get(p);
  if (k === undefined) {
    k = substitute(p.subst, p.rule).conclusion.join(" ");
    keyCache.set(p, k);
  }
  return k;
}

function collectKeys(p: Proof, out: Set<string>): void {
  out.add(proofKey(p));
  for (const sub of p.subproofs) collectKeys(sub, out);
}

function findMaximalMatches(
  p: Proof,
  available: Set<string>,
  out: Set<Proof>,
): void {
  if (available.has(proofKey(p))) {
    out.add(p);
    return; // don't recurse into matched subtree
  }
  for (const sub of p.subproofs) findMaximalMatches(sub, available, out);
}

/**
 * Common-subtree diff: marks as unchanged the maximal subtrees of a that appear
 * (by concluded expression) anywhere in b, and vice versa. O(n + m) with hashing.
 */
export const commonSubtreeDiff: DiffAlgorithm = (a, b) => {
  const keysA = new Set<string>();
  const keysB = new Set<string>();
  collectKeys(a, keysA);
  collectKeys(b, keysB);
  const unchangedInA = new Set<Proof>();
  const unchangedInB = new Set<Proof>();
  findMaximalMatches(a, keysB, unchangedInA);
  findMaximalMatches(b, keysA, unchangedInB);
  return { unchangedInA, unchangedInB };
};

// Cache: (a, b) -> DiffResult, keyed by object identity via nested WeakMaps.
const diffCache = new WeakMap<Proof, WeakMap<Proof, DiffResult>>();

/** Runs `algo(a, b)`, caching by object identity of a and b. */
export function cachedDiff(
  algo: DiffAlgorithm,
  a: Proof,
  b: Proof,
): DiffResult {
  let bMap = diffCache.get(a);
  if (!bMap) {
    bMap = new WeakMap();
    diffCache.set(a, bMap);
  }
  let result = bMap.get(b);
  if (!result) {
    result = algo(a, b);
    bMap.set(b, result);
  }
  return result;
}

/**
 * Returns the location-space spans of the "changed" regions of `proof`: all
 * token positions NOT covered by any node in `unchanged` (the maximal matched
 * subtrees). These are the gaps between (and outside) the unchanged spans.
 */
export function changedLocationSpans(
  proof: Proof,
  locationCount: number,
  unchanged: Set<Proof>,
): Span[] {
  const unchangedSpans: Span[] = [];
  let rootEnd = 0;

  function walk(p: Proof, start: number): number {
    let offset = start;
    let nextSub = 0;
    for (const tok of p.rule.conclusion.slice(1)) {
      if (p.subst.has(tok)) offset = walk(p.subproofs[nextSub++], offset);
      else offset += 1;
    }
    if (unchanged.has(p)) unchangedSpans.push([start, offset]);
    if (offset > rootEnd) rootEnd = offset;
    return offset;
  }

  walk(proof, 0);
  const base = locationCount - rootEnd;

  unchangedSpans.sort((x, y) => x[0] - y[0]);

  const changed: Span[] = [];
  let cursor = 0;
  for (const [s, e] of unchangedSpans) {
    if (cursor < s) changed.push([cursor + base, s + base]);
    cursor = cursor > e ? cursor : e;
  }
  if (cursor < rootEnd) changed.push([cursor + base, rootEnd + base]);
  return changed;
}
