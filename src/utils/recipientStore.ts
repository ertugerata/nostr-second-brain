import { nip19 } from "nostr-tools";

const RECIPIENT_NPUBS_STORAGE_KEY = "nostr_allowed_npubs";

export interface NpubValidationResult {
  valid: boolean;
  hexPubkey?: string;
  error?: string;
}

/**
 * npub adresini doğrular ve hex pubkey karşılığını döner.
 */
export function validateNpub(npub: string): NpubValidationResult {
  const trimmed = npub.trim();
  if (!trimmed) {
    return { valid: false, error: "Lütfen bir npub adresi girin." };
  }

  if (!trimmed.startsWith("npub1")) {
    return { valid: false, error: "Npub adresi 'npub1' ile başlamalıdır." };
  }

  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === "npub" && typeof decoded.data === "string") {
      return { valid: true, hexPubkey: decoded.data };
    }
    return { valid: false, error: "Girilen adres geçerli bir npub değil." };
  } catch (e) {
    return { valid: false, error: "Geçersiz npub adresi formatı." };
  }
}

/**
 * Kaydedilmiş izin verilen npub adreslerinin listesini döner.
 */
export function getAllowedNpubs(): string[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  const stored = localStorage.getItem(RECIPIENT_NPUBS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn("Npub alıcı listesi okunamadı:", e);
    }
  }
  return [];
}

/**
 * Yeni bir npub adresi ekler.
 */
export function addAllowedNpub(npub: string): { success: boolean; message: string; hexPubkey?: string } {
  const validation = validateNpub(npub);
  if (!validation.valid || !validation.hexPubkey) {
    return { success: false, message: validation.error || "Geçersiz npub adresi." };
  }

  const trimmed = npub.trim();
  const currentList = getAllowedNpubs();

  if (currentList.includes(trimmed)) {
    return { success: false, message: "Bu npub adresi zaten listede ekli." };
  }

  const updatedList = [...currentList, trimmed];
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(RECIPIENT_NPUBS_STORAGE_KEY, JSON.stringify(updatedList));
  }

  return {
    success: true,
    message: "Npub adresi başarıyla eklendi.",
    hexPubkey: validation.hexPubkey,
  };
}

/**
 * Bir npub adresini listeden siler.
 */
export function removeAllowedNpub(npubToRemove: string): boolean {
  const trimmed = npubToRemove.trim();
  const currentList = getAllowedNpubs();
  const filtered = currentList.filter((item) => item !== trimmed);

  if (filtered.length === currentList.length) {
    return false;
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(RECIPIENT_NPUBS_STORAGE_KEY, JSON.stringify(filtered));
  }
  return true;
}

/**
 * Tüm izin verilen npub adreslerini hex pubkey listesine çevirip döner.
 */
export function getAllowedRecipientPubkeys(): string[] {
  const npubs = getAllowedNpubs();
  const pubkeys: string[] = [];

  for (const npub of npubs) {
    const res = validateNpub(npub);
    if (res.valid && res.hexPubkey) {
      pubkeys.push(res.hexPubkey);
    }
  }

  return pubkeys;
}
