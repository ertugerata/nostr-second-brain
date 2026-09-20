import { describe, it, expect } from "vitest";
import { nip19 } from "nostr-tools";
import { getDefaultSampleNote } from "./sampleNote";

describe("Npub Search & Sample Note Tests", () => {
  const testHexPubkey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const testNpub = nip19.npubEncode(testHexPubkey);

  it("should correctly encode hex pubkey to npub and decode back", () => {
    expect(testNpub).toMatch(/^npub1/);
    const decoded = nip19.decode(testNpub);
    expect(decoded.type).toBe("npub");
    expect(decoded.data).toBe(testHexPubkey);
  });

  it("should match note by npub query", () => {
    const notes = [
      { slug: "my-note", content: "hello world", pubkey: testHexPubkey },
      { slug: "other-note", content: "something else", pubkey: "9999999999999999999999999999999999999999999999999999999999999999" },
    ];

    const query = testNpub;
    const decoded = nip19.decode(query);
    const targetHex = decoded.data as string;

    const matched = notes.filter((n) => n.pubkey === targetHex);
    expect(matched.length).toBe(1);
    expect(matched[0].slug).toBe("my-note");
  });

  it("should return updated sample note with latest features guide", () => {
    const sample = getDefaultSampleNote();
    expect(sample.slug).toBe("nostr-brain-rehberi");
    expect(sample.content).toContain("İnteraktif Ağ Haritası");
    expect(sample.content).toContain("npub1...");
    expect(sample.content).toContain("NIP-59 / NIP-44 Gizli Notlar");
  });
});
