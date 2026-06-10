// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  dominantInk,
  parseCssColor,
  parseKindColors,
  variableKindOfImg,
  type ImageSampler,
  type Rgb,
} from "../src/kind";
import { readFixture, readFixtureBytes } from "./helpers";

/**
 * Stand-in for the browser canvas: reads the actual .gif fixture and returns
 * its colour table as RGBA pixels (one pixel per palette entry, the GIF's
 * transparent index emitted as alpha 0) — i.e. what getImageData would expose
 * for these flat two-colour glyphs.
 */
function gifToRgba(b: Uint8Array): Uint8ClampedArray {
  const packed = b[10];
  const n = packed & 0x80 ? 2 ** ((packed & 7) + 1) : 0;
  // Transparent colour index, from the Graphic Control Extension (0x21 0xF9).
  let transparent = -1;
  for (let i = 13 + 3 * n; i < b.length - 1; i++) {
    if (b[i] === 0x21 && b[i + 1] === 0xf9) {
      if (b[i + 3] & 1) transparent = b[i + 6];
      break;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = 13 + 3 * i;
    out.push(b[o], b[o + 1], b[o + 2], i === transparent ? 0 : 255);
  }
  return new Uint8ClampedArray(out);
}

const doc = new DOMParser().parseFromString(
  readFixture("mpegif", "bitrdi.html"),
  "text/html",
);
const colors = parseKindColors(doc);
const sample: ImageSampler = (img) =>
  gifToRgba(readFixtureBytes("mpegif", img.getAttribute("src")!));

function img(src: string): Element {
  const el = doc.createElement("img");
  el.setAttribute("src", src);
  return el;
}

describe("parseKindColors", () => {
  it("reads the colour→kind map from the legend", () => {
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
