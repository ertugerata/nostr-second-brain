import { nip19 } from "nostr-tools";
import * as nip49 from "nostr-tools/nip49";

const STORAGE_KEY = "nostr_encrypted_private_key";

export interface PassphraseValidationResult {
  isValid: boolean;
  score: number; // 0..4
  label: "Çok Zayıf" | "Zayıf" | "Orta" | "Güçlü" | "Çok Güçlü";
  color: string;
  errorMessage?: string;
}

export function validateAndEvaluatePassphrase(passphrase: string): PassphraseValidationResult {
  if (!passphrase || passphrase.length < 8) {
    return {
      isValid: false,
      score: 0,
      label: "Çok Zayıf",
      color: "#ef4444",
      errorMessage: "Parola en az 8 karakter olmalıdır.",
    };
  }

  let score = 0;
  if (passphrase.length >= 8) score += 1;
  if (passphrase.length >= 12) score += 1;
  if (/[A-Z]/.test(passphrase) && /[a-z]/.test(passphrase)) score += 1;
  if (/\d/.test(passphrase) || /[^A-Za-z0-9]/.test(passphrase)) score += 1;

  const labels: Array<PassphraseValidationResult["label"]> = ["Zayıf", "Orta", "Güçlü", "Çok Güçlü", "Çok Güçlü"];
  const colors = ["#f97316", "#eab308", "#3b82f6", "#10b981", "#22c55e"];

  return {
    isValid: true,
    score,
    label: labels[score],
    color: colors[score],
  };
}

export class KeyStoreService {
  /**
   * Private key'i (nsec) kullanıcı parolası ile şifreler (ncryptsec) ve localStorage'a kaydeder.
   */
  public static encryptAndSaveKey(nsec: string, passphrase: string): string {
    let secretKey: Uint8Array;
    const trimmed = nsec.trim();

    if (trimmed.startsWith("nsec1")) {
      const { type, data } = nip19.decode(trimmed);
      if (type !== "nsec") {
        throw new Error("Geçersiz nsec formatı.");
      }
      secretKey = data as Uint8Array;
    } else if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      const match = trimmed.match(/.{1,2}/g);
      if (match) {
        secretKey = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
      } else {
        throw new Error("Geçersiz hex private key.");
      }
    } else {
      throw new Error("Geçersiz private key. 'nsec1...' ile başlamalı veya 64 karakterli hex olmalıdır.");
    }

    // 2. NIP-49 ile ncryptsec formatında şifrele
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