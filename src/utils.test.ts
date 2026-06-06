import { describe, it, expect } from "vitest";
import { extractTheoremName } from "./utils";

describe("extractTheoremName", () => {
  it("extracts theorem name from a proof page URL", () => {
    expect(extractTheoremName("https://us.metamath.org/mpeuni/ru.html")).toBe(
      "ru",
    );
  });

  it("returns null for a non-proof URL", () => {
    expect(extractTheoremName("https://us.metamath.org/")).toBeNull();
  });
});
