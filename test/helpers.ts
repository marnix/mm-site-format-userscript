import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { ImageSampler } from "../src/kind";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Reads a fixture HTML file, e.g. readFixture("mpeuni", "bitrdi.html"). */
export function readFixture(variant: string, name: string): string {
  return readFileSync(join(fixturesDir, variant, name), "utf-8");
}

/** Reads a binary fixture (e.g. a GIF image) as bytes. */
export function readFixtureBytes(variant: string, name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, variant, name)));
}

/**
 * Stand-in for the browser canvas: returns a GIF's colour table as RGBA pixels
 * (one pixel per palette entry, the GIF's transparent index emitted as alpha 0)
 * — what getImageData would expose for these flat two-colour glyphs.
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

/** An ImageSampler that reads the actual .gif fixture for each <img>'s src. */
export function gifSampler(variant: string): ImageSampler {
  return (img) =>
    gifToRgba(readFixtureBytes(variant, img.getAttribute("src")!));
}
