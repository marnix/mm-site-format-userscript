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

  it.fails("removes the page's whitespace even where the gap is zero", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 0, 0]);
    // No spacer is inserted, but the page's own space around "->" is removed
    // all the same -- page whitespace never lingers beside a calculated gap.
    expect(span.querySelectorAll(".mm-site-format-space")).toHaveLength(0);
    expect(span.textContent).toBe("a->b");
  });

  // Unicode pages already carry whitespace around their operators (e.g. the
  // text node " -> "). The spacer must REPLACE that existing space, not add to
  // it -- otherwise the gap is the page space plus the spacer's padding. The
  // replacement is unconditional: whitespace is removed whether or not a spacer
  // is inserted for the gap.
  it.fails(
    "replaces the page's existing whitespace instead of adding to it",
    () => {
      const span = document.createElement("span");
      span.innerHTML =
        '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
      insertSpacers(locateMathSpan(span, kinds), [0, 1, 0]);
      // The spacer replaces the space before "->"; the space after "->" (gap 0)
      // is also removed, so no literal space remains.
      expect(span.textContent).toBe("a->b");
    },
  );

  it("replaces the whitespace on both sides of an operator", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 1]);
    expect(span.textContent).toBe("a->b");
  });

  it("makes a single gap 0.3ex wide", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 0]);
    const spacer = span.querySelector(".mm-site-format-space") as HTMLElement;
    expect(spacer.style.paddingLeft).toBe("0.3ex");
  });
});
