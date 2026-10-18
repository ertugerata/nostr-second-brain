const SYNC_PRIVATE_NOTES_KEY = "nostr_sync_private_notes";

export interface LocalSaveResult {
  saved: boolean;
  skippedPrivate?: boolean;
  error?: string;
  metadataOnly?: boolean; warning?: string;
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

    // Gizli notlar yerel diske şifresiz yazılmamalı - 
    // şifreleme z-relay'lerde NIP-59 gift wrap (kind: 1059) ile yapılıyor.
    // Yerel disk kopya sadece non-private notlar için opt-in olmalı.
    if (isPrivate) {
      if (this.isSyncPrivateNotesEnabled()) {
        // Sync enabled but private: only save metadata (YAML frontmatter without content body)
        // Kullanıcıya uyarı: Gizli notlar içerik ile diske yazilmaz, sadece metadata kaydedilir
        // Bu, kullanıcının "local sync enabled" yapması halde de gizliliğin korunmasini sağlar
        const fileName = `${slug}.md`;
        const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        // Sadece metadata - içerik DEĞİL, sadece header bilgileri
        const fileContent = `---
title: "${slug}"
pubkey: "${pubkey}"
created_at: ${createdAt}
is_private: true
---`;
        await writable.write(fileContent);
        await writable.close();
        console.log(`[Yerel Disk] Gizli not (${slug}) - sadece metadata yerel diske kaydedildi; icerik NIP-59 ile relay'lerde shifrelenir.`);
        return { saved: true, skippedPrivate: true, metadataOnly: true };
      } else {
        // Sync disabled: don't save private note content - uyarı ver
        console.log(`[Yerel Disk] Gizli not (${slug}) yerel disk senkronizasyonu kapali - icerik diske yazilmadi (gizlilik korunuyor).`);
        return { saved: false, skippedPrivate: true };
      }
    }

    if (!this.isSyncPrivateNotesEnabled()) {
      return { saved: false };
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
   * Gizli not için sadece metadata (slug, pubkey, created_at, is_private) diske kaydeder.
   * İçerik şifrelenmediği için kaydedilmez - kullanıcıya uyarı verilir.
   */
  private static async savePrivateNoteMetadata(
    slug: string,
    pubkey: string,
    createdAt: number
  ): Promise<void> {
    const metadata = `---
title: "${slug}"
pubkey: "${pubkey}"
created_at: ${createdAt}
is_private: true
---\n`;
    try {
      // Create a metadata-only file (no content body)
      const fileName = `${slug}.meta.md`;
      if (this.dirHandle) {
        const fileEntry = await this.dirHandle.getFileHandle(fileName, { create: true });
        await fileEntry.createWriter().write(metadata);
        console.log(`[Yerel Disk] Gizli not metadata dosyası oluşturuldu: ${fileName}`);
      }
    } catch (err) {
      console.warn("[Yerel Disk] Gizli not metadata kaydedilemedi:", err);
    }
  }
  }

  /**
   * Not kaydedildiği anda belirtilen yerel klasörde slug.md dosyası oluşturur veya günceller
   * 
   * Gizli (private) notlar için: yerel diske şifresiz içerik kaydedilmez.
   * Şifreleme z-relay'lerde NIP-59 gift wrap (kind: 1059) ile yapılıyor.
   * Yerel disk kopya sadece non-private notlar için opt-in olmalı.
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