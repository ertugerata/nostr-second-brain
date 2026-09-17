import { decryptContent } from "./crypto";

export function unwrapGift(giftWrapEvent: any, userSecretKey: Uint8Array): any | null {
  try {
    // 1. Zarfı (Kind 1059) Ephemeral Pubkey ile Açma
    const sealJson = decryptContent(giftWrapEvent.content, userSecretKey, giftWrapEvent.pubkey);
    const sealEvent = JSON.parse(sealJson);

    if (sealEvent.kind !== 13) return null;

    // 2. Mührü (Kind 13) Gönderen Pubkey ile Açma
    const rumorJson = decryptContent(sealEvent.content, userSecretKey, sealEvent.pubkey);
    const rumor = JSON.parse(rumorJson);

    if (rumor.pubkey !== sealEvent.pubkey) {
      console.warn("Pubkey uyuşmazlığı, olası spoofing girişimi");
      return null;
    }

    return rumor; // Gerçek not içeriğine ulaştık
  } catch (err) {
    console.error("Zarf açılamadı (Farklı anahtar veya bozuk veri):", err);
    return null;
  }
}