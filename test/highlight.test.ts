// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPainter, findTokenAt, spanToHighlight } from "../src/highlight";
import { parseUniExpressions } from "../src/page";
import { readFixture } from "./helpers";

describe("spanToHighlight (mpeuni/bitrdi assertion)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpeuni", "bitrdi.html"),
    "text/html",
  );
  const fetcher = vi.fn(async (url: string) =>
    readFixture("mpeuni", url.split("/").pop()!),
  );

  it("picks the smallest sub-expression containing the hovered token", async () => {
    const results = await parseUniExpressions(
      doc,
      "https://us.metamath.org/mpeuni/bitrdi.html",
      fetcher,
    );
    // assertion: ⊢ ( 𝜑 → ( 𝜓 ↔ 𝜃 ) )
    // indices:    0 1 2  3 4 5  6 7 8 9
    const a = results[2];
    const n = a.locations.length;
    const at = (i: number) => spanToHighlight(a.proof!, n, i);

    expect(at(7)).toEqual([7, 8]); // 𝜃 → itself
    expect(at(6)).toEqual([4, 9]); // ↔ → ( 𝜓 ↔ 𝜃 )
    expect(at(3)).toEqual([1, 10]); // → → ( 𝜑 → ( 𝜓 ↔ 𝜃 ) )
    expect(at(0)).toEqual([0, 10]); // ⊢ → whole statement
  });

  it("maps a caret position to its token (variable element and bare text)", async () => {
    const results = await parseUniExpressions(
      doc,
      "https://us.metamath.org/mpeuni/bitrdi.html",
      fetcher,
    );
    const a = results[2];

    // index 7 is the 𝜃 variable (an element location); a caret inside its
    // child text node should resolve to that token.
    const phiLoc = a.locations[7];
    expect(phiLoc.type).toBe("element");
    if (phiLoc.type === "element") {
      const inner = phiLoc.node.firstChild!;
      expect(findTokenAt(a.locations, inner, 0)).toBe(7);
    }

    // index 6 is the ↔ operator (a bare-text location); a caret inside its
    // substring should resolve to it.
    const opLoc = a.locations[6];
    expect(opLoc.type).toBe("text");
    if (opLoc.type === "text") {
      expect(findTokenAt(a.locations, opLoc.node, opLoc.start)).toBe(6);
    }
  });
});

describe("createPainter", () => {
  // Minimal stand-ins for the CSS Custom Highlight API (happy-dom has neither).
  beforeEach(() => {
    (globalThis as unknown as { CSS: unknown }).CSS = {
      highlights: new Map<string, unknown>(),
    };
    (globalThis as unknown as { Highlight: unknown }).Highlight = class {
      add() {}
      clear() {}
    };
  });

  it("keeps one shared highlight registered across calls (a second painter must not replace it)", () => {
    const registered = () =>
      [
        ...(
          globalThis as unknown as { CSS: { highlights: Map<string, unknown> } }
        ).CSS.highlights.values(),
      ][0];

    expect(createPainter()).not.toBeNull();
    const first = registered();
    expect(createPainter()).not.toBeNull();
    const second = registered();

    expect(second).toBe(first); // the page's highlight stays registered
  });
});
