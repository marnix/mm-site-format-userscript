// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPainter,
  findTokenAt,
  installHover,
  spanToHighlight,
  tokenAtPoint,
  type Highlighter,
} from "../src/highlight";
import { parseUniExpressions, type ParsedExpression } from "../src/page";
import type { Proof } from "../src/proof";
import type { TokenLocation } from "../src/token";
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

describe("tokenAtPoint (GIF: image tokens + bare-text tokens like Disj)", () => {
  // A GIF expression mixes image tokens (e.g. Rel) with bare-text tokens (e.g.
  // Disj, which has no .gif). Build one of each and stub the pointer APIs that
  // happy-dom does not implement.
  function setup() {
    const img = document.createElement("img"); // an image token, e.g. "Rel"
    const text = document.createTextNode(" Disj "); // a bare-text token
    document.body.append(img, text);
    const locations: TokenLocation[] = [
      { type: "element", node: img },
      { type: "text", node: text, start: 1, end: 5 }, // "Disj"
    ];
    return { img, text, locations };
  }

  it("resolves an image token under the pointer", () => {
    const { img, locations } = setup();
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint =
      () => img;
    expect(tokenAtPoint(locations, 10, 10)).toBe(0);
  });

  it("resolves a bare-text token (Disj) via the caret when no token element is under the pointer", () => {
    const { text, locations } = setup();
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint =
      () => document.body; // the container, not a token element
    (
      document as unknown as { caretPositionFromPoint: unknown }
    ).caretPositionFromPoint = () => ({ offsetNode: text, offset: 2 });
    expect(tokenAtPoint(locations, 10, 10)).toBe(1);
  });
});

describe("installHover cross-view matching", () => {
  // installHover must pass allExpressions (not just localExpressions) to the
  // highlighter, so hovering in the calc view finds matches in the table and
  // vice versa.
  it("calls highlighter.highlight with allExpressions, not just localExpressions", () => {
    const span = document.createElement("span");
    span.textContent = "x";
    document.body.appendChild(span);

    // A minimal proof for a single-token expression (subst empty → "x" is a
    // literal, so nodeSpans returns [[0,1]]).
    const proof: Proof = {
      rule: { assumptions: [], conclusion: ["wff", "x"] },
      subst: new Map(),
      subproofs: [],
    };
    const loc: TokenLocation = { type: "element", node: span };
    const localExpr: ParsedExpression = {
      tokens: [{ text: "x", kind: null }],
      locations: [loc],
      proof,
    };
    const remoteExpr: ParsedExpression = {
      tokens: [{ text: "y", kind: null }],
      locations: [],
      proof: null,
    };
    const allExprs = [localExpr, remoteExpr];

    let capturedAll: ParsedExpression[] | null = null;
    const mockHighlighter: Highlighter = {
      highlight(all) {
        capturedAll = all;
      },
      clear() {},
    };

    (document as unknown as { elementFromPoint: unknown }).elementFromPoint =
      () => span;

    installHover([localExpr], allExprs, mockHighlighter);

    // The container is span.parentElement = document.body; dispatch there.
    document.body.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 0, clientY: 0 }),
    );

    expect(capturedAll).toBe(allExprs);
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
