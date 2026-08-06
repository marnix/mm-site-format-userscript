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

  it("removes the page's whitespace even where the gap is zero", () => {
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
  it("replaces the page's existing whitespace instead of adding to it", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 0]);
    // The spacer replaces the space before "->"; the space after "->" (gap 0)
    // is also removed, so no literal space remains.
    expect(span.textContent).toBe("a->b");
  });

  it("replaces the whitespace on both sides of an operator", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 1]);
    expect(span.textContent).toBe("a->b");
  });

  it("makes a single gap 0.5ex wide", () => {
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="wff">a</span> -&gt; <span class="wff">b</span>';
    insertSpacers(locateMathSpan(span, kinds), [0, 1, 0]);
    const spacer = span.querySelector(".mm-site-format-space") as HTMLElement;
    expect(spacer.style.paddingLeft).toBe("0.5ex");
  });

  it("anchors consecutive inline-element tokens at their own element (nmulprop csb brackets)", () => {
    // nmulprop step 62 renders the csb brackets as adjacent <b> elements
    // (\u298c = ]_ and \u298b = [_). The second token's characters inherit the
    // first's element position, so both tokens end up at the same DOM anchor and
    // insertSpacers piles both spacers before the first <b> -- the gap looks
    // doubled, and the token between the two spacers loses its own gap.
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="setvar">c</span><b>\u298c</b><b>\u298b</b><span class="setvar">v</span>';
    // Vocab-based splitting (as on a real page): neither bracket is a constant,
    // so the run-together \u298c\u298b splits into two single-char tokens.
    const located = locateMathSpan(span, new Set(["setvar"]), new Set([")"]));
    expect(located.map((l) => l.token.text)).toEqual([
      "c",
      "\u298c",
      "\u298b",
      "v",
    ]);

    insertSpacers(located, [0, 9, 9, 0]);

    const bars = span.querySelectorAll("b");
    const spacers = span.querySelectorAll(".mm-site-format-space");
    expect(spacers).toHaveLength(2);
    const [beforeRib, beforeLbr] = Array.from(spacers);
    expect(bars[0].previousElementSibling).toBe(beforeRib);
    expect(beforeRib.previousElementSibling).toHaveProperty(
      "className",
      "setvar",
    );
    expect(bars[1].previousElementSibling).toBe(beforeLbr);
    expect(beforeLbr.previousElementSibling).toBe(bars[0]);

    // Re-locating is stable: the two spacers do not merge or drop tokens.
    const relocated = locateMathSpan(span, new Set(["setvar"]));
    expect(relocated.map((l) => l.token.text)).toEqual([
      "c",
      "\u298c",
      "\u298b",
      "v",
    ]);
  });

  it("anchors an inline-element token after a <b> at its own element (nmulprop csb then \u2229)", () => {
    // Same fold bug via a <font>-wrapped \u2229 following a <b> bracket: the
    // \u2229's characters inherited the bracket's element position, so both
    // spacers landed before the <b> and the gap before \u2229 disappeared.
    const span = document.createElement("span");
    span.innerHTML =
      '<span class="setvar">d</span><b>\u298c</b><font size="+1">\u2229</font><span class="setvar">x</span>';
    const located = locateMathSpan(span, new Set(["setvar"]), new Set([")"]));
    expect(located.map((l) => l.token.text)).toEqual([
      "d",
      "\u298c",
      "\u2229",
      "x",
    ]);

    insertSpacers(located, [0, 8, 8, 0]);

    const spacers = span.querySelectorAll(".mm-site-format-space");
    expect(spacers).toHaveLength(2);
    const [beforeRib, beforeInt] = Array.from(spacers);
    const rib = span.querySelector("b")!;
    const inter = span.querySelector("font")!;
    expect(rib.previousElementSibling).toBe(beforeRib);
    expect(inter.previousElementSibling).toBe(beforeInt);
    expect(beforeInt.previousElementSibling).toBe(rib);
  });
});
