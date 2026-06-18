import { describe, expect, it } from "vitest";
import { linkWithView, searchWithView, tableSelected } from "../src/view";

describe("tableSelected", () => {
  it("is false for a plain URL -- calculation is the default", () => {
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

describe("linkWithView", () => {
  const base = "https://us.metamath.org/mpeuni/eqid.html?view=table";

  it("adds view=table to a same-host (relative) link for the table view", () => {
    expect(linkWithView("bitrdi.html", base, true)).toBe(
      "https://us.metamath.org/mpeuni/bitrdi.html?view=table",
    );
    expect(linkWithView("../mpegif/eqid.html", base, true)).toBe(
      "https://us.metamath.org/mpegif/eqid.html?view=table",
    );
  });

  it("clears the parameter for the calculation view", () => {
    expect(linkWithView("bitrdi.html?view=table", base, false)).toBe(
      "https://us.metamath.org/mpeuni/bitrdi.html",
    );
  });

  it("returns null when the link already matches the view", () => {
    expect(linkWithView("bitrdi.html", base, false)).toBeNull(); // calc, no param
    expect(linkWithView("bitrdi.html?view=table", base, true)).toBeNull(); // table, has it
  });

  it("adds it for the apex and other metamath.org subdomains", () => {
    expect(linkWithView("https://metamath.org/index.html", base, true)).toBe(
      "https://metamath.org/index.html?view=table",
    );
  });

  it("leaves non-metamath and look-alike hosts alone", () => {
    expect(
      linkWithView("https://expln.github.io/x.html", base, true),
    ).toBeNull();
    expect(
      linkWithView("https://metamath.org.evil.com/", base, true),
    ).toBeNull();
    expect(linkWithView("https://evil-metamath.org/", base, true)).toBeNull();
  });

  it("skips non-http(s) links", () => {
    expect(linkWithView("mailto:a@b.org", base, true)).toBeNull();
  });
});
