// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { spanToHighlight } from "../src/highlight";
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
});
