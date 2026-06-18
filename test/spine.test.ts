import { describe, expect, it } from "vitest";
import type { InferenceRule, Proof } from "../src/proof";
import { chooseSpine, isSmallStep, structuralOverlap } from "../src/spine";

const rule = (conclusion: string[]): InferenceRule => ({
  assumptions: [],
  conclusion,
});
const leaf = (kind: string, name: string): Proof => ({
  rule: rule([kind, name]),
  subst: new Map(),
  subproofs: [],
});
const node = (conclusion: string[], ...subproofs: Proof[]): Proof => ({
  rule: rule(conclusion),
  subst: new Map(),
  subproofs,
});

// Rule conclusion patterns (only the pattern matters to the overlap).
const WI = ["wff", "(", "ph", "->", "ps", ")"];
const WB = ["wff", "(", "ph", "<->", "ps", ")"];
const WA = ["wff", "(", "ph", "/\\", "ps", ")"];
const WCEL = ["wff", "A", "e.", "B"];
const WCEQ = ["wff", "A", "=", "B"];
const CXP = ["class", "(", "A", "X.", "B", ")"];
const COP = ["class", "<.", "A", ",", "B", ">."];

describe("structuralOverlap", () => {
  it("counts matching nodes top-down, leaf<->leaf included", () => {
    const a = node(WI, leaf("wff", "ph"), leaf("wff", "ps"));
    const b = node(WI, leaf("wff", "ph"), leaf("wff", "th"));
    expect(structuralOverlap(a, b)).toBe(3); // wi + ph + (ps<->th, both leaves)
  });

  it("is 0 when the roots apply different rules", () => {
    const wi = node(WI, leaf("wff", "ph"), leaf("wff", "ps"));
    const wceq = node(WCEQ, leaf("class", "A"), leaf("class", "B"));
    expect(structuralOverlap(wi, wceq)).toBe(0);
  });

  it("is 0 for leaf vs node", () => {
    const wb = node(WB, leaf("wff", "ph"), leaf("wff", "ps"));
    expect(structuralOverlap(leaf("wff", "ps"), wb)).toBe(0);
  });
});

describe("chooseSpine", () => {
  it("optocl: spines to the hypothesis sharing the assertion's shape (.3)", () => {
    // assertion ( A in D -> psi )
    const assertion = node(
      WI,
      node(WCEL, leaf("class", "A"), leaf("class", "D")),
      leaf("wff", "ps"),
    );
    const h1 = node(
      WCEQ,
      leaf("class", "D"),
      node(CXP, leaf("class", "B"), leaf("class", "C")),
    ); // D = ( B x C )
    const h2 = node(
      WI,
      node(
        WCEQ,
        node(COP, leaf("set", "x"), leaf("set", "y")),
        leaf("class", "A"),
      ),
      node(WB, leaf("wff", "ph"), leaf("wff", "ps")),
    ); // ( <x,y> = A -> ( phi <-> psi ) ) -- compound consequent
    const h3 = node(
      WI,
      node(
        WA,
        node(WCEL, leaf("set", "x"), leaf("class", "B")),
        node(WCEL, leaf("set", "y"), leaf("class", "C")),
      ),
      leaf("wff", "ph"),
    ); // ( ( x in B /\ y in C ) -> phi ) -- variable consequent, like the assertion

    expect(
      chooseSpine(assertion, [
        { parse: h1, trivial: false },
        { parse: h2, trivial: false },
        { parse: h3, trivial: false },
      ]),
    ).toBe(2); // optocl.3
  });

  it("bitrd: equal overlap -> prefers the non-trivial (derived) sub-proof", () => {
    const concl = node(
      WI,
      leaf("wff", "ph"),
      node(WB, leaf("wff", "ps"), leaf("wff", "th")),
    );
    const hyp = node(
      WI,
      leaf("wff", "ph"),
      node(WB, leaf("wff", "ps"), leaf("wff", "ch")),
    ); // bitrdi.1
    const a1i = node(
      WI,
      leaf("wff", "ph"),
      node(WB, leaf("wff", "ch"), leaf("wff", "th")),
    ); // step 3
    expect(
      chooseSpine(concl, [
        { parse: hyp, trivial: true },
        { parse: a1i, trivial: false },
      ]),
    ).toBe(1);
  });

  it("two equal-size non-trivial sub-proofs tied at the max -> none (bitrd-like)", () => {
    const concl = node(WI, leaf("wff", "ph"), leaf("wff", "ps"));
    const a = node(WI, leaf("wff", "ph"), leaf("wff", "ch"));
    const b = node(WI, leaf("wff", "ch"), leaf("wff", "ps"));
    expect(
      chooseSpine(concl, [
        { parse: a, trivial: false },
        { parse: b, trivial: false },
      ]),
    ).toBeNull();
  });

  it("mpbid: overlap ties, so the smaller premise (psi, not the rewrite psi<->chi) wins", () => {
    // conclusion ( phi -> chi ); premises ( phi -> psi ) and ( phi -> ( psi <-> chi ) )
    const chi = node(WA, leaf("wff", "a"), leaf("wff", "b"));
    const psi = node(WCEL, leaf("class", "x"), leaf("class", "y"));
    const concl = node(WI, leaf("wff", "ph"), chi);
    const p17 = node(WI, leaf("wff", "ph"), psi); // ( phi -> psi )
    const p18 = node(WI, leaf("wff", "ph"), node(WB, psi, chi)); // ( phi -> ( psi <-> chi ) )
    // Both overlap the conclusion by 2 (wi + phi; the consequent diverges), but
    // p17 is smaller, so it is the spine -- not an end-of-spine.
    expect(
      chooseSpine(concl, [
        { parse: p17, trivial: false },
        { parse: p18, trivial: false },
      ]),
    ).toBe(0);
  });
});

describe("isSmallStep", () => {
  const toks = (s: string) => s.split(" ");

  it("is small when the continuation barely differs", () => {
    // ( ph -> ps ) <== ( ph -> th ): same tokens but one.
    expect(isSmallStep(toks("( ph -> ps )"), toks("( ph -> th )"))).toBe(true);
  });

  it("is small for a definitional unfolding (eleq2i): the premise's tokens reappear in the conclusion", () => {
    // ( R e. Rels <-> R e. P ( V X. V ) ) <== Rels = P ( V X. V )
    const conclusion = toks("( R e. Rels <-> R e. P ( V X. V ) )");
    const premise = toks("Rels = P ( V X. V )");
    expect(isSmallStep(conclusion, premise)).toBe(true);
  });

  it("is not small when the premise is much larger than the conclusion", () => {
    // a step that collapses a big expression to a small one adds information.
    const conclusion = toks("( ph -> ps )");
    const premise = toks("( ( ph -> ps ) -> ( ch -> ( th -> ta ) ) )");
    expect(isSmallStep(conclusion, premise)).toBe(false);
  });
});
