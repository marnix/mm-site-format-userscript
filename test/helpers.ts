import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Reads a fixture HTML file, e.g. readFixture("mpeuni", "bitrdi.html"). */
export function readFixture(variant: string, name: string): string {
  return readFileSync(join(fixturesDir, variant, name), "utf-8");
}

/** Reads a binary fixture (e.g. a GIF image) as bytes. */
export function readFixtureBytes(variant: string, name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, variant, name)));
}
