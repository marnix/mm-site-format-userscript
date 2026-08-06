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
const csb: InferenceRule = {
  assumptions: [
    ["class", "A"],
    ["setvar", "x"],
    ["class", "B"],
  ],
  conclusion: ["class", "[_", "A", "/", "x", "]_", "B"],
};
const wsbc: InferenceRule = {
  assumptions: [
    ["class", "A"],
    ["setvar", "x"],
    ["wff", "ph"],
  ],
  conclusion: ["wff", "[.", "A", "/", "x", "].", "ph"],
};
const wsb: InferenceRule = {
  assumptions: [
    ["setvar", "y"],
    ["setvar", "x"],
    ["wff", "ph"],
  ],
  conclusion: ["wff", "[", "y", "/", "x", "]", "ph"],
};
const ccom: InferenceRule = {
  assumptions: [
    ["class", "A"],
    ["class", "B"],
  ],
  conclusion: ["class", "(", "A", "\u2218", "B", ")"],
};
const cmpo: InferenceRule = {
  assumptions: [
    ["setvar", "x"],
    ["class", "A"],
    ["setvar", "y"],
    ["class", "B"],
    ["class", "C"],
  ],
  conclusion: [
    "class",
    "(",
    "x",
    "\u2208",
    "A",
    ",",
    "y",
    "\u2208",
    "B",
    "\u21a6",
    "C",
    ")",
  ],
};
const cmpt: InferenceRule = {
  assumptions: [
    ["setvar", "x"],
    ["class", "A"],
    ["class", "C"],
  ],
  conclusion: ["class", "(", "x", "\u2208", "A", "\u21a6", "C", ")"],
};
const crab: InferenceRule = {
  assumptions: [
    ["setvar", "x"],
    ["class", "A"],
    ["wff", "ph"],
  ],
  conclusion: ["class", "{", "x", "\u2208", "A", "|", "ph", "}"],
};
const whad: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
    ["wff", "ch"],
  ],
  conclusion: ["wff", "hadd", "(", "ph", ",", "ps", ",", "ch", ")"],
};
const w3a: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
    ["wff", "ch"],
  ],
  conclusion: ["wff", "(", "ph", "\u2227", "ps", "\u2227", "ch", ")"],
};
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
  it("more space around the outer operator, a minimum unit for the inner one", () => {
    // spacing: leaves -1; ( ps <-> th ) = 0; ( ph -> ... ) = 1.
    // 1 unit before "->" and before the "(" after it (symmetric around "->");
    // "<->" between two leaf wffs has subtree height 0, but an infix operator
    // must still get at least 1 unit -- otherwise the page's whitespace is
    // removed and the operator renders glued to its operands. Nothing at
    // brackets or the turnstile.
    expect(gapUnits(proof)).toEqual([
      0, // |-
      0, // (
      0, // ph
      1, // -> (after ph)
      1, // (  (before the inner subexpression)
      0, // ps
      1, // <->
      1, // th
      0, // )
      0, // )
    ]);
  });

  it("ccom: a leaf-level literal operator gets a minimum unit on both sides", () => {
    // ccom is class ( A \u2218 B ); applied to two leaf classes it renders
    // ( F \u2218 G ). The operator's subtree height is 0 (leaf operands), yet the
    // two gaps around \u2218 must still get at least 1 unit -- with 0 units the
    // page's whitespace is removed and the composition renders as (F\u2218G).
    const ccomRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "B"],
      ],
      conclusion: ["class", "(", "A", "\u2218", "B", ")"],
    };
    const kindOf: KindOf = (t) =>
      ["A", "B", "F", "G"].includes(t) ? "class" : undefined;
    const proof = parseExpression(
      ["(", "F", "\u2218", "G", ")"],
      "class",
      [ccomRule],
      kindOf,
    )!;
    // tokens: (  F  \u2218  G  )
    //         0  1  2    3  4
    const units = gapUnits(proof);
    expect(units[2]).toBeGreaterThan(0); // before \u2218
    expect(units[3]).toBeGreaterThan(0); // before G (after \u2218)
  });

  it("co: an operator hole ( A F B ) gets a minimum unit on both sides", () => {
    // co is class ( A F B ): the operator F is a HOLE -- a sub-expression filled
    // by a class constant like +no (cnadd), not a literal pattern token -- so the
    // literal-infix detection does not fire and every gap comes out 0, which the
    // page's whitespace removal turns into (A+noB). An operator hole (a hole with
    // a hole on each side) must space its two adjacent gaps exactly like a
    // literal operator: spacingOf(co) = 0 here (three leaf operands), floored to
    // the minimum 1 unit. Nothing at the brackets.
    const coRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "F"],
        ["class", "B"],
      ],
      conclusion: ["class", "(", "A", "F", "B", ")"],
    };
    const cnadd: InferenceRule = {
      assumptions: [],
      conclusion: ["class", "+no"],
    };
    const kindOf: KindOf = (t) =>
      ["A", "B", "F"].includes(t) ? "class" : undefined;
    const proof = parseExpression(
      ["(", "A", "+no", "B", ")"],
      "class",
      [coRule, cnadd],
      kindOf,
    )!;
    // tokens: (  A  +no  B  )
    //         0  1  2   3  4
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0]);
  });

  it("co: nested operator holes keep the level-based spacing", () => {
    // ( A +no ( B +no C ) ): the outer co's right operand is a whole inner co
    // (height 0), so spacingOf(outer co) = 1 and spacingOf(inner co) = 0 -- both
    // floored to the minimum 1 unit. Every +no gap is 1; the brackets stay tight.
    const coRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "F"],
        ["class", "B"],
      ],
      conclusion: ["class", "(", "A", "F", "B", ")"],
    };
    const cnadd: InferenceRule = {
      assumptions: [],
      conclusion: ["class", "+no"],
    };
    const kindOf: KindOf = (t) =>
      ["A", "B", "C", "F"].includes(t) ? "class" : undefined;
    const proof = parseExpression(
      ["(", "A", "+no", "(", "B", "+no", "C", ")", ")"],
      "class",
      [coRule, cnadd],
      kindOf,
    )!;
    // tokens: (  A  +no  (  B  +no  C  )  )
    //         0  1  2   3  4  5   6  7  8
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0, 1, 1, 0, 0]);
  });

  it("csuc: a word-like prefix literal gets one unit after it", () => {
    // csuc is class suc A -- pattern ["suc", "A"]: a literal of 2+ alphabetic
    // characters immediately followed by its single hole. The prefix gap is not
    // adjacent to an operator, so gapUnits gives it 0 and the page's whitespace
    // removal glues the word to its operand (sucA). A word-like prefix literal
    // must keep a full unit after it -- the site renders suc A and Fun A with a
    // space, but never tight like the single-symbol -.A.
    const csucRule: InferenceRule = {
      assumptions: [["class", "A"]],
      conclusion: ["class", "suc", "A"],
    };
    const kindOf: KindOf = (t) => (t === "A" ? "class" : undefined);
    const proof = parseExpression(["suc", "A"], "class", [csucRule], kindOf)!;
    // tokens: suc  A
    //         0    1
    expect(gapUnits(proof)).toEqual([0, 1]);
  });

  it("wn: a symbol prefix stays tight", () => {
    // wn is wff -. ph -- the prefix literal -. is a symbol, not a word-like
    // prefix (2+ alphabetic characters), so the gap after it stays 0 and the
    // operand renders glued (-.ph), matching the site's tight -.A.
    const wnRule: InferenceRule = {
      assumptions: [["wff", "ph"]],
      conclusion: ["wff", "-.", "ph"],
    };
    const kindOf: KindOf = (t) => (t === "ph" ? "wff" : undefined);
    const proof = parseExpression(["-.", "ph"], "wff", [wnRule], kindOf)!;
    // tokens: -.  ph
    //         0    1
    expect(gapUnits(proof)).toEqual([0, 0]);
  });

  it("a one-letter prefix literal stays tight", () => {
    // A unary prefix whose literal is a single alphabetic character is not a
    // word-like prefix -- only 2+ characters qualify -- so it stays tight like a
    // symbol prefix. No such rule exists in set.mm (synthetic here); it guards
    // the "2+ alphabetic characters" half of the word-prefix rule.
    const oneLetterRule: InferenceRule = {
      assumptions: [["class", "A"]],
      conclusion: ["class", "l", "A"],
    };
    const kindOf: KindOf = (t) => (t === "A" ? "class" : undefined);
    const proof = parseExpression(
      ["l", "A"],
      "class",
      [oneLetterRule],
      kindOf,
    )!;
    // tokens: l  A
    //         0  1
    expect(gapUnits(proof)).toEqual([0, 0]);
  });

  it("csuc: prefix spacing stays one unit even over a large operand", () => {
    // suc ( A +no B ): the prefix's operand is a whole co application (subtree
    // height 0), but the gap after suc stays exactly 1 unit -- a word-prefix
    // space is a fixed word boundary, not an operator level, so it does not
    // grow with the operand's height. The +no operator keeps its own minimum 1.
    const csucRule: InferenceRule = {
      assumptions: [["class", "A"]],
      conclusion: ["class", "suc", "A"],
    };
    const coRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "F"],
        ["class", "B"],
      ],
      conclusion: ["class", "(", "A", "F", "B", ")"],
    };
    const cnadd: InferenceRule = {
      assumptions: [],
      conclusion: ["class", "+no"],
    };
    const kindOf: KindOf = (t) =>
      ["A", "B", "F"].includes(t) ? "class" : undefined;
    const proof = parseExpression(
      ["suc", "(", "A", "+no", "B", ")"],
      "class",
      [csucRule, coRule, cnadd],
      kindOf,
    )!;
    // tokens: suc  (  A  +no  B  )
    //         0    1  2  3   4  5
    expect(gapUnits(proof)).toEqual([0, 1, 0, 1, 1, 0]);
  });

  it("wral: the gap between the domain and body variables gets one unit", () => {
    // wral is wff A. x e. A ph -- pattern [A., x, e., A, ph]. The gap before
    // ph (between the two adjacent variables A and ph) is not operator-
    // adjacent, so gapUnits gives it 0 and the page's whitespace removal
    // glues the body to the domain (A ph -> Aph). An adjacent-variable gap
    // must get one unit, like the site's A. x e. A ph.
    const wralRule: InferenceRule = {
      assumptions: [
        ["setvar", "x"],
        ["class", "A"],
        ["wff", "ph"],
      ],
      conclusion: ["wff", "A.", "x", "e.", "A", "ph"],
    };
    const kindOf: KindOf = (t) =>
      t === "x"
        ? "setvar"
        : t === "A"
          ? "class"
          : t === "ph"
            ? "wff"
            : undefined;
    const proof = parseExpression(
      ["A.", "x", "e.", "A", "ph"],
      "wff",
      [wralRule],
      kindOf,
    )!;
    // tokens: A.  x  e.  A  ph
    //         0   1  2   3  4
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 1]);
  });

  it("wal: the gap between the bound and body variables gets one unit", () => {
    // wal is wff A. x ph -- pattern [A., x, ph]: the body ph is a variable
    // immediately after the bound variable x. The gap between them is an
    // adjacent-variable gap and gets one unit like every other.
    const walRule: InferenceRule = {
      assumptions: [
        ["setvar", "x"],
        ["wff", "ph"],
      ],
      conclusion: ["wff", "A.", "x", "ph"],
    };
    const kindOf: KindOf = (t) =>
      t === "x" ? "setvar" : t === "ph" ? "wff" : undefined;
    const proof = parseExpression(["A.", "x", "ph"], "wff", [walRule], kindOf)!;
    // tokens: A.  x  ph
    //         0   1  2
    expect(gapUnits(proof)).toEqual([0, 0, 1]);
  });

  it("adjacent-variable spacing stays one unit over a large body", () => {
    // A. x ( ph -> ( ps -> ch ) ): the body is a nested wi (subtree height 1),
    // but the gap between the bound variable x and the body stays exactly 1
    // unit -- an adjacent-variable gap is a plain word space, not an operator
    // level, so it does not grow with the body's height (spacingOf(wal) is 2).
    const walRule: InferenceRule = {
      assumptions: [
        ["setvar", "x"],
        ["wff", "ph"],
      ],
      conclusion: ["wff", "A.", "x", "ph"],
    };
    const kindOf: KindOf = (t) =>
      t === "x" ? "setvar" : wff.has(t) ? "wff" : undefined;
    const proof = parseExpression(
      ["A.", "x", "(", "ph", "->", "(", "ps", "->", "ch", ")", ")"],
      "wff",
      [walRule, wi],
      kindOf,
    )!;
    // tokens: A.  x  (  ph  ->  (  ps  ->  ch  )  )
    //         0   1  2  3   4  5  6   7  8   9  10
    expect(gapUnits(proof)).toEqual([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0]);
  });

  it("no space between \u2229 and { when applied to a class abstraction", () => {
    // \u2229 { x \u2208 B | P } \u2014 cint(crab(x, B, P))
    // cint pattern ["\u2229", "A"]: single hole at end, not interior, gap = 0.
    const cintRule: InferenceRule = {
      assumptions: [["class", "A"]],
      conclusion: ["class", "\u2229", "A"],
    };
    const crabRule: InferenceRule = {
      assumptions: [
        ["setvar", "x"],
        ["class", "B"],
        ["wff", "P"],
      ],
      conclusion: ["class", "{", "x", "\u2208", "B", "|", "P", "}"],
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
    // tokens: \u2229  {  x  \u2208  B  |  P  }
    //         0  1  2  3  4  5  6  7
    expect(gapUnits(cintProof)[1]).toBe(0);
  });

  it("no space between successive ( in a nested conjunction", () => {
    // ( ( C \u2227 D ) \u2227 B ) \u2014 wa(wa(C, D), B)
    // outer wa pattern ["(", "A", "\u2227", "B", ")"]: first hole at j=1,
    // interior check j-1=0 >= firstHole=1 is false \u2192 gap = 0.
    const waRule: InferenceRule = {
      assumptions: [
        ["wff", "A"],
        ["wff", "B"],
      ],
      conclusion: ["wff", "(", "A", "\u2227", "B", ")"],
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
    // tokens: (  (  C  \u2227  D  )  \u2227  B  )
    //         0  1  2  3  4  5  6  7  8
    expect(gapUnits(outerWa)[1]).toBe(0);
  });

  it("symmetric spacing around \u2194 when both sides are equally complex", () => {
    // ( r \u2208 On <-> s \u2208 On ) \u2014 wb(wcel(r, On), wcel(s, On))
    // Both sides have spacing 0; wb has spacing 1.
    // Requirement: an infix operator gives both adjacent gaps the same value,
    // the operator's own spacing -- so the gap before <-> equals the gap before
    // the right operand (here 1 on both sides).
    const wcelRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "B"],
      ],
      conclusion: ["wff", "A", "\u2208", "B"],
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
        ["ph", ["wff", "r", "\u2208", "On"]],
        ["ps", ["wff", "s", "\u2208", "On"]],
      ]),
      subproofs: [wcelLeft, wcelRight],
    };
    // tokens: (  r  \u2208  On  <->  s  \u2208  On  )
    //         0  1  2   3    4   5  6   7  8
    const units = gapUnits(wbProof);
    expect(units[4]).toBe(units[5]);
    expect(units[4]).toBe(1);
  });

  it("no space right after ( in wb(wcel, wcel)", () => {
    // ( r \u2208 On <-> s \u2208 On ) \u2014 same proof as symmetry test above.
    // units[1] is the gap before the first token of the left operand, right after (.
    const wcelRule: InferenceRule = {
      assumptions: [
        ["class", "A"],
        ["class", "B"],
      ],
      conclusion: ["wff", "A", "\u2208", "B"],
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
        ["ph", ["wff", "r", "\u2208", "On"]],
        ["ps", ["wff", "s", "\u2208", "On"]],
      ]),
      subproofs: [wcelLeft, wcelRight],
    };
    // tokens: (  r  \u2208  On  <->  s  \u2208  On  )
    //         0  1  2   3    4   5  6   7  8
    expect(gapUnits(wbProof)[1]).toBe(0);
  });

  // csb is class [_ A / x ]_ B -- pattern [ [_ A / x ]_ B ]. The _] literal
  // has a hole on each side, so the operator rule gives it and the operand a
  // spacing unit; but the site renders [_ A / x ]_ B as "\u298bA / x\u298cB"
  // with only the / spaced. A subscript-bracket constructor: the pattern ends with a
  // literal close-bracket followed by its operand and contains an interior
  // separator literal (the /, a literal between the first and last constant
  // with a hole on each side). The close bracket is tight on both sides and
  // the separator is a fixed 1 unit.
  const subscriptKindOf: KindOf = (t) =>
    t === "x" || t === "y"
      ? "setvar"
      : t === "A" || t === "B" || t === "C"
        ? "class"
        : wff.has(t)
          ? "wff"
          : undefined;

  it("csb: a subscript-bracket constructor keeps its brackets tight", () => {
    const proof = parseExpression(
      ["[_", "A", "/", "x", "]_", "B"],
      "class",
      [csb],
      subscriptKindOf,
    )!;
    // tokens: [_  A  /  x  ]_  B
    //         0   1  2  3  4   5
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0, 0]);
  });

  it("wsbc: [. A / x ]. ph spaces like a subscript bracket", () => {
    const proof = parseExpression(
      ["[.", "A", "/", "x", "].", "ph"],
      "wff",
      [wsbc],
      subscriptKindOf,
    )!;
    // tokens: [.  A  /  x  ].  ph
    //         0   1  2  3  4   5
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0, 0]);
  });

  it("wsb: [ y / x ] ph spaces like a subscript bracket", () => {
    const proof = parseExpression(
      ["[", "y", "/", "x", "]", "ph"],
      "wff",
      [wsb],
      subscriptKindOf,
    )!;
    // tokens: [  y  /  x  ]  ph
    //         0  1  2  3  4  5
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0, 0]);
  });

  it("csb: the separator stays fixed and the close bracket tight over a complex operand", () => {
    const proof = parseExpression(
      ["[_", "A", "/", "x", "]_", "(", "B", "\u2218", "C", ")"],
      "class",
      [csb, ccom],
      subscriptKindOf,
    )!;
    // tokens: [_  A  /  x  ]_  (  B  \u2218  C  )
    //         0   1  2  3  4  5  6  7     8  9
    // The outer csb is a class of height 1 (its operand is a height-0
    // ccom), so an operator rule would scale the / to 2 units; the
    // subscript-bracket rule keeps it a fixed 1 and the ]_ tight.
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0, 0, 0, 1, 1, 0]);
  });

  it("csb: nested csb keeps both close brackets tight", () => {
    const proof = parseExpression(
      ["[_", "A", "/", "x", "]_", "[_", "B", "/", "y", "]_", "C"],
      "class",
      [csb],
      subscriptKindOf,
    )!;
    // tokens: [_  A  /  x  ]_  [_  B  /  y  ]_  C
    //         0   1  2  3  4   5  6  7  8  9   10
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0]);
  });

  it("cmpo: a binder constructor keeps its separators fixed with leaf operands", () => {
    // cmpo is class ( x \u2208 A , y \u2208 B \u21a6 C ) -- pattern
    // [ ( x \u2208 A , y \u2208 B \u21a6 C ) ]. Two separators (\u2208, \u21a6)
    // plus a comma, each a literal between the first and last constant with a
    // hole on each side. Like csb it is a constructor, not an operator: the
    // brackets are tight and the separator phrase is a fixed 1-unit word
    // spacing. With leaf operands the operator rule happens to agree (its
    // spacing is floored to 1), so this guards the leaf case.
    const proof = parseExpression(
      ["(", "x", "\u2208", "A", ",", "y", "\u2208", "B", "\u21a6", "C", ")"],
      "class",
      [cmpo],
      subscriptKindOf,
    )!;
    // tokens: (  x  \u2208  A  ,  y  \u2208  B  \u21a6  C  )
    //         0  1  2    3  4  5  6    7  8     9  10
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  });

  it("cmpo: binder separators stay fixed 1 over a deep body", () => {
    // ( x \u2208 A , y \u2208 B \u21a6 ( ( C \u2218 A ) \u2218 B ) ): the body is a
    // height-1 ccom, so an operator rule would scale every \u2208, the commas
    // and the \u21a6 to 2 units; the binder rule keeps the separator phrase a
    // fixed 1 and lets the body carry the depth (its own \u2218s keep their
    // level spacing). The gap before the body is the fixed 1 after \u21a6.
    const proof = parseExpression(
      [
        "(",
        "x",
        "\u2208",
        "A",
        ",",
        "y",
        "\u2208",
        "B",
        "\u21a6",
        "(",
        "(",
        "C",
        "\u2218",
        "A",
        ")",
        "\u2218",
        "B",
        ")",
        ")",
      ],
      "class",
      [cmpo, ccom],
      subscriptKindOf,
    )!;
    // tokens: (  x  \u2208  A  ,  y  \u2208  B  \u21a6  (  (  C  \u2218  A  )  \u2218  B  )  )
    //         0  1  2    3  4  5  6    7  8     9 10 11  12    13 14 15    16 17 18
    expect(gapUnits(proof)).toEqual([
      0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0,
    ]);
  });

  it("cmpt: the binder separators stay fixed 1 over a deep body", () => {
    // cmpt is class ( x \u2208 A \u21a6 C ). Same constructor as cmpo with a
    // single \u2208 plus \u21a6: fixed 1 over the deep body, which carries the
    // depth.
    const proof = parseExpression(
      [
        "(",
        "x",
        "\u2208",
        "A",
        "\u21a6",
        "(",
        "(",
        "C",
        "\u2218",
        "A",
        ")",
        "\u2218",
        "B",
        ")",
        ")",
      ],
      "class",
      [cmpt, ccom],
      subscriptKindOf,
    )!;
    // tokens: (  x  \u2208  A  \u21a6  (  (  C  \u2218  A  )  \u2218  B  )  )
    //         0  1  2    3  4  5  6  7  8    9 10 11    12 13 14
    expect(gapUnits(proof)).toEqual([
      0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0,
    ]);
  });

  it("crab: a brace binder keeps its separators fixed 1 over a deep body", () => {
    // crab is class { x \u2208 A | ph } -- pattern [ { x \u2208 A | ph } ].
    // \u2208 and | are separators, so it is a constructor: the brackets are tight
    // and the separator phrase fixed 1, with the deep body carrying the depth.
    const proof = parseExpression(
      [
        "{",
        "x",
        "\u2208",
        "A",
        "|",
        "(",
        "(",
        "ph",
        "->",
        "ps",
        ")",
        "->",
        "ch",
        ")",
        "}",
      ],
      "class",
      [crab, wi],
      subscriptKindOf,
    )!;
    // tokens: {  x  \u2208  A  |  (  (  ph  ->  ps  )  ->  ch  )  }
    //         0  1  2    3  4  5  6  7   8   9 10 11  12 13 14
    expect(gapUnits(proof)).toEqual([
      0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0,
    ]);
  });

  it("w3a: a ternary conjunction with leaf operands keeps every \u2227 at one unit", () => {
    // ( ph \u2227 ps \u2227 ch ): all operands are leaves, so spacingOf(w3a)
    // is 0, floored to the minimum 1 unit -- the same flat gaps a fixed-1
    // phrase would have. Guards the leaf case while the operator rule holds.
    const proof = parseExpression(
      ["(", "ph", "\u2227", "ps", "\u2227", "ch", ")"],
      "wff",
      [w3a],
      subscriptKindOf,
    )!;
    // tokens: (  ph  \u2227  ps  \u2227  ch  )
    //         0  1   2   3   4   5   6
    expect(gapUnits(proof)).toEqual([0, 0, 1, 1, 1, 1, 0]);
  });

  it.fails(
    "w3a: a ternary conjunction is an operator, scaling \u2227 with the chain level",
    () => {
      // ( ph \u2227 ps \u2227 ( ( ch -> th ) -> ps ) ): a flattened n-ary
      // conjunction is one operator, so every \u2227 gap is the chain's level
      // spacingOf(w3a) = 2 (its deepest conjunct is a height-1 wi), not a fixed
      // 1. The deep conjunct keeps its own operator spacing.
      const proof = parseExpression(
        [
          "(",
          "ph",
          "\u2227",
          "ps",
          "\u2227",
          "(",
          "(",
          "ch",
          "->",
          "th",
          ")",
          "->",
          "ps",
          ")",
          ")",
        ],
        "wff",
        [w3a, wi],
        subscriptKindOf,
      )!;
      // tokens: (  ph  \u2227  ps  \u2227  (  (  ch  ->  th  )  ->  ps  )  )
      //         0  1   2   3   4   5  6  7   8   9 10 11   12 13 14
      expect(gapUnits(proof)).toEqual([
        0, 0, 2, 2, 2, 2, 0, 0, 1, 1, 0, 1, 1, 0, 0,
      ]);
    },
  );

  it.fails(
    "whad: a ternary function call is an operator, scaling its commas",
    () => {
      // hadd( ph , ps , ( ( ch -> th ) -> ps ) ): like w3a the pattern is
      // homogeneous (all wff), so it is not a binder constructor and its commas
      // scale with the call's level spacingOf(whad) = 2 over a height-1 body.
      const proof = parseExpression(
        [
          "hadd",
          "(",
          "ph",
          ",",
          "ps",
          ",",
          "(",
          "(",
          "ch",
          "->",
          "th",
          ")",
          "->",
          "ps",
          ")",
          ")",
        ],
        "wff",
        [whad, wi],
        subscriptKindOf,
      )!;
      // tokens: hadd  (  ph  ,  ps  ,  (  (  ch  ->  th  )  ->  ps  )  )
      //         0     1  2   3  4   5  6  7  8   9  10 11 12  13 14 15
      expect(gapUnits(proof)).toEqual([
        0, 0, 0, 2, 2, 2, 2, 0, 0, 1, 1, 0, 1, 1, 0, 0,
      ]);
    },
  );
});
