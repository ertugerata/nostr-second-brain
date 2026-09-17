export interface ParsedLink {
  raw: string;
  target: string;
  label: string;
}

export function slugify(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractWikilinks(content: string): ParsedLink[] {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: ParsedLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    const label = match[2] ? match[2].trim() : rawTarget;
    const target = slugify(rawTarget);

    links.push({
      raw: match[0],
      target,
      label,
    });
  }

  return links;
}