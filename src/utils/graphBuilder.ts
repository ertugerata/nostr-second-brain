import { extractWikilinks } from "./wikilink";

export interface GraphNode {
  id: string;
  title: string;
  uncreated?: boolean;
  val?: number; // Node size based on connection count
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  edges?: GraphLink[]; // For backwards compatibility
}

export function buildNoteGraph(notesMap: Map<string, { slug: string; content: string }>): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const connectionCounts = new Map<string, number>();

  // Add existing notes
  notesMap.forEach((note, slug) => {
    nodesMap.set(slug, {
      id: slug,
      title: note.slug,
      uncreated: false,
      val: 1,
    });
    connectionCounts.set(slug, 0);
  });

  // Extract wikilinks and build edges
  notesMap.forEach((note, sourceSlug) => {
    const wikilinks = extractWikilinks(note.content);

    wikilinks.forEach((link) => {
      const targetSlug = link.target;

      if (!nodesMap.has(targetSlug)) {
        nodesMap.set(targetSlug, {
          id: targetSlug,
          title: link.label + " (Oluşturulmadı)",
          uncreated: true,
          val: 1,
        });
        connectionCounts.set(targetSlug, 0);
      }

      links.push({
        source: sourceSlug,
        target: targetSlug,
      });

      connectionCounts.set(sourceSlug, (connectionCounts.get(sourceSlug) || 0) + 1);
      connectionCounts.set(targetSlug, (connectionCounts.get(targetSlug) || 0) + 1);
    });
  });

  // Calculate node visual importance/val based on degree
  const nodes = Array.from(nodesMap.values()).map((node) => {
    const degree = connectionCounts.get(node.id) || 0;
    return {
      ...node,
      val: Math.max(2, degree * 2 + 3),
    };
  });

  return { nodes, links, edges: links };
}
