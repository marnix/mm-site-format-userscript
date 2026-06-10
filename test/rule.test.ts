// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseKindColors } from "../src/kind";
import { gifAssertionRule, ruleFromTokens } from "../src/rule";
import { gifSampler, readFixture } from "./helpers";

function parse(name: string): Document {
  return new DOMParser().parseFromString(
    readFixture("mpegif", name),
    "text/html",
  );
}

function ruleOf(name: string) {
  const doc = parse(name);
  return gifAssertionRule(doc, parseKindColors(doc), gifSampler("mpegif"));
}

describe("gifAssertionRule", () => {
  it("extracts wi: wff ph & wff ps ==> wff ( ph -> ps )", () => {
    expect(ruleOf("wi.html")).toEqual({
      assumptions: [
        ["wff", "ph"],
        ["wff", "ps"],
      ],
      conclusion: ["wff", "(", "ph", "->", "ps", ")"],
    });
  });

  it("extracts wb: wff ph & wff ps ==> wff ( ph <-> ps )", () => {
    expect(ruleOf("wb.html")).toEqual({
      assumptions: [
        ["wff", "ph"],
        ["wff", "ps"],
      ],
      conclusion: ["wff", "(", "ph", "<->", "ps", ")"],
    });
  });

  it("extracts a nullary class-constant: ==> class Rels", () => {
    expect(ruleOf("crels.html")).toEqual({
      assumptions: [],
      conclusion: ["class", "Rels"],
    });
  });
});

describe("ruleFromTokens", () => {
  it("collects each distinct variable once as an assumption", () => {
    const rule = ruleFromTokens([
      { kind: null, text: "wff" },
      { kind: null, text: "(" },
      { kind: "wff", text: "ph" },
      { kind: null, text: "->" },
      { kind: "wff", text: "ph" }, // repeated variable
      { kind: null, text: ")" },
    ]);
    expect(rule.assumptions).toEqual([["wff", "ph"]]);
    expect(rule.conclusion).toEqual(["wff", "(", "ph", "->", "ph", ")"]);
  });
});
