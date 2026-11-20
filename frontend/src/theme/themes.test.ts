import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

const root = join(__dirname, "../..");

describe("themes", () => {
  it("index.html's early script knows every theme and its status bar colour", () => {
    // That script applies the saved theme before the app loads (docs/SPEC.md 15).
    const html = readFileSync(join(root, "index.html"), "utf8");
    const bars = html.match(/var bars = (\{[^}]*\})/)![1];
    const parsed = Object.fromEntries(
      [...bars.matchAll(/(\w+): "(#[0-9a-f]{6})"/g)].map((m) => [m[1], m[2]])
    );
    expect(parsed).toEqual(Object.fromEntries(THEMES.map((t) => [t.id, t.barColor])));
  });

  it("every theme sets every colour role", () => {
    const css = readFileSync(join(__dirname, "themes.css"), "utf8");
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      return css.slice(start, css.indexOf("}", start));
    };
    const roles = (text: string) => [...text.matchAll(/--c-([\w-]+):/g)].map((m) => m[1]).sort();
    const classic = roles(block('[data-theme="classic"]'));
    expect(classic.length).toBeGreaterThan(40);
    for (const t of THEMES) expect(roles(block(`[data-theme="${t.id}"]`)), t.id).toEqual(classic);
  });
});
