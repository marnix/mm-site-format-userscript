// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { gifAssertionRule, uniAssertionRule } from "../src/rule";
import { readFixture } from "./helpers";

function ruleOf(name: string) {
  const doc = new DOMParser().parseFromString(
    readFixture("mpegif", name),
    "text/html",
  );
  return gifAssertionRule(doc);
}

function uniRuleOf(name: string) {
  const doc = new DOMParser().parseFromString(
    readFixture("mpeuni", name),
    "text/html",
  );
  return uniAssertionRule(doc);
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

describe("uniAssertionRule", () => {
  it("extracts wi with Unicode glyphs (→, 𝜑, 𝜓)", () => {
    expect(uniRuleOf("wi.html")).toEqual({
      assumptions: [
        ["wff", "𝜑"],
        ["wff", "𝜓"],
      ],
      conclusion: ["wff", "(", "𝜑", "→", "𝜓", ")"],
    });
  });
});
