import { describe, expect, it } from "vitest";
import { parseExpression, type KindOf } from "../src/parse";
import type { InferenceRule, Proof } from "../src/proof";
import { gapUnits, nodeSpans, smallestSpanContaining } from "../src/spans";

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

// |- ( ph -> ( ps <-> th ) )  -- token indices:
// 0:|-  1:(  2:ph  3:->  4:(  5:ps  6:<->  7:th  8:)  9:)
const tokens = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"];
const proof = parseExpression(tokens, "$TOP", rules, kindOf)!;

describe("nodeSpans", () => {
  it("gives each parse node its token range", () => {
    expect(new Set(nodeSpans(proof))).toEqual(
      new Set([
        [2, 3], // ph leaf
        [5, 6], // ps leaf
        [7, 8], // th leaf
        [4, 9], // wb: ( ps <-> th )
        [1, 10], // wi: ( ph -> ( ps <-> th ) )
        [0, 10], // $TOP: whole statement
      ]),
    );
  });
});

describe("smallestSpanContaining", () => {
  const spans = nodeSpans(proof);
  const at = (i: number) => smallestSpanContaining(spans, i);

  it("a variable highlights just itself", () => {
    expect(at(7)).toEqual([7, 8]); // th
  });

  it("an inner operator highlights its sub-expression", () => {
    expect(at(6)).toEqual([4, 9]); // <-> -> ( ps <-> th )
  });

  it("the outer operator highlights the whole wff", () => {
    expect(at(3)).toEqual([1, 10]); // -> -> ( ph -> ( ps <-> th ) )
  });

  it("the turnstile highlights the whole statement", () => {
    expect(at(0)).toEqual([0, 10]);
  });
});

function makeLeaf(typecode: string, token: string): Proof {
  return {
    rule: { assumptions: [], conclusion: [typecode, token] },
    subst: new Map(),
    subproofs: [],
  };
}

describe("gapUnits", () => {
  it("puts space around the outer operator, none around the inner one", () => {
    // spacing: leaves -1; ( ps <-> th ) = 0; ( ph -> ... ) = 1.
    // 1 unit before "->" and before the "(" after it (symmetric around "->");
    // 0 around "<->"; nothing at brackets or the turnstile.
    expect(gapUnits(proof)).toEqual([
      0, // |-
      0, // (
      0, // ph
      1, // -> (after ph)
      1, // (  (before the inner subexpression)
      0, // ps
      0, // <->
      0, // th
      0, // )
      0, // )
    ]);
  });

  it("no space between ∩ and { when applied to a class abstraction", () => {
    // ∩ { x ∈ B | P } — cint(crab(x, B, P))
    // cint pattern ["∩", "A"]: single hole at end, not interior, gap = 0.
    const cintRule: InferenceRule = {
      assumptions: [["class", "A"]],
      conclusion: ["class", "∩", "A"],
    };
    const crabRule: InferenceRule = {
      assumptions: [
        ["setvar", "x"],
        ["class", "B"],
        ["wff", "P"],
      ],
      conclusion: ["class", "{", "x", "∈", "B", "|", "P", "}"],
    };
    const crabProof: Proof = {
      rule: crabRule,
      subst: new Map([
        ["x", ["setvar", "x"]],
        ["B", ["class", "B"]],
        ["P", ["wff", "P"]],
      ]),
      subproofs: [
        makeLeaf("setvar", "x"),
        makeLeaf("class", "B"),
        makeLeaf("wff", "P"),
      ],
    };
    const cintProof: Proof = {
      rule: cintRule,
      subst: new Map([["A", ["class", "A"]]]),
      subproofs: [crabProof],
    };
    // tokens: ∩  {  x  ∈  B  |  P  }
    //         0  1  2  3  4  5  6  7
    expect(gapUnits(cintProof)[1]).toBe(0);
  });

  it("no space between successive ( in a nested conjunction", () => {
    // ( ( C ∧ D ) ∧ B ) — wa(wa(C, D), B)
    // outer wa pattern ["(", "A", "∧", "B", ")"]: first hole at j=1,
    // interior check j-1=0 >= firstHole=1 is false → gap = 0.
    const waRule: InferenceRule = {
      assumptions: [
        ["wff", "A"],
        ["wff", "B"],
      ],
      conclusion: ["wff", "(", "A", "∧", "B", ")"],
    };
    const innerWa: Proof = {
      rule: waRule,
      subst: new Map([
        ["A", ["wff", "C"]],
        ["B", ["wff", "D"]],
      ]),
      subproofs: [makeLeaf("wff", "C"), makeLeaf("wff", "D")],
    };
    const outerWa: Proof = {
      rule: waRule,
      subst: new Map([
        ["A", ["wff", "A"]],
        ["B", ["wff", "B"]],
      ]),
      subproofs: [innerWa, makeLeaf("wff", "B")],
    };
    // tokens: (  (  C  ∧  D  )  ∧  B  )
    //         0  1  2  3  4  5  6  7  8
    expect(gapUnits(outerWa)[1]).toBe(0);
  });

  it.fails("symmetric spacing around ↔ when both sides are equally complex", () => {
    // ( r ∈ On <-> s ∈ On ) — wb(wcel(r, On), wcel(s, On))
    // Both sides have spacing 0; wb has spacing 1.
    // Requirement: gap before first operand = gap before second operand.
    // Currently fails: units[1]=0 (not interior), units[5]=1 (interior).
    const wcelRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "B"],
      ],
      conclusion: ["wff", "A", "∈", "B"],
    };
    const wcelLeft: Proof = {
      rule: wcelRule,
      subst: new Map([
        ["A", ["class", "r"]],
        ["B", ["class", "On"]],
      ]),
      subproofs: [makeLeaf("class", "r"), makeLeaf("class", "On")],
    };
    const wcelRight: Proof = {
      rule: wcelRule,
      subst: new Map([
        ["A", ["class", "s"]],
        ["B", ["class", "On"]],
      ]),
      subproofs: [makeLeaf("class", "s"), makeLeaf("class", "On")],
    };
    const wbProof: Proof = {
      rule: wb,
      subst: new Map([
        ["ph", ["wff", "r", "∈", "On"]],
        ["ps", ["wff", "s", "∈", "On"]],
      ]),
      subproofs: [wcelLeft, wcelRight],
    };
    // tokens: (  r  ∈  On  <->  s  ∈  On  )
    //         0  1  2   3    4   5  6   7  8
    const units = gapUnits(wbProof);
    expect(units[1]).toBe(units[5]);
  });

  it("no space right after ( in wb(wcel, wcel)", () => {
    // ( r ∈ On <-> s ∈ On ) — same proof as symmetry test above.
    // units[1] is the gap before the first token of the left operand, right after (.
    const wcelRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "B"],
      ],
      conclusion: ["wff", "A", "∈", "B"],
    };
    const wcelLeft: Proof = {
      rule: wcelRule,
      subst: new Map([
        ["A", ["class", "r"]],
        ["B", ["class", "On"]],
      ]),
      subproofs: [makeLeaf("class", "r"), makeLeaf("class", "On")],
    };
    const wcelRight: Proof = {
      rule: wcelRule,
      subst: new Map([
        ["A", ["class", "s"]],
        ["B", ["class", "On"]],
      ]),
      subproofs: [makeLeaf("class", "s"), makeLeaf("class", "On")],
    };
    const wbProof: Proof = {
      rule: wb,
      subst: new Map([
        ["ph", ["wff", "r", "∈", "On"]],
        ["ps", ["wff", "s", "∈", "On"]],
      ]),
      subproofs: [wcelLeft, wcelRight],
    };
    // tokens: (  r  ∈  On  <->  s  ∈  On  )
    //         0  1  2   3    4   5  6   7  8
    expect(gapUnits(wbProof)[1]).toBe(0);
  });
});
