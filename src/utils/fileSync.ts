export class LocalFileSyncService {
  private static dirHandle: FileSystemDirectoryHandle | null = null;

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
  public static async saveNoteToLocalDisk(slug: string, content: string, pubkey: string, createdAt: number): Promise<void> {
    if (!this.dirHandle) return;

    try {
      const fileName = `${slug}.md`;
      const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      // YAML Frontmatter ekleyerek kaydet
      const fileContent = `---
title: "${slug}"
pubkey: "${pubkey}"
created_at: ${createdAt}
---

${content}`;

      await writable.write(fileContent);
      await writable.close();
      console.log(`[Yerel Disk] ${fileName} dosyası başarıyla güncellendi.`);
    } catch (err) {
      console.error("[Yerel Disk] Yazma hatası:", err);
    }
  }

  public static isDirectorySelected(): boolean {
    return this.dirHandle !== null;
  }
}