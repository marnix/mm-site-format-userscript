import { describe, expect, it } from "vitest";
import { parseExpression, type KindOf } from "../src/parse";
import { evaluate, type InferenceRule } from "../src/proof";

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
const rules = [wi, wb, top];

const wffVars = new Set(["ph", "ps", "ch", "th", "chi"]);
const kindOf: KindOf = (t) => (wffVars.has(t) ? "wff" : undefined);

describe("parseExpression", () => {
  it("parses the bitrdi assertion as a $TOP statement", () => {
    // |- ( ph -> ( ps <-> th ) )
    const tokens = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"];
    const proof = parseExpression(tokens, "$TOP", rules, kindOf);
    expect(proof).not.toBeNull();
    // Cross-check via the kernel: it must be a closed proof of the statement.
    const established = evaluate(proof!);
    expect(established.conclusion).toEqual([
      "$TOP", "|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")",
    ]); // prettier-ignore
    expect(established.assumptions).toEqual([]);
  });

  it("parses a bare wff expression directly (no $TOP)", () => {
    const tokens = ["(", "ph", "->", "ps", ")"];
    const proof = parseExpression(tokens, "wff", rules, kindOf);
    expect(proof).not.toBeNull();
    expect(evaluate(proof!).conclusion).toEqual([
      "wff", "(", "ph", "->", "ps", ")",
    ]); // prettier-ignore
  });

  it("returns null for a non-expression", () => {
    expect(parseExpression(["|-", "(", ")"], "$TOP", rules, kindOf)).toBeNull();
  });

  it("returns null when tokens are left over", () => {
    // trailing junk after a complete wff
    expect(
      parseExpression(["(", "ph", "->", "ps", ")", "ph"], "wff", rules, kindOf),
    ).toBeNull();
  });
});

describe("parseExpression with the cv coercion", () => {
  // cv: setvar x ==> class x ; co: ( class class class ) ; caddc: class +
  const cv: InferenceRule = {
    assumptions: [["setvar", "x"]],
    conclusion: ["class", "x"],
  };
  const co: InferenceRule = {
    assumptions: [
      ["class", "A"],
      ["class", "B"],
      ["class", "F"],
    ],
    conclusion: ["class", "(", "A", "F", "B", ")"],
  };
  const caddc: InferenceRule = { assumptions: [], conclusion: ["class", "+"] };
  const classRules = [cv, co, caddc];
  const kinds: KindOf = (t) =>
    t === "x" || t === "y"
      ? "setvar"
      : t === "A" || t === "B" || t === "F"
        ? "class"
        : undefined;

  it("parses a setvar in class position via cv: ( x + y )", () => {
    const proof = parseExpression(
      ["(", "x", "+", "y", ")"],
      "class",
      classRules,
      kinds,
    );
    expect(proof).not.toBeNull();
    const established = evaluate(proof!);
    expect(established.conclusion).toEqual(["class", "(", "x", "+", "y", ")"]);
    expect(established.assumptions).toEqual([]); // closed: leaves are setvar typings discharged by cv
  });
});

describe("parseExpression on deep nesting", () => {
  // `t` is a variable of type T; B is tried first and always fails after parsing
  // the inner hole (no `z` follows), forcing A to re-parse the same inner span --
  // which is 2^depth work without memoisation, but instant with it.
  const B: InferenceRule = {
    assumptions: [],
    conclusion: ["T", "(", "t", ")", "z"],
  };
  const A: InferenceRule = {
    assumptions: [],
    conclusion: ["T", "(", "t", ")"],
  };
  const kindOf: KindOf = (t) => (t === "t" ? "T" : undefined);

  it("does not blow up exponentially (memoisation)", () => {
    const depth = 40;
    const tokens = [...Array(depth).fill("("), "t", ...Array(depth).fill(")")];
    const proof = parseExpression(tokens, "T", [B, A], kindOf);
    expect(proof).not.toBeNull(); // A, nested `depth` deep
    expect(proof?.rule.conclusion.join(" ")).toBe("T ( t )");
  });
});
