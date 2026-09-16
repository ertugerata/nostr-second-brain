import { nip19 } from "nostr-tools";
import * as nip49 from "nostr-tools/nip49";

const STORAGE_KEY = "nostr_encrypted_private_key";

export class KeyStoreService {
  /**
   * Private key'i (nsec) kullanıcı parolası ile şifreler (ncryptsec) ve localStorage'a kaydeder.
   */
  public static encryptAndSaveKey(nsec: string, passphrase: string): string {
    // 1. nsec string'ini hex byte dizisine çevir
    const { type, data } = nip19.decode(nsec);
    if (type !== "nsec") {
      throw new Error("Geçersiz nsec formatı.");
    }

    const secretKey = data as Uint8Array;

    // 2. NIP-49 ile ncryptsec formatında şifrele (Log N = 16 varsayılan güvenlik seviyesidir)
    const ncryptsec = nip49.encrypt(secretKey, passphrase);

    // 3. Şifrelenmiş veriyi sakla
    localStorage.setItem(STORAGE_KEY, ncryptsec);
    return ncryptsec;
  }

  /**
   * localStorage'da saklanan ncryptsec verisini parola ile çözer ve Uint8Array (secretKey) döndürür.
   */
  public static unlockKey(passphrase: string): Uint8Array {
    const ncryptsec = localStorage.getItem(STORAGE_KEY);
    if (!ncryptsec) {
      throw new Error("Kayıtlı şifreli anahtar bulunamadı.");
    }

    // NIP-49 decrypt ile anahtarı çöz
    const secretKey = nip49.decrypt(ncryptsec, passphrase);
    return secretKey;
  }

  /**
   * Yerelde şifreli anahtar olup olmadığını kontrol eder.
   */
  public static hasStoredKey(): boolean {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  /**
   * Oturumu kapatırken yerel anahtarı siler.
   */
  public static clearStoredKey(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}