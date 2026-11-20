import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every colour in the UI comes from a theme role (docs/SPEC.md 15), so each
// theme controls all of it. Tailwind's palette isn't even generated
// (tailwind.config.js), so a palette class would silently do nothing: this
// test finds them instead.

const SRC = join(__dirname, "..");
const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(?:bg|text|border|ring|from|to|via|divide|placeholder|fill|stroke|outline|shadow|accent|caret|decoration)-(?:white|black|(?:${HUES})-\\d{2,3})(?:/\\d+)?(?![\\w-])`,
  "g"
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(e.name) && !e.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("theme colours", () => {
  it("uses no Tailwind palette classes, only theme roles", () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(PALETTE_CLASS)].map(
        (m) => `${relative(SRC, file).replace(/\\/g, "/")}: ${m[0]}`
      )
    );
    expect(found).toEqual([]);
  });

  it("would catch one", () => {
    expect("hover:bg-blue-600 text-white".match(PALETTE_CLASS)).toEqual(["bg-blue-600", "text-white"]);
    expect("bg-primary bg-neutral text-on-color border-row-done-edge".match(PALETTE_CLASS)).toBeNull();
  });
});
