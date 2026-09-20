import { NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { nostrService } from "../nostr";
import {
  createGiftWrap,
  generateAssetKey,
  exportAssetKeyBase64,
  importAssetKeyFromBase64,
  encryptBytes,
  decryptBytes,
  bytesToBase64,
  base64ToBytes,
  sha256Hex,
  toArrayBuffer,
} from "./crypto";
import { unwrapGift } from "./unwrap";
import { getAllowedRecipientPubkeys } from "./recipientStore";
import { LocalFileSyncService } from "./fileSync";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

// Özel (parameterized replaceable) kind aralığı 30000-39999 içinde, herhangi bir
// resmi NIP'e ait olmayan uygulamaya özgü kind'ler. Not kind'i (30818, NIP-54) ile
// çakışmayacak şekilde seçildi.
export const ASSET_BLOB_KIND = 31736; // Şifreli veya düz ikili veri (base64) taşıyan olay
export const ASSET_KEY_RUMOR_KIND = 31737; // Gift Wrap içine sarılan AES anahtarı "rumor"u

export const ALLOWED_ASSET_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export type AllowedAssetMime = (typeof ALLOWED_ASSET_MIME_TYPES)[number];

export const MAX_ASSET_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB — relay/base64 şişmesi göz önünde makul üst sınır

// Dosya uzantısından bağımsız, gerçek içerik doğrulaması için magic byte imzaları
const MAGIC_BYTES: Record<AllowedAssetMime, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
};

export interface AssetValidationResult {
  ok: boolean;
  error?: string;
  detectedMime?: AllowedAssetMime;
}

export interface UploadAssetResult {
  assetId: string; // sha256 hex — dosya içeriğine göre belirlenir (aynı dosya = aynı id, doğal dedup)
  markdownRef: string; // içeriğe eklenecek hazır markdown referansı
}

// ---------------------------------------------------------------------------
// Doğrulama
// ---------------------------------------------------------------------------

function bytesStartWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function detectMimeFromBytes(bytes: Uint8Array): AllowedAssetMime | null {
  for (const mime of ALLOWED_ASSET_MIME_TYPES) {
    if (MAGIC_BYTES[mime].some((sig) => bytesStartWith(bytes, sig))) {
      return mime;
    }
  }
  return null;
}

/**
 * Dosyayı hem MIME tipi hem de gerçek magic-byte imzasına göre doğrular.
 * Yalnızca File.type'a güvenilmez, çünkü bu değer tarayıcı tarafından kolayca
 * yanlış/eksik raporlanabilir (ör. uzantısı değiştirilmiş bir dosya).
 */
export async function validateAssetFile(file: File, bytes: Uint8Array): Promise<AssetValidationResult> {
  if (file.size <= 0) {
    return { ok: false, error: "Dosya boş görünüyor." };
  }
  if (file.size > MAX_ASSET_SIZE_BYTES) {
    return { ok: false, error: `Dosya çok büyük (maks. ${MAX_ASSET_SIZE_BYTES / 1024 / 1024}MB).` };
  }

  const detected = detectMimeFromBytes(bytes);
  if (!detected) {
    return { ok: false, error: "Yalnızca JPG, PNG veya PDF dosyaları desteklenir." };
  }

  // Bildirilen MIME (varsa) ile algılanan MIME çelişiyorsa yine de algılanana güven,
  // ama şüpheli durumda kullanıcıyı bilgilendirmek adına uyarı döndürülebilir.
  return { ok: true, detectedMime: detected };
}

// ---------------------------------------------------------------------------
// Yükleme (Upload) — Publish
// ---------------------------------------------------------------------------

export interface UploadAssetParams {
  file: File;
  userSecretKey: Uint8Array;
  isPrivate: boolean;
  filename?: string;
}

/**
 * Bir asset dosyasını okur, doğrular, gerekiyorsa şifreler ve relay'lere yayınlar.
 * Gizli notlar (isPrivate=true) için: AES-GCM ile şifrelenir, AES anahtarı notla AYNI
 * alıcı listesine (kullanıcı + izinli npub'lar) createGiftWrap ile NIP-59 sarılır.
 * Bu sayede asset'e erişim, notu okuyabilenlerle kriptografik olarak sınırlanır.
 */
export async function uploadAsset({ file, userSecretKey, isPrivate, filename }: UploadAssetParams): Promise<UploadAssetResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const validation = await validateAssetFile(file, bytes);
  if (!validation.ok || !validation.detectedMime) {
    throw new Error(validation.error || "Dosya doğrulanamadı.");
  }
  const mime = validation.detectedMime;
  const displayName = filename || file.name || `asset.${mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg"}`;

  const assetId = await sha256Hex(bytes);
  const userPubkey = (await nostrService.ndk.signer!.user()).pubkey;

  if (isPrivate) {
    // 1. AES-256-GCM anahtarı üret, dosya baytlarını bununla şifrele (boyut sınırı yok)
    const aesKey = await generateAssetKey();
    const { ciphertext, ivBase64 } = await encryptBytes(bytes, aesKey);
    const aesKeyBase64 = await exportAssetKeyBase64(aesKey);

    // 2. Şifreli blob'u yayınla (public olarak okunabilir ama AES anahtarı olmadan anlamsız)
    const blobEvent = new NDKEvent(nostrService.ndk);
    blobEvent.kind = ASSET_BLOB_KIND;
    blobEvent.content = bytesToBase64(ciphertext);
    blobEvent.tags = [
      ["d", assetId],
      ["m", mime],
      ["size", String(bytes.length)],
      ["alt", displayName],
      ["encrypted", "true"],
      ["iv", ivBase64],
    ];
    await blobEvent.sign();
    if (nostrService.ndk.cacheAdapter) {
      await nostrService.ndk.cacheAdapter.setEvent(blobEvent, []);
    }
    blobEvent.publish().catch((err) => console.warn("Asset blob yayın hatası:", err));

    // 3. AES anahtarını notla AYNI alıcı listesine (kullanıcı + izinli npub'lar) gift-wrap ile dağıt
    const recipientPubkeys = getAllowedRecipientPubkeys();
    const targetPubkeys = Array.from(new Set([userPubkey, ...recipientPubkeys].filter(Boolean)));

    const keyPayload = JSON.stringify({ assetId, key: aesKeyBase64 });

    for (const targetPk of targetPubkeys) {
      const giftWrapRaw = createGiftWrap(
        keyPayload,
        userSecretKey,
        [["asset-id", assetId], ["private", "true"]],
        targetPk,
        ASSET_KEY_RUMOR_KIND
      );
      const keyEvent = new NDKEvent(nostrService.ndk, giftWrapRaw);
      if (nostrService.ndk.cacheAdapter) {
        await nostrService.ndk.cacheAdapter.setEvent(keyEvent, []);
      }
      keyEvent.publish().catch((err) => console.warn(`Asset anahtarı yayın hatası (${targetPk.slice(0, 8)}...):`, err));
    }

    // Yerel önbelleğe düz metin (çözülmüş) hali de yazılır ki kendi cihazımızda anında görüntülenebilsin
    await cacheAssetLocally(assetId, mime, displayName, bytes);
  } else {
    // Public asset: şifreleme yok, doğrudan base64 olarak yayınla
    const blobEvent = new NDKEvent(nostrService.ndk);
    blobEvent.kind = ASSET_BLOB_KIND;
    blobEvent.content = bytesToBase64(bytes);
    blobEvent.tags = [
      ["d", assetId],
      ["m", mime],
      ["size", String(bytes.length)],
      ["alt", displayName],
      ["encrypted", "false"],
    ];
    await blobEvent.sign();
    if (nostrService.ndk.cacheAdapter) {
      await nostrService.ndk.cacheAdapter.setEvent(blobEvent, []);
    }
    blobEvent.publish().catch((err) => console.warn("Asset blob yayın hatası:", err));

    await cacheAssetLocally(assetId, mime, displayName, bytes);
  }

  // Otomatik yerel disk senkronizasyonu (assets/ klasörüne Logseq stili)
  await LocalFileSyncService.saveAssetToLocalDisk(displayName, bytes, mime, isPrivate);

  const markdownRef =
    mime === "application/pdf" ? `[📄 ${displayName}](asset:${assetId})` : `![${displayName}](asset:${assetId})`;

  return { assetId, markdownRef };
}

// ---------------------------------------------------------------------------
// Yerel Önbellek (IndexedDB)
// ---------------------------------------------------------------------------
// NDK'nın kendi Dexie cache'inden ayrı, basit ve bağımsız bir IndexedDB deposu.
// Amaç: aynı asset'i tekrar tekrar relay'den çekip yeniden şifre çözmemek.

const DB_NAME = "nostr-second-brain-assets";
const STORE_NAME = "assets";

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "assetId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface CachedAsset {
  assetId: string;
  mime: string;
  filename: string;
  blob: Blob;
}

async function cacheAssetLocally(assetId: string, mime: string, filename: string, bytes: Uint8Array): Promise<void> {
  try {
    const db = await openAssetDb();
    const blob = new Blob([toArrayBuffer(bytes)], { type: mime });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ assetId, mime, filename, blob } as CachedAsset);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Asset yerel önbelleğe yazılamadı:", e);
  }
}

async function getCachedAsset(assetId: string): Promise<CachedAsset | null> {
  try {
    const db = await openAssetDb();
    return await new Promise<CachedAsset | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(assetId);
      req.onsuccess = () => resolve((req.result as CachedAsset) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Asset önbelleği okunamadı:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Çözümleme (Resolve) — Görüntüleme için object URL üretir
// ---------------------------------------------------------------------------

export interface ResolvedAsset {
  url: string; // object URL (URL.createObjectURL)
  mime: string;
  filename: string;
}

export class AssetAccessDeniedError extends Error {
  constructor(message = "Bu asset'e erişim yetkiniz yok.") {
    super(message);
    this.name = "AssetAccessDeniedError";
  }
}

/**
 * Bir asset:<id> referansını çözer: önce yerel önbelleğe bakar, yoksa relay'den
 * blob event'ini ve (şifreliyse) kullanıcıya ait anahtar gift-wrap'ını bulup çözer.
 * Kullanıcının anahtarı gift-wrap'ı açamıyorsa (yani alıcı listesinde değilse)
 * AssetAccessDeniedError fırlatılır — asset'e erişilemez.
 */
export async function resolveAsset(assetId: string, userSecretKey: Uint8Array | null): Promise<ResolvedAsset> {
  const cached = await getCachedAsset(assetId);
  if (cached) {
    return { url: URL.createObjectURL(cached.blob), mime: cached.mime, filename: cached.filename };
  }

  // 1. Blob event'ini relay'lerden/cache'ten bul
  const blobEvents = await nostrService.ndk.fetchEvents(
    { kinds: [ASSET_BLOB_KIND as number], "#d": [assetId], limit: 1 },
    { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }
  );
  const blobEvent = Array.from(blobEvents)[0];
  if (!blobEvent) {
    throw new Error("Asset bulunamadı (relay'lerde mevcut değil).");
  }

  const mime = blobEvent.tags.find((t) => t[0] === "m")?.[1] || "application/octet-stream";
  const filename = blobEvent.tags.find((t) => t[0] === "alt")?.[1] || assetId;
  const isEncrypted = blobEvent.tags.find((t) => t[0] === "encrypted")?.[1] === "true";
  const cipherBytes = base64ToBytes(blobEvent.content);

  if (!isEncrypted) {
    await cacheAssetLocally(assetId, mime, filename, cipherBytes);
    return { url: URL.createObjectURL(new Blob([toArrayBuffer(cipherBytes)], { type: mime })), mime, filename };
  }

  // 2. Şifreliyse: kullanıcıya adreslenmiş anahtar gift-wrap'ını bul ve çöz
  if (!userSecretKey) {
    throw new AssetAccessDeniedError("Şifreli asset'i açmak için gizli anahtar gerekir.");
  }

  const userPubkey = (await nostrService.ndk.signer!.user()).pubkey;
  const keyWrapEvents = await nostrService.ndk.fetchEvents(
    { kinds: [1059 as number], "#p": [userPubkey], limit: 500 },
    { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }
  );

  let aesKeyBase64: string | null = null;
  for (const wrapEvent of keyWrapEvents) {
    const rumor = unwrapGift(wrapEvent.rawEvent ? wrapEvent.rawEvent() : wrapEvent, userSecretKey);
    if (!rumor || rumor.kind !== ASSET_KEY_RUMOR_KIND) continue;
    try {
      const payload = JSON.parse(rumor.content);
      if (payload.assetId === assetId && payload.key) {
        aesKeyBase64 = payload.key;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!aesKeyBase64) {
    // Blob relay'de var ama bu kullanıcıya adreslenmiş bir anahtar bulunamadı —
    // yani bu kullanıcı notun/asset'in izinli alıcı listesinde değil.
    throw new AssetAccessDeniedError();
  }

  const aesKey = await importAssetKeyFromBase64(aesKeyBase64);
  const ivBase64 = blobEvent.tags.find((t) => t[0] === "iv")?.[1] || "";
  const plainBytes = await decryptBytes(cipherBytes, aesKey, ivBase64);

  await cacheAssetLocally(assetId, mime, filename, plainBytes);
  return { url: URL.createObjectURL(new Blob([toArrayBuffer(plainBytes)], { type: mime })), mime, filename };
}

/** İçerikten `asset:<id>` referanslarını ayıklar (temizlik/önyükleme gibi işler için). */
export function extractAssetIds(content: string): string[] {
  const regex = /\]\(asset:([a-f0-9]{16,64})\)/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}
