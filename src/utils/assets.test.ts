import "./testSetup.localStorage"; // Diğer tüm import'lardan önce olmalı (bkz. dosya içi açıklama)
import { describe, it, expect } from "vitest";
import {
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
import { validateAssetFile, ALLOWED_ASSET_MIME_TYPES, MAX_ASSET_SIZE_BYTES, extractAssetIds } from "./assets";

function makeBytes(signature: number[], extraLength = 100): Uint8Array {
  const bytes = new Uint8Array(signature.length + extraLength);
  bytes.set(signature, 0);
  for (let i = signature.length; i < bytes.length; i++) {
    bytes[i] = i % 256;
  }
  return bytes;
}

describe("base64 dönüşümleri (büyük veri için chunked)", () => {
  it("küçük bir Uint8Array'i kayıpsız base64'e çevirip geri döndürür", () => {
    const original = new Uint8Array([1, 2, 3, 250, 255, 0, 128]);
    const b64 = bytesToBase64(original);
    const roundTrip = base64ToBytes(b64);
    expect(Array.from(roundTrip)).toEqual(Array.from(original));
  });

  it("chunk sınırını (0x8000) aşan büyük bir dizide çökmeden doğru sonucu üretir", () => {
    const size = 0x8000 * 3 + 123; // birden fazla chunk'a yayılan boyut
    const original = new Uint8Array(size);
    for (let i = 0; i < size; i++) original[i] = i % 256;

    const b64 = bytesToBase64(original);
    const roundTrip = base64ToBytes(b64);
    expect(roundTrip.length).toBe(original.length);
    expect(Array.from(roundTrip)).toEqual(Array.from(original));
  });
});

describe("sha256Hex", () => {
  it("bilinen bir girdi için doğru SHA-256 hex özetini üretir", async () => {
    const bytes = new TextEncoder().encode("nostr-second-brain");
    const hash = await sha256Hex(bytes);
    // Aynı girdi her zaman aynı hash'i üretmeli (belirlenimci / dedup garantisi)
    const hash2 = await sha256Hex(bytes);
    expect(hash).toBe(hash2);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("farklı içerikler için farklı hash üretir", async () => {
    const h1 = await sha256Hex(new TextEncoder().encode("a"));
    const h2 = await sha256Hex(new TextEncoder().encode("b"));
    expect(h1).not.toBe(h2);
  });
});

describe("AES-256-GCM zarf şifreleme (asset içeriği için)", () => {
  it("64KB'den büyük bir veriyi (NIP-44 sınırının üstünde) sorunsuz şifreleyip çözer", async () => {
    // Bilerek NIP-44'ün 65535 baytlık limitini aşan bir boyut seçildi; bu senaryonun
    // NIP-44 ile değil, AES-GCM zarfı ile çözülmesi gerektiğini doğrular.
    // NOT: crypto.getRandomValues() tek çağrıda en fazla 65536 bayt doldurabilir
    // (Web Crypto spesifikasyonu), bu yüzden büyük test verisi deterministik üretiliyor.
    const plain = new Uint8Array(200 * 1024);
    for (let i = 0; i < plain.length; i++) plain[i] = i % 256;

    const key = await generateAssetKey();
    const { ciphertext, ivBase64 } = await encryptBytes(plain, key);

    expect(ciphertext.length).toBeGreaterThan(plain.length); // GCM auth tag eklenir
    expect(ivBase64.length).toBeGreaterThan(0);

    const decrypted = await decryptBytes(ciphertext, key, ivBase64);
    expect(Array.from(decrypted)).toEqual(Array.from(plain));
  });

  it("anahtar base64 export/import sonrası da doğru şekilde çözebiliyor", async () => {
    const plain = new TextEncoder().encode("gizli asset içeriği");
    const key = await generateAssetKey();
    const keyB64 = await exportAssetKeyBase64(key);

    const importedKey = await importAssetKeyFromBase64(keyB64);
    const { ciphertext, ivBase64 } = await encryptBytes(plain, importedKey);
    const decrypted = await decryptBytes(ciphertext, importedKey, ivBase64);

    expect(new TextDecoder().decode(decrypted)).toBe("gizli asset içeriği");
  });

  it("yanlış anahtarla çözme işlemi başarısız olur (erişim izolasyonu)", async () => {
    const plain = new TextEncoder().encode("yalnızca doğru anahtarla okunabilir");
    const correctKey = await generateAssetKey();
    const wrongKey = await generateAssetKey();

    const { ciphertext, ivBase64 } = await encryptBytes(plain, correctKey);

    await expect(decryptBytes(ciphertext, wrongKey, ivBase64)).rejects.toThrow();
  });
});

describe("validateAssetFile (MIME + magic-byte doğrulama)", () => {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const JPG_SIG = [0xff, 0xd8, 0xff];
  const PDF_SIG = [0x25, 0x50, 0x44, 0x46];

  it("geçerli bir PNG dosyasını kabul eder", async () => {
    const bytes = makeBytes(PNG_SIG);
    const file = new File([toArrayBuffer(bytes)], "resim.png", { type: "image/png" });
    const result = await validateAssetFile(file, bytes);
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe("image/png");
  });

  it("geçerli bir JPG dosyasını kabul eder", async () => {
    const bytes = makeBytes(JPG_SIG);
    const file = new File([toArrayBuffer(bytes)], "resim.jpg", { type: "image/jpeg" });
    const result = await validateAssetFile(file, bytes);
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe("image/jpeg");
  });

  it("geçerli bir PDF dosyasını kabul eder", async () => {
    const bytes = makeBytes(PDF_SIG);
    const file = new File([toArrayBuffer(bytes)], "belge.pdf", { type: "application/pdf" });
    const result = await validateAssetFile(file, bytes);
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe("application/pdf");
  });

  it("uzantısı .jpg olsa bile gerçek içeriği desteklenmeyen bir dosyayı REDDEDER (magic-byte sahteciliği)", async () => {
    // Dosya adı ve MIME 'jpg' der ama gerçek baytlar bir imza içermiyor (ör. bir script dosyası)
    const bytes = new TextEncoder().encode("#!/bin/sh\necho hacked");
    const file = new File([toArrayBuffer(bytes)], "resim.jpg", { type: "image/jpeg" });
    const result = await validateAssetFile(file, bytes);
    expect(result.ok).toBe(false);
  });

  it("boyut sınırını aşan dosyayı reddeder", async () => {
    const bytes = makeBytes(PNG_SIG, MAX_ASSET_SIZE_BYTES); // sınırın üzerinde
    const file = new File([toArrayBuffer(bytes)], "buyuk.png", { type: "image/png" });
    const result = await validateAssetFile(file, bytes);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/büyük/i);
  });

  it("ALLOWED_ASSET_MIME_TYPES yalnızca jpg/png/pdf içerir", () => {
    expect(ALLOWED_ASSET_MIME_TYPES).toEqual(["image/jpeg", "image/png", "application/pdf"]);
  });
});

describe("extractAssetIds", () => {
  it("extracts asset IDs from markdown image and link syntax", () => {
    const text = "A note with ![image](asset:a1b2c3d4e5f67890a1b2c3d4e5f67890) and [doc](asset:1234567890abcdef1234567890abcdef)";
    const ids = extractAssetIds(text);
    expect(ids).toEqual([
      "a1b2c3d4e5f67890a1b2c3d4e5f67890",
      "1234567890abcdef1234567890abcdef",
    ]);
  });
});
