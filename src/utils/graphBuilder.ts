import { extractWikilinks } from "./wikilink";

export interface Node {
  id: string;
  title: string;
}

export interface Edge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export function buildNoteGraph(notesMap: Map<string, { slug: string; content: string }>): GraphData {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const existingSlugs = new Set<string>();

  notesMap.forEach((note, slug) => {
    existingSlugs.add(slug);
    nodes.push({
      id: slug,
      title: note.slug,
    });
  });

  notesMap.forEach((note, sourceSlug) => {
    const links = extractWikilinks(note.content);

    links.forEach((link) => {
      if (!existingSlugs.has(link.target)) {
        existingSlugs.add(link.target);
        nodes.push({
          id: link.target,
          title: link.label + " (Oluşturulmadı)",
        });
      }

      edges.push({
        source: sourceSlug,
        target: link.target,
      });
    });
  });

  return { nodes, edges };
}