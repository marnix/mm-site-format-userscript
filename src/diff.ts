// Tree diff for consecutive calculation expressions: finds the maximal common
// subtrees between two parse trees and computes which token spans are "changed".
// The algorithm is pluggable; the default is common-subtree matching.

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
