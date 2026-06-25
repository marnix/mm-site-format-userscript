// @vitest-environment happy-dom
//
// Fixture-backed integration test for nmulprop -- a theorem with 120 Ref pages
// whose grammar assembly relies on the breakdown-table fallback and the always-
// loaded primitives.  Every file the script fetches is stored in
// test/fixtures/mpeuni/ so this test runs fully offline.
//
// Integration test: every proof-column expression must parse with 0 failures.
//
// Memory note: parsing 183 fixture files through happy-dom requires ~4-6 GB
// of heap.  Run with NODE_OPTIONS='--max-old-space-size=8192' or equivalent.
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { describe, expect, it } from "vitest";
import { parseUniExpressions } from "../src/page";
import { isProofExpression } from "../src/parse-status";
import { readFixture } from "./helpers";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "mpeuni",
);

const PAGE_URL = "https://us.metamath.org/mpeuni/nmulprop.html";

/** Returns the fixture for the URL if it exists, otherwise empty HTML. */
const fetcher = async (url: string): Promise<string> => {
  const name = url.split("/").pop()!;
  const path = join(FIXTURE_DIR, name);
  if (existsSync(path)) return readFixture("mpeuni", name);
  return "<html></html>";
};

describe("parseUniExpressions (mpeuni/nmulprop)", () => {
  it("parses all Expression-column expressions (proof table + hyps + assertion)", async () => {
    const doc = new DOMParser().parseFromString(
      readFixture("mpeuni", "nmulprop.html"),
      "text/html",
    );

    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);

    const proofColumnExprs = results.filter(isProofExpression);
    const failures = proofColumnExprs.filter((r) => r.proof === null);
    const failedTokens = failures.map((r) =>
      r.tokens.map((t) => t.text).join(" "),
    );

    // Diagnostic: print failures so the cause is visible in the test output.
    if (failures.length > 0)
      console.error(
        `Parse failures (${failures.length}):\n` +
          failedTokens.map((s) => `  ${s}`).join("\n"),
      );

    expect(failures.length).toBe(0);
  });
}, 30_000);
