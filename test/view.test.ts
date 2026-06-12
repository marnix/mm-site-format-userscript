import { describe, expect, it } from "vitest";
import { searchWithView, tableSelected } from "../src/view";

describe("tableSelected", () => {
  it("is false for a plain URL — calculation is the default", () => {
    expect(tableSelected("")).toBe(false);
    expect(tableSelected("?foo=bar")).toBe(false);
  });

  it("is true only when view=table", () => {
    expect(tableSelected("?view=table")).toBe(true);
    expect(tableSelected("?a=1&view=table")).toBe(true);
    expect(tableSelected("?view=calc")).toBe(false);
  });
});

describe("searchWithView", () => {
  it("adds view=table for the table view and clears it for the calculation view", () => {
    expect(searchWithView("", true)).toBe("?view=table");
    expect(searchWithView("?view=table", false)).toBe("");
  });

  it("preserves other parameters", () => {
    expect(searchWithView("?a=1", true)).toBe("?a=1&view=table");
    expect(searchWithView("?a=1&view=table", false)).toBe("?a=1");
  });
});
