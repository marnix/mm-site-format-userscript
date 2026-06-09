import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Reads a fixture HTML file, e.g. readFixture("mpeuni", "bitrdi.html"). */
export function readFixture(variant: string, name: string): string {
  return readFileSync(join(fixturesDir, variant, name), "utf-8");
}
