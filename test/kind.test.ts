// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  dominantInk,
  parseCssColor,
  parseKindColors,
  variableKindOfImg,
  type Rgb,
} from "../src/kind";
import { gifSampler, readFixture } from "./helpers";

const doc = new DOMParser().parseFromString(
  readFixture("mpegif", "bitrdi.html"),
  "text/html",
);
const colors = parseKindColors(doc);
const sample = gifSampler("mpegif");

function img(src: string): Element {
  const el = doc.createElement("img");
  el.setAttribute("src", src);
  return el;
}

describe("parseKindColors", () => {
  it("reads the colour->kind map from the legend", () => {
    expect(colors.get("0,0,255")).toBe("wff");
    expect(colors.get("255,0,0")).toBe("setvar");
    expect(colors.get("204,51,204")).toBe("class");
  });
});

describe("parseCssColor", () => {
  it("resolves named colours and hex", () => {
    expect(parseCssColor("blue")).toEqual([0, 0, 255]);
    expect(parseCssColor("red")).toEqual([255, 0, 0]);
    expect(parseCssColor("#C3C")).toEqual([204, 51, 204]);
    expect(parseCssColor("#CC33CC")).toEqual([204, 51, 204]);
  });
});

describe("dominantInk", () => {
  it("picks the most common opaque non-white pixel", () => {
    // two blue pixels, one red, one transparent, one white
    const px = new Uint8ClampedArray([
      0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 9, 9, 9, 0, 255, 255, 255,
      255,
    ]);
    expect(dominantInk(px)).toEqual([0, 0, 255] as Rgb);
  });
});

describe("variableKindOfImg", () => {
  it("classifies variable images by colour", () => {
    expect(variableKindOfImg(img("_varphi.gif"), colors, sample)).toBe("wff");
    expect(variableKindOfImg(img("_chi.gif"), colors, sample)).toBe("wff");
    expect(variableKindOfImg(img("_psi.gif"), colors, sample)).toBe("wff");
    expect(variableKindOfImg(img("_x.gif"), colors, sample)).toBe("setvar");
    expect(variableKindOfImg(img("_ca.gif"), colors, sample)).toBe("class");
  });

  it("returns null for constant tokens (operators, turnstile)", () => {
    expect(variableKindOfImg(img("to.gif"), colors, sample)).toBeNull();
    expect(
      variableKindOfImg(img("leftrightarrow.gif"), colors, sample),
    ).toBeNull();
    expect(variableKindOfImg(img("_vdash.gif"), colors, sample)).toBeNull();
  });
});

describe("parseKindColors (ILE old <FONT COLOR> legend)", () => {
  it("reads the FONT-colour legend and maps the 'set' label to setvar", () => {
    const ile = new DOMParser().parseFromString(
      readFixture("ilegif", "speano5.html"),
      "text/html",
    );
    const m = parseKindColors(ile);
    expect(m.get("0,0,255")).toBe("wff"); // <FONT COLOR="#0000FF">wff
    expect(m.get("255,0,0")).toBe("setvar"); // <FONT COLOR="#FF0000">set -> setvar
    expect(m.get("204,51,204")).toBe("class"); // <FONT COLOR="#CC33CC">class
  });
});
