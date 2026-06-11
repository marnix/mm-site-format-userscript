// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { ProofTree } from "../src/calculation";
import { parseProofTable } from "../src/table";
import { readFixture } from "./helpers";

// A comparable shape: each node's Ref text (whitespace-collapsed) and subproofs.
const shape = (t: ProofTree): unknown => ({
  ref: t.refHtml.textContent?.replace(/\s+/g, " ").trim(),
  subproofs: t.subproofs.map(shape),
});

describe("parseProofTable", () => {
  it("builds the bitrdi proof tree from the table", () => {
    const doc = new DOMParser().parseFromString(
      readFixture("mpeuni", "bitrdi.html"),
      "text/html",
    );
    const tree = parseProofTable(doc);
    expect(tree && shape(tree)).toEqual({
      ref: "bitrd 280", // step 4 (the conclusion)
      subproofs: [
        { ref: "bitrdi.1", subproofs: [] }, // step 1 (hypothesis)
        {
          ref: "a1i 11", // step 3
          subproofs: [{ ref: "bitrdi.2", subproofs: [] }], // step 2 (hypothesis)
        },
      ],
    });
  });
});
