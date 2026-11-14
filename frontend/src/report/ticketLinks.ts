// Ticket ids (e.g. Jira keys) in the report, turned into links. See docs/SPEC.md 8.5.

/** Ids are `prefix` followed by digits; `url` has {id} and/or {num} in it. */
export interface TicketRule {
  prefix: string;
  url: string;
}

export interface TicketMatch {
  /** As written, without a "#" before it, e.g. "ABC-123". */
  id: string;
  /** What the email shows: the id with "#" before it, e.g. "#ABC-123". */
  label: string;
  url: string;
  /** Where the match starts and ends in the text, including a "#" typed before the id. */
  index: number;
  end: number;
}

/**
 * `text` with every ticket id replaced by `render(ticket)`, and the text in
 * between passed through `other`.
 */
export function replaceTickets(
  text: string,
  find: (text: string) => TicketMatch[],
  render: (ticket: TicketMatch) => string,
  other: (text: string) => string = (s) => s
): string {
  let out = "";
  let last = 0;
  for (const t of find(text)) {
    out += other(text.slice(last, t.index)) + render(t);
    last = t.end;
  }
  return out + other(text.slice(last));
}

/**
 * Reads one rule per line: the prefix, whitespace, then the URL template,
 * e.g. "ABC- https://example.atlassian.net/browse/{id}". Blank lines are
 * skipped; lines that can't be used are returned in `invalid`.
 */
export function parseTicketRules(text: string): { rules: TicketRule[]; invalid: string[] } {
  const rules: TicketRule[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(\S+)\s+(https?:\/\/\S+)$/i.exec(line);
    if (match && /\{(id|num)\}/.test(match[2])) rules.push({ prefix: match[1], url: match[2] });
    else invalid.push(line);
  }
  return { rules, invalid };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds every ticket id in a text. Longer prefixes win over shorter ones. */
export function ticketFinder(rules: TicketRule[]): (text: string) => TicketMatch[] {
  if (rules.length === 0) return () => [];
  const sorted = [...rules].sort((a, b) => b.prefix.length - a.prefix.length);
  const alternatives = sorted.map((r) => `(${escapeRegExp(r.prefix)})(\\d+)`).join("|");
  // Not part of a longer word or number: nothing matches in "XABC-1", and
  // "ABC-1234" matches whole, never as "ABC-123".
  const pattern = `(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{N}])`;
  return (text) => {
    const found: TicketMatch[] = [];
    for (const m of text.matchAll(new RegExp(pattern, "giu"))) {
      const i = sorted.findIndex((_, k) => m[1 + 2 * k] !== undefined);
      const num = m[2 + 2 * i];
      const url = sorted[i].url
        .replace(/\{id\}/g, encodeURIComponent(m[0]))
        .replace(/\{num\}/g, num);
      // A "#" typed before the id is part of the match, so it isn't doubled.
      const hashed = m.index! > 0 && text[m.index! - 1] === "#";
      found.push({
        id: m[0],
        label: m[0].startsWith("#") ? m[0] : `#${m[0]}`,
        url,
        index: hashed ? m.index! - 1 : m.index!,
        end: m.index! + m[0].length,
      });
    }
    return found;
  };
}

/**
 * A title that starts with a ticket id ("ABC-12 Fix login", "ABC-12: Fix
 * login"): the id and the rest of the title. Null otherwise.
 */
export function leadingTicket(
  title: string,
  find: (text: string) => TicketMatch[]
): { ticket: TicketMatch; rest: string } | null {
  const first = find(title)[0];
  if (!first || title.slice(0, first.index).trim() !== "") return null;
  const rest = title.slice(first.end).replace(/^\s*[:\-–]?\s*/, "");
  return { ticket: first, rest };
}
