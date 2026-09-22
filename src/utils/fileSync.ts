const SYNC_PRIVATE_NOTES_KEY = "nostr_sync_private_notes";

export interface LocalSaveResult {
  saved: boolean;
  skippedPrivate?: boolean;
  error?: string;
}

import { toArrayBuffer } from "./crypto";

export class LocalFileSyncService {
  private static dirHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Gizli (Gift Wrap) notların yerel diske senkronize edilip edilmeyeceğini kontrol eder.
   * Varsayılan olarak gizlilik ve güvenlik amacıyla kapalıdır (false).
   */
  public static isSyncPrivateNotesEnabled(): boolean {
    return localStorage.getItem(SYNC_PRIVATE_NOTES_KEY) === "true";
  }

  /**
   * Gizli notların yerel diske senkronizasyon ayarını günceller.
   */
  public static setSyncPrivateNotes(enabled: boolean): void {
    localStorage.setItem(SYNC_PRIVATE_NOTES_KEY, enabled ? "true" : "false");
  }

  /**
   * Kullanıcıdan bilgisayarındaki bir klasörü seçmesini ister
   */
  public static async selectLocalDirectory(): Promise<boolean> {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert("Tarayıcınız File System Access API'yi desteklemiyor.");
        return false;
      }
      this.dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      return true;
    } catch (err) {
      console.warn("Klasör seçimi iptal edildi:", err);
      return false;
    }
  }

  public static getSelectedDirectoryName(): string | null {
    return this.dirHandle ? this.dirHandle.name : null;
  }

  /**
   * Not kaydedildiği anda belirtilen yerel klasörde slug.md dosyası oluşturur veya günceller
   */
  public static async saveNoteToLocalDisk(
    slug: string,
    content: string,
    pubkey: string,
    createdAt: number,
    isPrivate: boolean = false
  ): Promise<LocalSaveResult> {
    if (!this.dirHandle) {
      return { saved: false };
    }

    if (isPrivate && !this.isSyncPrivateNotesEnabled()) {
      console.log(`[Yerel Disk] Gizli not (${slug}) için yerel disk senkronizasyonu kapalı olduğundan pas geçildi.`);
      return { saved: false, skippedPrivate: true };
    }

    try {
      const fileName = `${slug}.md`;
      const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      // YAML Frontmatter ekleyerek kaydet
      const fileContent = `---
title: "${slug}"
pubkey: "${pubkey}"
created_at: ${createdAt}
is_private: ${isPrivate}
---

${content}`;

      await writable.write(fileContent);
      await writable.close();
      console.log(`[Yerel Disk] ${fileName} dosyası başarıyla güncellendi.`);
      return { saved: true };
    } catch (err: any) {
      console.error("[Yerel Disk] Yazma hatası:", err);
      return { saved: false, error: err?.message || String(err) };
    }
  }

  /**
   * Asset dosyasını yerel diskteki assets/ klasörüne kaydeder (Logseq stili)
   */
  public static async saveAssetToLocalDisk(
    filename: string,
    bytes: Uint8Array,
    mime: string,
    isPrivate: boolean = false,
    assetId?: string
  ): Promise<LocalSaveResult> {
    if (!this.dirHandle) {
      return { saved: false };
    }

    if (isPrivate && !this.isSyncPrivateNotesEnabled()) {
      console.log(`[Yerel Disk] Gizli asset (${filename}) için yerel disk senkronizasyonu kapalı olduğundan pas geçildi.`);
      return { saved: false, skippedPrivate: true };
    }

    try {
      const assetsDirHandle = await this.dirHandle.getDirectoryHandle("assets", { create: true });
      const targetFilename =
        assetId && !filename.startsWith(assetId.slice(0, 8)) ? `${assetId.slice(0, 8)}-${filename}` : filename;
      const fileHandle = await assetsDirHandle.getFileHandle(targetFilename, { create: true });
      const writable = await fileHandle.createWritable();
      const blob = new Blob([toArrayBuffer(bytes)], { type: mime });
      await writable.write(blob);
      await writable.close();
      console.log(`[Yerel Disk] assets/${targetFilename} dosyası başarıyla güncellendi.`);
      return { saved: true };
    } catch (err: any) {
      console.error("[Yerel Disk] Asset yazma hatası:", err);
      return { saved: false, error: err?.message || String(err) };
    }
  }

  public static isDirectorySelected(): boolean {
    return this.dirHandle !== null;
  }
}