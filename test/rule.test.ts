// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { gifAssertionRule } from "../src/rule";
import { readFixture } from "./helpers";

function ruleOf(name: string) {
  const doc = new DOMParser().parseFromString(
    readFixture("mpegif", name),
    "text/html",
  );
  return gifAssertionRule(doc);
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
