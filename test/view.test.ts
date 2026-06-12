import { describe, expect, it } from "vitest";
import { linkWithTableView, searchWithView, tableSelected } from "../src/view";

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

describe("linkWithTableView", () => {
  const base = "https://us.metamath.org/mpeuni/eqid.html?view=table";

  it("adds view=table to a same-host (relative) link", () => {
    expect(linkWithTableView("bitrdi.html", base)).toBe(
      "https://us.metamath.org/mpeuni/bitrdi.html?view=table",
    );
    expect(linkWithTableView("../mpegif/eqid.html", base)).toBe(
      "https://us.metamath.org/mpegif/eqid.html?view=table",
    );
  });

  it("adds it for the apex and other metamath.org subdomains", () => {
    expect(linkWithTableView("https://metamath.org/index.html", base)).toBe(
      "https://metamath.org/index.html?view=table",
    );
  });

  it("leaves non-metamath and look-alike hosts alone", () => {
    expect(
      linkWithTableView("https://expln.github.io/x.html", base),
    ).toBeNull();
    expect(
      linkWithTableView("https://metamath.org.evil.com/", base),
    ).toBeNull();
    expect(linkWithTableView("https://evil-metamath.org/", base)).toBeNull();
  });

  it("skips non-http(s) links and links that already have view=table", () => {
    expect(linkWithTableView("mailto:a@b.org", base)).toBeNull();
    expect(
      linkWithTableView("https://us.metamath.org/x.html?view=table", base),
    ).toBeNull();
  });
});
