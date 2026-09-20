import { describe, it, expect, beforeEach } from "vitest";
import { LocalFileSyncService } from "./fileSync";

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

describe("LocalFileSyncService Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("isSyncPrivateNotesEnabled defaults to false and setSyncPrivateNotes toggles setting", () => {
    expect(LocalFileSyncService.isSyncPrivateNotesEnabled()).toBe(false);

    LocalFileSyncService.setSyncPrivateNotes(true);
    expect(LocalFileSyncService.isSyncPrivateNotesEnabled()).toBe(true);

    LocalFileSyncService.setSyncPrivateNotes(false);
    expect(LocalFileSyncService.isSyncPrivateNotesEnabled()).toBe(false);
  });

  it("saveNoteToLocalDisk returns saved: false when no directory is selected", async () => {
    expect(LocalFileSyncService.isDirectorySelected()).toBe(false);

    const result = await LocalFileSyncService.saveNoteToLocalDisk(
      "public-note",
      "Public content",
      "pubkey123",
      1700000000,
      false
    );

    expect(result.saved).toBe(false);
  });

  it("saveNoteToLocalDisk returns skippedPrivate: true when isPrivate is true and syncPrivateNotes is false", async () => {
    // Mock directory selected by setting dirHandle
    (LocalFileSyncService as any).dirHandle = {};

    LocalFileSyncService.setSyncPrivateNotes(false);

    const result = await LocalFileSyncService.saveNoteToLocalDisk(
      "secret-note",
      "Secret content",
      "pubkey123",
      1700000000,
      true
    );

    expect(result.saved).toBe(false);
    expect(result.skippedPrivate).toBe(true);

    // Reset dirHandle
    (LocalFileSyncService as any).dirHandle = null;
  });

  it("saveAssetToLocalDisk returns saved: false when no directory is selected", async () => {
    expect(LocalFileSyncService.isDirectorySelected()).toBe(false);

    const result = await LocalFileSyncService.saveAssetToLocalDisk(
      "test.jpg",
      new Uint8Array([1, 2, 3]),
      "image/jpeg",
      false
    );

    expect(result.saved).toBe(false);
  });

  it("saveAssetToLocalDisk returns skippedPrivate: true when isPrivate is true and syncPrivateNotes is false", async () => {
    (LocalFileSyncService as any).dirHandle = {};
    LocalFileSyncService.setSyncPrivateNotes(false);

    const result = await LocalFileSyncService.saveAssetToLocalDisk(
      "secret.jpg",
      new Uint8Array([1, 2, 3]),
      "image/jpeg",
      true
    );

    expect(result.saved).toBe(false);
    expect(result.skippedPrivate).toBe(true);

    (LocalFileSyncService as any).dirHandle = null;
  });
});
