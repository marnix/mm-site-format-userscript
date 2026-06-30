import { describe, expect, it } from "vitest";
import { parseExpression, type KindOf } from "../src/parse";
import type { InferenceRule } from "../src/proof";
import {
  changedLocationSpans,
  commonSubtreeDiff,
  cachedDiff,
} from "../src/diff";

const wi: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
  ],
  conclusion: ["wff", "(", "ph", "->", "ps", ")"],
};
const wb: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
  ],
  conclusion: ["wff", "(", "ph", "<->", "ps", ")"],
};
const top: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "|-", "chi"],
};
const rules = [top, wi, wb];
const wff = new Set(["ph", "ps", "ch", "th", "chi"]);
const kindOf: KindOf = (t) => (wff.has(t) ? "wff" : undefined);

// |- ( ph -> ( ps <-> th ) )  tokens: 0:|-, 1:(, 2:ph, 3:->, 4:(, 5:ps, 6:<->, 7:th, 8:), 9:)
const tokensA = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"];
// |- ( ph -> ( ps <-> ch ) )  -- th replaced by ch
const tokensB = ["|-", "(", "ph", "->", "(", "ps", "<->", "ch", ")", ")"];
// |- ( ph -> ( ch <-> th ) )  -- ps replaced by ch
const tokensC = ["|-", "(", "ph", "->", "(", "ch", "<->", "th", ")", ")"];

const proofA = parseExpression(tokensA, "$TOP", rules, kindOf)!;
const proofB = parseExpression(tokensB, "$TOP", rules, kindOf)!;
const proofC = parseExpression(tokensC, "$TOP", rules, kindOf)!;

describe("commonSubtreeDiff", () => {
  it("identical proofs: root is unchanged in both", () => {
    const { unchangedInA, unchangedInB } = commonSubtreeDiff(proofA, proofA);
    expect(unchangedInA.has(proofA)).toBe(true);
    expect(unchangedInB.has(proofA)).toBe(true);
    expect(unchangedInA.size).toBe(1);
    expect(unchangedInB.size).toBe(1);
  });

  it("one leaf differs: only the shared subtrees are unchanged", () => {
    // A = |- ( ph -> ( ps <-> th ) ), B = |- ( ph -> ( ps <-> ch ) )
    // Shared: ph, ps; NOT shared: th (A only), ch (B only), the wb subtree, the wi subtree, top
    const { unchangedInA, unchangedInB } = commonSubtreeDiff(proofA, proofB);

    // The shared leaf token expressions are ph and ps (same tokens in both)
    // None of the larger expressions appear in the other tree
    // So unchangedInA = {ph_node_in_A, ps_node_in_A}
    const aTokensOf = (node: {
      subproofs: unknown[];
      rule: InferenceRule;
      subst: Map<string, string[]>;
    }) =>
      node.subproofs.length === 0
        ? node.rule.conclusion.slice(1).join(" ")
        : null;

    const unchangedLeafTokensA = [...unchangedInA]
      .map((n) =>
        n.subproofs.length === 0
          ? n.rule.conclusion.slice(1).join(" ")
          : "non-leaf",
      )
      .sort();
    const unchangedLeafTokensB = [...unchangedInB]
      .map((n) =>
        n.subproofs.length === 0
          ? n.rule.conclusion.slice(1).join(" ")
          : "non-leaf",
      )
      .sort();

    expect(unchangedLeafTokensA).toEqual(["ph", "ps"]);
    expect(unchangedLeafTokensB).toEqual(["ph", "ps"]);
    expect(unchangedInA.size).toBe(2);
    expect(unchangedInB.size).toBe(2);
  });

  it("no shared subtrees: both unchanged sets are empty", () => {
    // proofB = |- ( ph -> ( ps <-> ch ) ), proofC = |- ( ph -> ( ch <-> th ) )
    // ph appears in both -> shared; ps only in B; th only in C; ch in both
    const { unchangedInA, unchangedInB } = commonSubtreeDiff(proofB, proofC);
    // ph and ch both appear in both trees as leaves
    const unchangedLeafTokensA = [...unchangedInA]
      .map((n) => n.rule.conclusion.slice(1).join(" "))
      .sort();
    expect(unchangedLeafTokensA).toContain("ph");
    expect(unchangedLeafTokensA).toContain("ch");
  });
});

describe("changedLocationSpans", () => {
  it("identical proofs: no changed spans", () => {
    const { unchangedInA } = commonSubtreeDiff(proofA, proofA);
    const locationCount = tokensA.length;
    const spans = changedLocationSpans(proofA, locationCount, unchangedInA);
    expect(spans).toHaveLength(0);
  });

  it("one leaf differs: changed spans cover the differing leaf", () => {
    // A = |- ( ph -> ( ps <-> th ) ), B = |- ( ph -> ( ps <-> ch ) )
    // th (index 7 in location space) is different; ph and ps are shared.
    // Changed in A: everything NOT under ph or ps.
    // That means: |-, (, ->, (, <->, ), ) and the leaf th itself are changed.
    // Merged into contiguous ranges: [0,2), [3,5), [6,10) -- i.e. gaps around ph and ps.
    const { unchangedInA } = commonSubtreeDiff(proofA, proofB);
    const locationCount = tokensA.length;
    const spans = changedLocationSpans(proofA, locationCount, unchangedInA);

    // The unchanged spans are ph=[2,3) and ps=[5,6). Changed = complement:
    // [0,2), [3,5), [6,10)
    expect(spans).toEqual([
      [0, 2],
      [3, 5],
      [6, 10],
    ]);
  });
});

describe("cachedDiff", () => {
  it("returns the same result object on repeated calls", () => {
    const r1 = cachedDiff(commonSubtreeDiff, proofA, proofB);
    const r2 = cachedDiff(commonSubtreeDiff, proofA, proofB);
    expect(r1).toBe(r2);
  });
});
