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

  // Unicode pages already carry whitespace around their operators (e.g. the
  // text node " -> "). The spacer must REPLACE that existing space, not add to
  // it -- otherwise the gap is the page space plus the spacer's padding.
  it.fails(
    "replaces the page's existing whitespace instead of adding to it",
    () => {
      const span = document.createElement("span");
      span.innerHTML =
        '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
      insertSpacers(locateMathSpan(span, kinds), [0, 1, 0]);
      // The space before "->" is replaced by the spacer; the space after "->"
      // (gap 0) stays, so exactly one literal space remains (after the arrow).
      expect(span.textContent).toBe("a-> b");
    },
  );

  it.fails("replaces the whitespace on both sides of an operator", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 1]);
    expect(span.textContent).toBe("a->b");
  });

  it.fails("makes a single gap 0.3ex wide", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 0]);
    const spacer = span.querySelector(".mm-site-format-space") as HTMLElement;
    expect(spacer.style.paddingLeft).toBe("0.30ex");
  });
});
