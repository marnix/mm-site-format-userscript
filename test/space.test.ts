// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { insertSpacers } from "../src/space";
import { locateMathSpan } from "../src/token";

describe("insertSpacers", () => {
  const kinds = new Set(["wff"]);

  it("inserts a spacer before each non-zero-unit token; re-locating is stable", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    const located = locateMathSpan(span, kinds); // a(wff), ->, b(wff)
    expect(located.map((l) => l.token.text)).toEqual(["a", "->", "b"]);

    // one spacer, before "->" (units before each token: a=0, ->=1, b=0)
    insertSpacers(located, [0, 1, 0]);
    expect(span.querySelectorAll(".mm-site-format-space")).toHaveLength(1);

    // spacers are empty, so re-tokenizing the span yields the same tokens
    const relocated = locateMathSpan(span, kinds);
    expect(relocated.map((l) => l.token)).toEqual(located.map((l) => l.token));
  });

  it("does nothing when all units are zero", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 0, 0]);
    expect(span.querySelectorAll(".mm-site-format-space")).toHaveLength(0);
  });
});
