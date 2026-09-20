import { describe, it, expect, beforeEach } from "vitest";

// Mock localStorage for node environment in vitest
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

import {
  normalizeRelayUrl,
  getStoredRelays,
  nostrService,
  DEFAULT_RELAYS,
} from "./nostr";

describe("Nostr Relay Normalization & Deduplication Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("normalizeRelayUrl", () => {
    it("normalizes URLs without protocol prefix to wss://", () => {
      expect(normalizeRelayUrl("relay.damus.io")).toBe("wss://relay.damus.io/");
      expect(normalizeRelayUrl("nos.lol")).toBe("wss://nos.lol/");
    });

    it("normalizes localhost and IP addresses without protocol to ws://", () => {
      expect(normalizeRelayUrl("localhost:7777")).toBe("ws://localhost:7777/");
      expect(normalizeRelayUrl("127.0.0.1:8080")).toBe("ws://127.0.0.1:8080/");
    });

    it("ensures trailing slash and trims whitespace", () => {
      expect(normalizeRelayUrl("  wss://relay.damus.io  ")).toBe("wss://relay.damus.io/");
      expect(normalizeRelayUrl("wss://relay.damus.io/")).toBe("wss://relay.damus.io/");
      expect(normalizeRelayUrl("ws://localhost:7777")).toBe("ws://localhost:7777/");
      expect(normalizeRelayUrl("ws://localhost:7777/")).toBe("ws://localhost:7777/");
    });

    it("returns empty string for empty input", () => {
      expect(normalizeRelayUrl("")).toBe("");
      expect(normalizeRelayUrl("   ")).toBe("");
    });
  });

  describe("getStoredRelays", () => {
    it("returns DEFAULT_RELAYS when localStorage is empty", () => {
      const relays = getStoredRelays();
      expect(relays).toEqual(DEFAULT_RELAYS);
    });

    it("deduplicates and normalizes legacy relay entries from localStorage", () => {
      const legacyStorage = JSON.stringify([
        "wss://relay.damus.io",
        "wss://relay.damus.io/",
        "wss://nos.lol",
        "ws://localhost:7777",
        "ws://localhost:7777/"
      ]);
      localStorage.setItem("nostr_user_relays", legacyStorage);

      const relays = getStoredRelays();
      expect(relays).toEqual([
        "wss://relay.damus.io/",
        "wss://nos.lol/",
        "ws://localhost:7777/"
      ]);

      // Check updated clean storage
      const savedInStorage = JSON.parse(localStorage.getItem("nostr_user_relays") || "[]");
      expect(savedInStorage).toEqual([
        "wss://relay.damus.io/",
        "wss://nos.lol/",
        "ws://localhost:7777/"
      ]);
    });
  });

  describe("NostrService relay management", () => {
    it("prevents adding duplicate relay URLs even with slight formatting variations", async () => {
      await nostrService.removeRelay("wss://test-relay.example.com");

      const addedFirst = await nostrService.addRelay("wss://test-relay.example.com");
      expect(addedFirst).toBe(true);

      const addedDuplicate = await nostrService.addRelay("wss://test-relay.example.com/");
      expect(addedDuplicate).toBe(false);

      const urls = nostrService.getRelayUrls();
      const count = urls.filter(
        (u) => u === "wss://test-relay.example.com/"
      ).length;
      expect(count).toBe(1);

      // Cleanup
      await nostrService.removeRelay("wss://test-relay.example.com");
    });

    it("removes relays correctly regardless of trailing slash in argument", async () => {
      await nostrService.addRelay("wss://remove-test.example.com/");
      expect(nostrService.getRelayUrls()).toContain("wss://remove-test.example.com/");

      const removed = await nostrService.removeRelay("wss://remove-test.example.com");
      expect(removed).toBe(true);
      expect(nostrService.getRelayUrls()).not.toContain("wss://remove-test.example.com/");
    });

    it("getRelayStatuses returns unique normalized URLs", () => {
      const statuses = nostrService.getRelayStatuses();
      const urls = statuses.map((s) => s.url);
      const uniqueUrls = new Set(urls);
      expect(urls.length).toBe(uniqueUrls.size);
    });
  });
});
