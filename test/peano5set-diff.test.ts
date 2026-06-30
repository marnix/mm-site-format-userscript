// @vitest-environment happy-dom
//
// Regression test for the diff hover bug on peano5set.html: hovering the <==
// operator between step 6 (sylan2) and step 4 (bj-omssind) was highlighting
// the ENTIRE step-6 expression red instead of only the changed parts.
//
// (omega |^| A) e. V  and  omega C_ (omega |^| A)  appear in both expressions
// and must be identified as common sub-expressions, leaving only the outer
// structure highlighted as changed.

import { describe, expect, it, vi } from "vitest";
import { changedLocationSpans, commonSubtreeDiff } from "../src/diff";
import { parseUniExpressions } from "../src/page";
import { readFixture } from "./helpers";

const PAGE_URL = "https://us.metamath.org/ileuni/peano5set.html";

// Return the fixture for known pages; fall back to empty HTML for Ref pages
// whose syntax hints are already covered by the main page's own hints.
const fetcher = vi.fn(async (url: string) => {
  const name = url.split("/").pop()!;
  try {
    return readFixture("ileuni", name);
  } catch {
    return "<html></html>";
  }
});

describe("diff hover (ileuni/peano5set)", () => {
  it("finds common sub-expressions between step 4 (bj-omssind) and step 6 (sylan2)", async () => {
    const doc = new DOMParser().parseFromString(
      readFixture("ileuni", "peano5set.html"),
      "text/html",
    );
    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);

    // Step 4 (bj-omssind):
    //   |- ((omega |^| A) e. V -> (Ind (omega |^| A) -> omega C_ (omega |^| A)))
    // Unique: "Ind" immediately follows "(" -- distinguishes step 4 (where the
    // token before Ind is "(") from step 1 (Ind at start, preceded by turnstile),
    // step 5 (Ind after /\, non-ASCII), and steps 2/3 (both have Ind and suc).
    const step4 = results.find(
      (r) =>
        r.proof !== null &&
        r.tokens.some(
          (t, i) => t.text === "Ind" && r.tokens[i - 1]?.text === "(",
        ) &&
        !r.tokens.some((t) => t.text === "suc"),
    );

    // Step 6 (sylan2):
    //   |- (((omega |^| A) e. V /\ (0/ e. A /\ A.x e. omega (x e. A ->
    //          suc x e. A))) -> omega C_ (omega |^| A))
    // Unique: has "suc", not "Ind", and ends with "C_ (omega |^| A))" so the 6th
    // token from the end is "(". Steps 8 and 9 also have "suc" but end with
    // "C_ A)" -- no "(" in their last 7 tokens.
    const step6 = results.find(
      (r) =>
        r.proof !== null &&
        r.tokens.some((t) => t.text === "suc") &&
        !r.tokens.some((t) => t.text === "Ind") &&
        r.tokens.slice(-7).some((t) => t.text === "("),
    );

    expect(step4, "step 4 (bj-omssind) not found or not parsed").toBeDefined();
    expect(step6, "step 6 (sylan2) not found or not parsed").toBeDefined();

    // In the calc view: step 6 is "above" (A) and step 4 is "below" (B).
    const { unchangedInA } = commonSubtreeDiff(step6!.proof!, step4!.proof!);

    // (omega |^| A) e. V and omega C_ (omega |^| A) are shared sub-expressions.
    // Before the fix, unchangedInA was empty -> entire expression highlighted red.
    expect(unchangedInA.size).toBeGreaterThan(0);

    // Specifically, the changed region must not cover the full expression.
    const changed = changedLocationSpans(
      step6!.proof!,
      step6!.locations.length,
      unchangedInA,
    );
    const totalChanged = changed.reduce((s, [a, b]) => s + b - a, 0);
    expect(totalChanged).toBeLessThan(step6!.locations.length);
  });
});
