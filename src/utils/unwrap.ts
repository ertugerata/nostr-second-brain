import { nip44 } from "nostr-tools";

export function unwrapGift(giftWrapEvent: any, userSecretKey: Uint8Array): any | null {
  try {
    // 1. Zarfı (Kind 1059) Ephemeral Pubkey ile Açma
    const wrapConversationKey = nip44.v2.utils.getConversationKey(userSecretKey, giftWrapEvent.pubkey);
    const sealJson = nip44.v2.decrypt(giftWrapEvent.content, wrapConversationKey);
    const sealEvent = JSON.parse(sealJson);

    if (sealEvent.kind !== 13) return null;

    // 2. Mührü (Kind 13) Gönderen Pubkey ile Açma
    const sealConversationKey = nip44.v2.utils.getConversationKey(userSecretKey, sealEvent.pubkey);
    const rumorJson = nip44.v2.decrypt(sealEvent.content, sealConversationKey);
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