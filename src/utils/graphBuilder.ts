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
  pubkey?: string;
  isMine?: boolean;
  isNeighborOfMine?: boolean;
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

export interface NoteGraphItem {
  slug: string;
  content: string;
  pubkey?: string;
}

export function buildNoteGraph(
  notesMap: Map<string, NoteGraphItem>,
  currentUserPubkey?: string
): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const connectionCounts = new Map<string, number>();

  // Helper to determine if a pubkey belongs to current user
  const isUserNode = (pubkey?: string) => {
    if (currentUserPubkey) {
      return pubkey === currentUserPubkey || !pubkey;
    }
    return true;
  };

  // 1. Add existing notes
  notesMap.forEach((note, slug) => {
    const isMine = isUserNode(note.pubkey);
    nodesMap.set(slug, {
      id: slug,
      title: note.slug,
      uncreated: false,
      val: 1,
      pubkey: note.pubkey,
      isMine,
      isNeighborOfMine: false,
    });
    connectionCounts.set(slug, 0);
  });

  // 2. Extract wikilinks and build edges
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
          isMine: false,
          isNeighborOfMine: false,
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

  // 3. Flag neighbors of user notes
  links.forEach((link) => {
    const sourceSlug = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
    const targetSlug = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;

    const sourceNode = nodesMap.get(sourceSlug);
    const targetNode = nodesMap.get(targetSlug);

    if (sourceNode && targetNode) {
      if (sourceNode.isMine) {
        targetNode.isNeighborOfMine = true;
      }
      if (targetNode.isMine) {
        sourceNode.isNeighborOfMine = true;
      }
    }
  });

  // 4. Calculate node visual importance/val based on degree
  const nodes = Array.from(nodesMap.values()).map((node) => {
    const degree = connectionCounts.get(node.id) || 0;
    return {
      ...node,
      val: Math.max(2, degree * 2 + 3),
    };
  });

  return { nodes, links, edges: links };
}
