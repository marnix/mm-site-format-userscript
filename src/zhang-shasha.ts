// Zhang-Shasha tree edit distance algorithm.
// NOT imported by the main bundle (index.ts) -- kept as a candidate for future
// use and exercised only by tests. See DESIGN.md for context.

import type { Proof } from "./proof";
import type { DiffAlgorithm, DiffResult } from "./diff";

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
export function flatten(root: Proof): ZSNode[] {
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
export function zhangShashaMatching(
  nodesA: ZSNode[],
  nodesB: ZSNode[],
): [number, number][] {
  const m = nodesA.length;
  const n = nodesB.length;

  const krA = keyroots(nodesA);
  const krB = keyroots(nodesB);

  // Tree distance matrix
  // td[i][j] = edit distance between subtree rooted at i and subtree rooted at j
  const td: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

  // Operation enum for traceback
  const DEL = 0,
    INS = 1,
    MATCH = 2;

  // Forest distance + operation storage per keyroot pair
  type FDEntry = { cost: number; op: number };

  const fdStore = new Map<string, FDEntry[][]>();

  for (const krAi of krA) {
    for (const krBj of krB) {
      const lA = nodesA[krAi].leftmost;
      const lB = nodesB[krBj].leftmost;
      const sizeA = krAi - lA + 2;
      const sizeB = krBj - lB + 2;

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
        if (entry.op === DEL) {
          i--;
        } else if (entry.op === INS) {
          j--;
        } else {
          // op === MATCH: the sub-tree td[i][j] was used
          traceSubtree(i, j);
          i = lAi - 1;
          j = lBj - 1;
        }
      }
    }
  }

  function traceSubtree(i: number, j: number): void {
    const subA = nodesA.slice(nodesA[i].leftmost, i + 1);
    const subB = nodesB.slice(nodesB[j].leftmost, j + 1);

    const offsetA = nodesA[i].leftmost;
    const offsetB = nodesB[j].leftmost;

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
  for (const [ai, bi] of matching) {
    matchA.set(ai, bi);
  }

  // A subtree rooted at post-order index i spans [leftmost[i], i].
  // It's fully matched if every node in [leftmost[i], i] is matched and
  // maps bijectively to [partner's leftmost, partner].
  function isFullyMatched(i: number): boolean {
    if (!matchA.has(i)) return false;
    const j = matchA.get(i)!;
    const lA = nodesA[i].leftmost;
    const lB = nodesB[j].leftmost;
    const sizeA = i - lA + 1;
    const sizeB = j - lB + 1;
    if (sizeA !== sizeB) return false;

    for (let k = 0; k < sizeA; k++) {
      const ak = lA + k;
      const bk = lB + k;
      if (matchA.get(ak) !== bk) return false;
    }
    return true;
  }

  // Find maximal fully-matched subtrees in A
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
    for (const child of nodesA[i].proof.subproofs) {
      const childIdx = nodesA.findIndex((n) => n.proof === child);
      if (childIdx >= 0) findMaximalA(childIdx);
    }
  }

  findMaximalA(nodesA.length - 1);
  return { unchangedInA, unchangedInB };
};
