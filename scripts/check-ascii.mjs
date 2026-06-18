// Verifies that every .ts / .js file under the given directories contains only
// 7-bit ASCII: tab (0x09), LF (0x0a), CR (0x0d), and printable ASCII 0x20-0x7e.
// Usage: node scripts/check-ascii.mjs [dir ...]  (default: src test)
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const DIRS = process.argv.length > 2 ? process.argv.slice(2) : ["src", "test"];
const EXTS = new Set([".ts", ".js"]);

let failed = false;

function check(path) {
  const data = readFileSync(path);
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b !== 9 && b !== 10 && b !== 13 && (b < 32 || b > 126)) {
      const line = data.subarray(0, i).filter((x) => x === 10).length + 1;
      console.error(
        `${path}:${line}: non-ASCII byte 0x${b.toString(16).padStart(2, "0")}`,
      );
      failed = true;
      return;
    }
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (EXTS.has(extname(name))) check(full);
  }
}

for (const dir of DIRS) walk(dir);

if (failed) process.exit(1);
