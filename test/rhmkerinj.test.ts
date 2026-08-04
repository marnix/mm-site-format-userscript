// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseUniExpressions } from "../src/page";
import { gapUnits } from "../src/spans";
import { readFixture } from "./helpers";

describe("parseUniExpressions (mpeuni/rhmkerinj) -- operator-level whitespace", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpeuni", "rhmkerinj.html"),
    "text/html",
  );
  const fetcher = async (url: string) =>
    readFixture("mpeuni", url.split("/").pop()!);

  // The main statement is
  //   |- ( F e. ( R RingHom S ) -> ( F : B -1-1-> C <-> ( `' F " { Z } ) = { 0 } ) )
  // and the whitespace must reflect operator level: a high-level -> gets more
  // room than the <-> inside it, which gets more than the innermost =.
  it("spaces higher-level operators more than lower-level ones", async () => {
    const results = await parseUniExpressions(
      doc,
      "https://us.metamath.org/mpeuni/rhmkerinj.html",
      fetcher,
    );

    const main = results.find((r) => {
      const texts = r.tokens.map((t) => t.text);
      return texts.includes("\u2192") && texts.includes("\u2194");
    });
    expect(main?.proof).not.toBeNull();

    const units = gapUnits(main!.proof!);
    const texts = main!.tokens.map((t) => t.text);
    const gapBefore = (operator: string) => units[texts.indexOf(operator)];

    expect(gapBefore("\u2192")).toBeGreaterThan(gapBefore("\u2194"));
    expect(gapBefore("\u2194")).toBeGreaterThan(gapBefore("="));
  }, 20_000);
});
