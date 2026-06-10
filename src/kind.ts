// On GIF pages a variable's kind (wff / setvar / class) is encoded only as the
// colour of its image. We read that colour the way a browser would: draw the
// <img> to a canvas and read the pixels (getImageData). The pixel-reading step
// is an injectable `ImageSampler` so it can be swapped for a test fake that
// decodes the .gif directly. The colour→kind map comes from the page's
// "Colors of variables" legend.

export type Rgb = [number, number, number];

/** A metamath variable kind, as named in the "Colors of variables" legend. */
export type VariableKind = string; // e.g. "wff", "setvar", "class"

/** Maps an "r,g,b" colour key to the variable kind drawn in that colour. */
export type KindColors = Map<string, VariableKind>;

const rgbKey = (c: Rgb) => c.join(",");

const NAMED_COLORS: Record<string, Rgb> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

/** Resolves a CSS colour like "blue", "#C3C", or "#CC33CC" to RGB. */
export function parseCssColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  if (v in NAMED_COLORS) return NAMED_COLORS[v];
  const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((d) => d + d).join("") : m[1];
  const at = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [at(0), at(2), at(4)];
}

/**
 * Reads the "Colors of variables" legend into a colour→kind map. Each kind is
 * shown as a coloured `<SPAN CLASS=wff STYLE="color:blue">wff</SPAN>` etc.; the
 * class names the kind and the colour is the ink colour its variables use.
 */
export function parseKindColors(doc: Document): KindColors {
  const colors: KindColors = new Map();
  for (const span of doc.querySelectorAll("span[class][style]")) {
    const kind = span.getAttribute("class")!.trim();
    const m = span.getAttribute("style")!.match(/color\s*:\s*([^;]+)/i);
    if (!m || span.textContent?.trim() !== kind) continue;
    const rgb = parseCssColor(m[1]);
    if (rgb) colors.set(rgbKey(rgb), kind);
  }
  return colors;
}

/** The variable kind names declared in the legend (e.g. wff, setvar, class). */
export function parseKindNames(doc: Document): Set<string> {
  return new Set(parseKindColors(doc).values());
}

/**
 * Finds the dominant ink colour in a run of RGBA pixels (as returned by
 * `CanvasRenderingContext2D.getImageData().data`): the most common pixel that
 * is opaque and not (near-)white — i.e. ignoring transparent/white background.
 */
export function dominantInk(data: Uint8ClampedArray): Rgb | null {
  const counts = new Map<string, number>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2],
      a = data[i + 3];
    if (a < 128) continue; // transparent background
    if (r > 230 && g > 230 && b > 230) continue; // white background
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, n] of counts) {
    if (n > bestCount) {
      best = key;
      bestCount = n;
    }
  }
  return best ? (best.split(",").map(Number) as Rgb) : null;
}

/** A function that returns an image's RGBA pixels, like getImageData().data. */
export type ImageSampler = (img: Element) => Uint8ClampedArray;

/**
 * Determines the variable kind of a GIF-page <img> from its ink colour, or
 * null if the colour is not a variable colour (i.e. it is a constant token
 * such as an operator or parenthesis, drawn in black/gray).
 */
export function variableKindOfImg(
  img: Element,
  colors: KindColors,
  sample: ImageSampler,
): VariableKind | null {
  const ink = dominantInk(sample(img));
  return ink ? (colors.get(rgbKey(ink)) ?? null) : null;
}

/** Browser sampler: draws the already-loaded <img> to a canvas and reads it. */
export const canvasSampler: ImageSampler = (img) => {
  const el = img as HTMLImageElement;
  const w = el.naturalWidth || el.width;
  const h = el.naturalHeight || el.height;
  if (!w || !h) return new Uint8ClampedArray(); // image not loaded yet
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8ClampedArray();
  ctx.drawImage(el, 0, 0);
  return ctx.getImageData(0, 0, w, h).data;
};
