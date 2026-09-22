import { nip19 } from "nostr-tools";

const RECIPIENT_NPUBS_STORAGE_KEY = "nostr_allowed_npubs";

export interface NpubValidationResult {
  valid: boolean;
  hexPubkey?: string;
  error?: string;
}

export interface RecipientItem {
  npub: string;
  addedAt: number; // timestamp in ms
  expiresAt: number | null; // timestamp in ms, null for unlimited / süresiz
}

export const DEFAULT_VALIDITY_DAYS = 30; // Varsayılan 1 ay (30 gün)

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
 * Kaydedilmiş izin verilen alıcıların tam nesne listesini (geçerlilik tarihleri ile) döner.
 * Eski string array formatındaki verileri otomatik RecipientItem yapısına dönüştürür.
 */
export function getAllowedRecipients(): RecipientItem[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  const stored = localStorage.getItem(RECIPIENT_NPUBS_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const items: RecipientItem[] = parsed.map((item: any) => {
      if (typeof item === "string") {
        const now = Date.now();
        return {
          npub: item.trim(),
          addedAt: now,
          expiresAt: now + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
        };
      }
      return {
        npub: item.npub,
        addedAt: item.addedAt || Date.now(),
        expiresAt: item.expiresAt !== undefined ? item.expiresAt : Date.now() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
      };
    });

    return items;
  } catch (e) {
    console.warn("Npub alıcı listesi okunamadı:", e);
    return [];
  }
}

/**
 * Alıcı listesini localStorage'a kaydeder.
 */
function saveAllowedRecipients(items: RecipientItem[]): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(RECIPIENT_NPUBS_STORAGE_KEY, JSON.stringify(items));
  }
}

/**
 * Süresi dolmamış, aktif npub adreslerinin listesini döner.
 */
export function getAllowedNpubs(): string[] {
  const recipients = getAllowedRecipients();
  const now = Date.now();

  return recipients
    .filter((r) => r.expiresAt === null || r.expiresAt > now)
    .map((r) => r.npub);
}

/**
 * Süresi dolmamış aktif alıcıların hex pubkey listesini döner (Gizli not şifreleme için kullanılır).
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

/**
 * Yeni bir npub adresi ekler veya mevcut olanın süresini günceller.
 * @param npub Eklenecek npub adresi
 * @param durationDays Geçerlilik süresi (gün). null geçilirse süresiz/sınırsız olur. Varsayılan 30 gün (1 ay).
 */
export function addAllowedNpub(
  npub: string,
  durationDays: number | null = DEFAULT_VALIDITY_DAYS
): { success: boolean; message: string; hexPubkey?: string } {
  const validation = validateNpub(npub);
  if (!validation.valid || !validation.hexPubkey) {
    return { success: false, message: validation.error || "Geçersiz npub adresi." };
  }

  const trimmed = npub.trim();
  const currentList = getAllowedRecipients();
  const now = Date.now();
  const expiresAt = durationDays === null ? null : now + durationDays * 24 * 60 * 60 * 1000;

  // Mükerrer kayıt kontrolü (npub veya hex pubkey)
  const existingIndex = currentList.findIndex((item) => {
    if (item.npub === trimmed) return true;
    const existingVal = validateNpub(item.npub);
    return existingVal.valid && existingVal.hexPubkey === validation.hexPubkey;
  });

  if (existingIndex >= 0) {
    return {
      success: false,
      message: "Bu npub adresi zaten listede ekli.",
      hexPubkey: validation.hexPubkey,
    };
  }

  const newItem: RecipientItem = {
    npub: trimmed,
    addedAt: now,
    expiresAt,
  };

  currentList.push(newItem);
  saveAllowedRecipients(currentList);

  return {
    success: true,
    message: "Npub adresi başarıyla eklendi.",
    hexPubkey: validation.hexPubkey,
  };
}

/**
 * Mevcut bir npub kaydının geçerlilik süresini günceller.
 */
export function updateRecipientExpiration(npub: string, durationDays: number | null): boolean {
  const currentList = getAllowedRecipients();
  const trimmed = npub.trim();
  const now = Date.now();
  const expiresAt = durationDays === null ? null : now + durationDays * 24 * 60 * 60 * 1000;

  let found = false;
  const updatedList = currentList.map((item) => {
    if (item.npub === trimmed) {
      found = true;
      return { ...item, expiresAt };
    }
    return item;
  });

  if (found) {
    saveAllowedRecipients(updatedList);
  }
  return found;
}

/**
 * Bir npub adresini listeden siler.
 */
export function removeAllowedNpub(npubToRemove: string): boolean {
  const trimmed = npubToRemove.trim();
  const currentList = getAllowedRecipients();
  const filtered = currentList.filter((item) => item.npub !== trimmed);

  if (filtered.length === currentList.length) {
    return false;
  }

  saveAllowedRecipients(filtered);
  return true;
}

/**
 * İzin verilen alıcı listesini `.txt` dosyası olarak dışarı aktarır (download).
 */
export function exportRecipientsToTxt(): void {
  const recipients = getAllowedRecipients();
  if (recipients.length === 0) {
    alert("Dışarı aktarılacak alıcı adresi bulunmuyor.");
    return;
  }

  const lines = recipients.map((item) => {
    let expStr = "Süresiz";
    if (item.expiresAt !== null) {
      const date = new Date(item.expiresAt);
      expStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    }
    return `${item.npub} | ${expStr}`;
  });

  const fileContent = `# Nostr Second Brain - Gizli Not Okuyucu Alıcı Listesi\n# Format: npub1... | YYYY-MM-DD (veya Süresiz)\n\n` + lines.join("\n");
  const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gizli_not_alicilari_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Metin (TXT) içeriğinden npub adreslerini ve varsa geçerlilik tarihlerini okuyup içe aktarır.
 */
export function importRecipientsFromTxt(
  txtContent: string,
  defaultDurationDays: number = DEFAULT_VALIDITY_DAYS
): { addedCount: number; totalFound: number } {
  const lines = txtContent.split(/\r?\n/);
  let addedCount = 0;
  let totalFound = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    // Line format: "npub1... | YYYY-MM-DD" or "npub1..." or "npub1... # comment"
    const parts = trimmedLine.split(/[|\t#]/);
    const npubPart = parts[0].trim();

    if (npubPart.startsWith("npub1")) {
      totalFound++;
      let durationDays: number | null = defaultDurationDays;

      if (parts.length > 1) {
        const datePart = parts[1].trim();
        if (datePart.toLowerCase().includes("süresiz") || datePart.toLowerCase().includes("unlimited")) {
          durationDays = null;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const targetDate = new Date(datePart).getTime();
          if (!isNaN(targetDate)) {
            const diffMs = targetDate - Date.now();
            durationDays = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
          }
        }
      }

      const res = addAllowedNpub(npubPart, durationDays);
      if (res.success) {
        addedCount++;
      }
    }
  }

  return { addedCount, totalFound };
}
