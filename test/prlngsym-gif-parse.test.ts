// @vitest-environment happy-dom
//
// Tests for GIF page prlngsym.html expression parsing. Simulates the tokens and
// kinds that the GIF page would produce, without needing image sampling.
// Uses manually constructed grammar rules matching what GIF syntax pages yield.
//
// These tests confirm that the parser correctly handles expressions with .||
// (the parallel-lines operator) and complex sub-expressions (C_, i^i, (/)) when
// given correct token kinds. The GIF page's colour sampling (canvasSampler)
// is the only remaining link in the chain that could fail in the real browser.

import { describe, expect, it } from "vitest";
import { parseExpression, type KindOf } from "../src/parse";
import type { InferenceRule } from "../src/proof";
import { GIF_TOP_RULE } from "../src/database-assumptions";

// Rules extracted from GIF syntax pages (verified against the live pages).
// Each rule has: conclusion = [type, ...tokens], assumptions = [[type, var], ...]
const GIF_SYNTAX_RULES: InferenceRule[] = [
  // wi: wff ( ph -> ps )
  {
    conclusion: ["wff", "(", "ph", "->", "ps", ")"],
    assumptions: [
      ["wff", "ph"],
      ["wff", "ps"],
    ],
  },
  // wb: wff ( ph <-> ps )
  {
    conclusion: ["wff", "(", "ph", "<->", "ps", ")"],
    assumptions: [
      ["wff", "ph"],
      ["wff", "ps"],
    ],
  },
  // wa: wff ( ph /\ ps )
  {
    conclusion: ["wff", "(", "ph", "/\\", "ps", ")"],
    assumptions: [
      ["wff", "ph"],
      ["wff", "ps"],
    ],
  },
  // wo: wff ( ph \/ ps )
  {
    conclusion: ["wff", "(", "ph", "\\/", "ps", ")"],
    assumptions: [
      ["wff", "ph"],
      ["wff", "ps"],
    ],
  },
  // wbr: wff A R B
  {
    conclusion: ["wff", "A", "R", "B"],
    assumptions: [
      ["class", "A"],
      ["class", "R"],
      ["class", "B"],
    ],
  },
  // wceq: wff A = B
  {
    conclusion: ["wff", "A", "=", "B"],
    assumptions: [
      ["class", "A"],
      ["class", "B"],
    ],
  },
  // wcel: wff A e. B
  {
    conclusion: ["wff", "A", "e.", "B"],
    assumptions: [
      ["class", "A"],
      ["class", "B"],
    ],
  },
  // wss: wff A C_ B
  {
    conclusion: ["wff", "A", "C_", "B"],
    assumptions: [
      ["class", "A"],
      ["class", "B"],
    ],
  },
  // wrex: wff E. x e. A ph
  {
    conclusion: ["wff", "E.", "x", "e.", "A", "ph"],
    assumptions: [
      ["setvar", "x"],
      ["class", "A"],
      ["wff", "ph"],
    ],
  },
  // cv: class x (setvar to class coercion)
  { conclusion: ["class", "x"], assumptions: [["setvar", "x"]] },
  // cin: class ( A i^i B )
  {
    conclusion: ["class", "(", "A", "i^i", "B", ")"],
    assumptions: [
      ["class", "A"],
      ["class", "B"],
    ],
  },
  // c0: class (/)
  { conclusion: ["class", "(/)"], assumptions: [] },
  // crn: class ran A
  { conclusion: ["class", "ran", "A"], assumptions: [["class", "A"]] },
  // cfv: class ( A ` B )
  {
    conclusion: ["class", "(", "A", "`", "B", ")"],
    assumptions: [
      ["class", "A"],
      ["class", "B"],
    ],
  },
];

// Sort non-TOP rules by conclusion length descending (same as assembleGrammar)
const SORTED_RULES: InferenceRule[] = GIF_SYNTAX_RULES.slice();
SORTED_RULES.sort((a, b) => b.conclusion.length - a.conclusion.length);
const ALL_RULES = [GIF_TOP_RULE, ...SORTED_RULES];

// Kind assignments from GIF image colour sampling on prlngsym.html:
// - class (204,51,204): A, B, E, G, L, V, .||
// - setvar (255,0,0): h
// - wff (0,0,255): ph
// - null/constant (0,0,0): all operators
const GIF_TOKEN_KINDS: Record<string, string> = {
  A: "class",
  B: "class",
  E: "class",
  G: "class",
  L: "class",
  V: "class",
  ".||": "class",
  h: "setvar",
  ph: "wff",
};

/** Builds a kindOf function merging token kinds with grammar-rule assumptions. */
function buildKindOf(rules: InferenceRule[]): KindOf {
  const registry = new Map<string, string>();
  for (const [token, kind] of Object.entries(GIF_TOKEN_KINDS)) {
    registry.set(token, kind);
  }
  for (const rule of rules) {
    for (const a of rule.assumptions) {
      if (a.length === 2) registry.set(a[1], a[0]);
    }
  }
  return (token) => registry.get(token);
}

describe("prlngsym GIF expression parsing", () => {
  const kindOf = buildKindOf(ALL_RULES);

  it("parses A .|| B as wff via wbr", () => {
    const tokens = ["A", ".||", "B"];
    const proof = parseExpression(tokens, "wff", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
    // Check it used the wbr-shaped rule
    expect(proof!.rule.conclusion).toEqual(["wff", "A", "R", "B"]);
  });

  it("parses |- ( ph -> A .|| B ) (assertion)", () => {
    const tokens = ["|-", "(", "ph", "->", "A", ".||", "B", ")"];
    const proof = parseExpression(tokens, "$TOP", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
  });

  it("parses ( A C_ h /\\ B C_ h )", () => {
    const tokens = ["(", "A", "C_", "h", "/\\", "B", "C_", "h", ")"];
    const proof = parseExpression(tokens, "wff", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
  });

  it("parses ( A i^i B ) = (/)", () => {
    const tokens = ["(", "A", "i^i", "B", ")", "=", "(/)"];
    const proof = parseExpression(tokens, "wff", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
  });

  it("parses E. h e. ran E ( A C_ h /\\ B C_ h )", () => {
    const tokens = [
      "E.",
      "h",
      "e.",
      "ran",
      "E",
      "(",
      "A",
      "C_",
      "h",
      "/\\",
      "B",
      "C_",
      "h",
      ")",
    ];
    const proof = parseExpression(tokens, "wff", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
  });

  it("parses step 6 full expression", () => {
    // |- ( ph -> ( A .|| B <-> ( ( A e. ran L /\ B e. ran L ) /\
    //   ( A = B \/ ( E. h e. ran E ( A C_ h /\ B C_ h ) /\
    //   ( A i^i B ) = (/) ) ) ) ) )
    const tokens = [
      "|-",
      "(",
      "ph",
      "->",
      "(",
      "A",
      ".||",
      "B",
      "<->",
      "(",
      "(",
      "A",
      "e.",
      "ran",
      "L",
      "/\\",
      "B",
      "e.",
      "ran",
      "L",
      ")",
      "/\\",
      "(",
      "A",
      "=",
      "B",
      "\\/",
      "(",
      "E.",
      "h",
      "e.",
      "ran",
      "E",
      "(",
      "A",
      "C_",
      "h",
      "/\\",
      "B",
      "C_",
      "h",
      ")",
      "/\\",
      "(",
      "A",
      "i^i",
      "B",
      ")",
      "=",
      "(/)",
      ")",
      ")",
      ")",
      ")",
      ")",
    ];
    const proof = parseExpression(tokens, "$TOP", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
  });

  it("parses step 25 (the theorem conclusion): |- ( ph -> B .|| A )", () => {
    const tokens = ["|-", "(", "ph", "->", "B", ".||", "A", ")"];
    const proof = parseExpression(tokens, "$TOP", ALL_RULES, kindOf);
    expect(proof).not.toBeNull();
  });
});
