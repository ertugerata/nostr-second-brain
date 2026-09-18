import { describe, it, expect } from "vitest";
import { buildNoteGraph, NoteGraphItem } from "./graphBuilder";

describe("graphBuilder - buildNoteGraph", () => {
  const userPubkey = "user_pubkey_123";
  const otherPubkey = "other_pubkey_456";

  it("should construct nodes and links from notes and wikilinks", () => {
    const notes = new Map<string, NoteGraphItem>();
    notes.set("note-1", {
      slug: "note-1",
      content: "Hello [[note-2]] world",
      pubkey: userPubkey,
    });
    notes.set("note-2", {
      slug: "note-2",
      content: "Welcome to note 2",
      pubkey: userPubkey,
    });

    const graph = buildNoteGraph(notes, userPubkey);

    expect(graph.nodes.length).toBe(2);
    expect(graph.links.length).toBe(1);
    expect(graph.nodes.find((n) => n.id === "note-1")?.isMine).toBe(true);
    expect(graph.nodes.find((n) => n.id === "note-2")?.isMine).toBe(true);
  });

  it("should correctly identify user's notes and their connected neighbors", () => {
    const notes = new Map<string, NoteGraphItem>();

    // My note linking to an external note
    notes.set("my-note", {
      slug: "my-note",
      content: "Check [[external-note]] and [[uncreated-note]]",
      pubkey: userPubkey,
    });

    // External note signed by someone else
    notes.set("external-note", {
      slug: "external-note",
      content: "I am external note",
      pubkey: otherPubkey,
    });

    // Unrelated note signed by someone else with no connection to my notes
    notes.set("unrelated-note", {
      slug: "unrelated-note",
      content: "Just another note on relay",
      pubkey: otherPubkey,
    });

    const graph = buildNoteGraph(notes, userPubkey);

    const myNode = graph.nodes.find((n) => n.id === "my-note");
    const externalNode = graph.nodes.find((n) => n.id === "external-note");
    const uncreatedNode = graph.nodes.find((n) => n.id === "uncreated-note");
    const unrelatedNode = graph.nodes.find((n) => n.id === "unrelated-note");

    expect(myNode?.isMine).toBe(true);

    expect(externalNode?.isMine).toBe(false);
    expect(externalNode?.isNeighborOfMine).toBe(true);

    expect(uncreatedNode?.uncreated).toBe(true);
    expect(uncreatedNode?.isMine).toBe(false);
    expect(uncreatedNode?.isNeighborOfMine).toBe(true);

    expect(unrelatedNode?.isMine).toBe(false);
    expect(unrelatedNode?.isNeighborOfMine).toBe(false);
  });
});
