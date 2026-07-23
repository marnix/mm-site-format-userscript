// Unicode tokens used in test expressions (GIF names from set.mm $t):
//   \u22a2=|- \u2192=-> \u2194=<-> \u2208=e. \u2018=` (function value)
//   \u03c0=pi \u211d=RR \u21be=|`s (restriction) \u2191=^ (up-arrow)
//   \u266f=# (hash) \u21150=NN0 \u2115=NN
//   \u{1d434}=A \u{1d435}=B \u{1d439}=F \u{1d441}=N \u{1d445}=R
//   \u{1d711}=ph \u{1d712}=ch \u{1d713}=ps \u{1d703}=th \u{1d45f}=r
import { describe, expect, it } from "vitest";
import { parseChunks, parseExpression, type KindOf } from "../src/parse";
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

describe("parseChunks with concatenated constants", () => {
  // Mimics the fouriersw.html scenario: (-pi(,)pi) where \u03c0 = pi is a
  // constant from cpi, (,) is a zero-variable constant from cioo, and the
  // outer parens are from co (operation value).
  // Other tokens: \u211d = RR (reals), \u{1d434} = A, \u21be = |`s (restriction)
  const cpi: InferenceRule = {
    assumptions: [],
    conclusion: ["class", "\u03c0"],
  };
  const cr: InferenceRule = {
    assumptions: [],
    conclusion: ["class", "\u211d"],
  };
  const cdv: InferenceRule = { assumptions: [], conclusion: ["class", "D"] };
  const cioo: InferenceRule = {
    assumptions: [],
    conclusion: ["class", "(", ",", ")"],
  };
  const cneg: InferenceRule = {
    assumptions: [["class", "\u{1d434}"]],
    conclusion: ["class", "-", "\u{1d434}"],
  };
  const co: InferenceRule = {
    assumptions: [
      ["class", "\u{1d434}"],
      ["class", "\u{1d439}"],
      ["class", "\u{1d435}"],
    ],
    conclusion: ["class", "(", "\u{1d434}", "\u{1d439}", "\u{1d435}", ")"],
  };
  const cres: InferenceRule = {
    assumptions: [
      ["class", "\u{1d434}"],
      ["class", "\u{1d435}"],
    ],
    conclusion: ["class", "(", "\u{1d434}", "\u21be", "\u{1d435}", ")"],
  };
  const wceq: InferenceRule = {
    assumptions: [
      ["class", "\u{1d434}"],
      ["class", "\u{1d435}"],
    ],
    conclusion: ["wff", "\u{1d434}", "=", "\u{1d435}"],
  };
  const topRule: InferenceRule = {
    assumptions: [["wff", "chi"]],
    conclusion: ["$TOP", "\u22a2", "chi"],
  };
  // Sort by conclusion length DESC (as assembleUniGrammar does)
  const rules = [topRule, co, cres, wceq, cneg, cioo, cpi, cr, cdv].sort(
    (a, b) => b.conclusion.length - a.conclusion.length,
  );
  const chunkKindOf: KindOf = (t) => {
    if (t === "\u{1d434}" || t === "\u{1d435}" || t === "\u{1d439}")
      return "class";
    if (t === "chi") return "wff";
    return undefined;
  };

  it("parses (-\u03c0(,)\u03c0) from a single text chunk", () => {
    const chunks: import("../src/token").Chunk[] = [
      { kind: null, text: "(-\u03c0(,)\u03c0)" },
    ];
    const proof = parseChunks(chunks, "class", rules, chunkKindOf);
    expect(proof).not.toBeNull();
    const established = evaluate(proof!);
    expect(established.conclusion).toEqual([
      "class",
      "(",
      "-",
      "\u03c0",
      "(",
      ",",
      ")",
      "\u03c0",
      ")",
    ]);
  });

  it("parses the full fouriersw expression with multi-chunk layout", () => {
    // Chunks as produced by chunkifyMathSpan on the real fouriersw HTML:
    // \u22a2 ((\u211d\nD <F>) \u21be\n(-\u03c0(,)\u03c0)) = ((\u211d D <F>) \u21be (-\u03c0(,)\u03c0))
    const chunks: import("../src/token").Chunk[] = [
      { kind: null, text: "\u22a2 ((\u211d\nD " },
      { kind: "class", text: "\u{1d439}" },
      { kind: null, text: ") \u21be\n(-\u03c0(,)\u03c0)) = ((\u211d D " },
      { kind: "class", text: "\u{1d439}" },
      { kind: null, text: ") \u21be (-\u03c0(,)\u03c0))" },
    ];
    const proof = parseChunks(chunks, "$TOP", rules, chunkKindOf);
    expect(proof).not.toBeNull();
  });

  it("parses when \u{1d439} is also registered as a class variable in kindOf", () => {
    // In the real page, \u{1d439} appears as a variable SPAN so buildChunkKindRegistry
    // registers kindOf("\u{1d439}") = "class". This must NOT interfere with the co rule
    // where \u{1d439} is a pattern variable name.
    const realKindOf: KindOf = (t) => {
      if (t === "\u{1d434}" || t === "\u{1d435}" || t === "\u{1d439}")
        return "class";
      if (t === "chi") return "wff";
      return undefined;
    };
    const chunks: import("../src/token").Chunk[] = [
      { kind: null, text: "\u22a2 ((\u211d\nD " },
      { kind: "class", text: "\u{1d439}" },
      { kind: null, text: ") \u21be\n(-\u03c0(,)\u03c0)) = ((\u211d D " },
      { kind: "class", text: "\u{1d439}" },
      { kind: null, text: ") \u21be (-\u03c0(,)\u03c0))" },
    ];
    const proof = parseChunks(chunks, "$TOP", rules, realKindOf);
    expect(proof).not.toBeNull();
  });

  it("parses (\u266f'A) \u2208 \u21150 with multi-char constants", () => {
    // \u21150 = NN0 (rendered as \u2115 + subscript 0, folded into one token)
    // \u266f = # (hash/cardinality)
    // \u2208 = e. (element of)
    // \u2018 = ` (function value tick)
    // \u2192 = -> (implies)
    const cn0: InferenceRule = {
      assumptions: [],
      conclusion: ["class", "\u21150"],
    };
    const chash: InferenceRule = {
      assumptions: [],
      conclusion: ["class", "\u266f"],
    };
    const cfin: InferenceRule = {
      assumptions: [],
      conclusion: ["class", "Fin"],
    };
    const cfvRule: InferenceRule = {
      assumptions: [
        ["class", "\u{1d434}"],
        ["class", "\u{1d439}"],
      ],
      conclusion: ["class", "(", "\u{1d439}", "\u2018", "\u{1d434}", ")"],
    };
    const wcelRule: InferenceRule = {
      assumptions: [
        ["class", "\u{1d434}"],
        ["class", "\u{1d435}"],
      ],
      conclusion: ["wff", "\u{1d434}", "\u2208", "\u{1d435}"],
    };
    const wiRule: InferenceRule = {
      assumptions: [
        ["wff", "\u{1d711}"],
        ["wff", "\u{1d713}"],
      ],
      conclusion: ["wff", "(", "\u{1d711}", "\u2192", "\u{1d713}", ")"],
    };
    const topR: InferenceRule = {
      assumptions: [["wff", "chi"]],
      conclusion: ["$TOP", "\u22a2", "chi"],
    };
    const localRules = [topR, wiRule, wcelRule, cfvRule, cn0, chash, cfin].sort(
      (a, b) => b.conclusion.length - a.conclusion.length,
    );
    const localKindOf: KindOf = (t) => {
      if (t === "\u{1d434}" || t === "\u{1d435}" || t === "\u{1d439}")
        return "class";
      if (t === "\u{1d711}" || t === "\u{1d713}" || t === "chi") return "wff";
      return undefined;
    };
    // \u22a2 (\u{1d434} \u2208 Fin \u2192 (\u266f'\u{1d434}) \u2208 \u21150)
    const chunks: import("../src/token").Chunk[] = [
      { kind: null, text: "\u22a2 (" },
      { kind: "class", text: "\u{1d434}" },
      { kind: null, text: " \u2208 Fin \u2192\n(\u266f\u2018" },
      { kind: "class", text: "\u{1d434}" },
      { kind: null, text: ") \u2208\n\u21150)" },
    ];
    const proof = parseChunks(chunks, "$TOP", localRules, localKindOf);
    expect(proof).not.toBeNull();
  });
});
