import { nip44, getPublicKey, finalizeEvent } from "nostr-tools";

// Not İçeriğini veya veriyi NIP-44 ile şifreleme (alıcı pubkey belirtilmezse kendi pubkey'i kullanılır)
export function encryptContent(content: string, secretKey: Uint8Array, recipientPubkey?: string): string {
  const targetPubkey = recipientPubkey || getPublicKey(secretKey);
  const conversationKey = nip44.v2.utils.getConversationKey(secretKey, targetPubkey);
  return nip44.v2.encrypt(content, conversationKey);
}

// NIP-44 ile şifreli içeriği çözme (gönderen pubkey belirtilmezse kendi pubkey'i kullanılır)
export function decryptContent(ciphertext: string, secretKey: Uint8Array, senderPubkey?: string): string {
  const targetPubkey = senderPubkey || getPublicKey(secretKey);
  const conversationKey = nip44.v2.utils.getConversationKey(secretKey, targetPubkey);
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

// NIP-59 Gift Wrap Zarfı Oluşturma (kind: 1059)
// NOT: rumorKind eklendi (varsayılan 30818 = NIP-54 not). Asset key-wrap gibi farklı
// içerikleri de aynı, denenmiş gizlilik mekanizmasıyla sarmak için genelleleştirildi.
// NIP-44 plaintext limiti 65535 bayttır (~64KB); bu yüzden innerEventContent HER ZAMAN
// küçük olmalıdır (not metni veya bir asset AES anahtarı gibi) — büyük ikili veri asla
// doğrudan buraya verilmemelidir.
export async function createGiftWrap(
  innerEventContent: string,
  userSecretKey: Uint8Array,
  tags: string[][] = [["private", "true"]],
  recipientPubkey?: string,
  rumorKind: number = 30818
): Promise<any> {
  const userPubkey = getPublicKey(userSecretKey);
  const targetPubkey = recipientPubkey || userPubkey;

  const rumorTags = [...tags];
  if (!rumorTags.some((t) => t[0] === "private")) {
    rumorTags.push(["private", "true"]);
  }

  // 1. İç Olay (Rumor - Unsigned Event): Gerçek içerik (not veya asset anahtarı)
  const rumor = {
    kind: rumorKind,
    content: innerEventContent,
    created_at: Math.floor(Date.now() / 1000),
    tags: rumorTags,
    pubkey: userPubkey,
  };

  // 2. Mühürleme (Seal - kind: 13): Rumor'u kullanıcının kendi anahtarıyla şifreler (encryptContent)
  const encryptedRumor = encryptContent(JSON.stringify(rumor), userSecretKey, targetPubkey);

  const sealEvent = finalizeEvent({
    kind: 13,
    content: encryptedRumor,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 1000), // Metadata karmaşası için rastgele geçmiş tarih
    tags: [],
  }, userSecretKey);

  // 3. Gift Wrap (kind: 1059): Derinmistic ephemeral key from user secret key
  // Hash userSecretKey to derive a consistent ephemeral key enabling NIP-09 deletion
  // ÖNEMLİ: Ephemeral (geçici) key DEĞİL, userSecretKey hash'lenerek kullanılıyor!
  // Bu sayede:
  // 1. Note her seferinde aynı pubkey olur (NIP-09 silme çalışır)
  // 2. unwrapGift userSecretKey ile çözülebilir
  const ephemeralSecretKey = await deriveEphemeralKey(userSecretKey);
  const encryptedSeal = encryptContent(JSON.stringify(sealEvent), ephemeralSecretKey, targetPubkey);

  const giftWrapEvent = finalizeEvent({
    kind: 1059,
    content: encryptedSeal,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400), // Rastgele timestamp
    tags: [["p", targetPubkey]], // Zarfa sadece alıcı pubkey yazılır
  }, ephemeralSecretKey);

  return giftWrapEvent;
}

// Helper: Store ephemeral key for current session (for unwrap operations)
const ephemeralKeyStore: Record<string, Uint8Array> = {};

export function setEphemeralKeyForGiftWrap(userPubkey: string, ephemeralKey: Uint8Array): void {
  ephemeralKeyStore[userPubkey] = ephemeralKey;
}

export function getEphemeralKeyForGiftWrap(userPubkey: string): Uint8Array | undefined {
  return ephemeralKeyStore[userPubkey];
}

export function clearEphemeralKeyForGiftWrap(): void {
  Object.keys(ephemeralKeyStore).forEach(key => delete ephemeralKeyStore[key]);
}

// Deterministic ephemeral key derivation from user secret key (for NIP-59 Gift Wrap consistency)
// This ensures the same user always generates the same ephemeral pubkey,
// enabling NIP-09 delete to work since signer's pubkey matches event's pubkey.
export async function deriveEphemeralKey(userSecretKey: Uint8Array): Promise<Uint8Array> {
  // Derive ephemeral key by hashing the user's secret key with SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", userSecretKey);
  return new Uint8Array(hashBuffer);
}

// ---------------------------------------------------------------------------
// AES-256-GCM "Zarf Şifreleme" (Envelope Encryption) — Büyük İkili Veri (Asset) İçin
// ---------------------------------------------------------------------------
// NIP-44'ün 64KB plaintext sınırı yüzünden fotoğraf/PDF gibi büyük dosyalar NIP-44 ile
// doğrudan şifrelenemez. Bunun yerine: dosya baytları rastgele üretilen bir AES-256-GCM
// anahtarıyla şifrelenir (WebCrypto — boyut sınırı pratikte yok). Bu küçük (32 bayt)
// anahtar ise createGiftWrap() ile notla AYNI alıcı listesine NIP-44/NIP-59 üzerinden
// dağıtılır. Sonuç: asset'i açabilmek için hem (a) şifreli blob'a hem (b) o blob'un
// anahtarını içeren gift-wrap'ı çözebilecek gizli anahtara sahip olmak gerekir.

export interface AssetEnvelope {
  ciphertext: Uint8Array;
  ivBase64: string;
}

export async function generateAssetKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportAssetKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64(new Uint8Array(raw));
}

// TS 5.7+ ile Uint8Array/ArrayBuffer tipleri daha katı hale geldi (Uint8Array<ArrayBufferLike>
// artık WebCrypto/Blob API'lerinin beklediği somut ArrayBuffer'a otomatik atanamıyor).
// Bu yardımcı, bağımsız bir ArrayBuffer kopyası üretip tip uyumunu garantiert.
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function importAssetKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptBytes(plainBytes: Uint8Array, key: CryptoKey): Promise<AssetEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM için önerilen 96-bit IV
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, toArrayBuffer(plainBytes));
  return { ciphertext: new Uint8Array(encrypted), ivBase64: bytesToBase64(iv) };
}

export async function decryptBytes(ciphertext: Uint8Array, key: CryptoKey, ivBase64: string): Promise<Uint8Array> {
  const iv = base64ToBytes(ivBase64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext));
  return new Uint8Array(decrypted);
}

// Büyük Uint8Array'lerde call-stack taşmasını önlemek için parça parça (chunked) base64 dönüşümü
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
// Deterministic ephemeral key derivation from user secret key (for NIP-59 Gift Wrap consistency)
// This ensures the same user always generates the same ephemeral pubkey,
// enabling NIP-09 delete to work since signer's pubkey matches event's pubkey.
export async function deriveEphemeralKey(userSecretKey: Uint8Array): Promise<Uint8Array> {
  // Derive ephemeral key by hashing the user's secret key with SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(userSecretKey));
  return new Uint8Array(hashBuffer);
}
