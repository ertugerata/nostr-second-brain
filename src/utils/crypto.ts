import { nip44, generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";

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
export function createGiftWrap(
  innerEventContent: string,
  userSecretKey: Uint8Array,
  tags: string[][] = [["private", "true"]],
  recipientPubkey?: string
): any {
  const userPubkey = getPublicKey(userSecretKey);
  const targetPubkey = recipientPubkey || userPubkey;

  const rumorTags = [...tags];
  if (!rumorTags.some((t) => t[0] === "private")) {
    rumorTags.push(["private", "true"]);
  }

  // 1. İç Olay (Rumor - Unsigned Event): Gerçek not içeriği
  const rumor = {
    kind: 30818, // NIP-54 Private Wiki Notu
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

  // 3. Gift Wrap (kind: 1059): Ephemeral (geçici) key ile zarflama (encryptContent)
  const ephemeralSecretKey = generateSecretKey();
  const encryptedSeal = encryptContent(JSON.stringify(sealEvent), ephemeralSecretKey, targetPubkey);

  const giftWrapEvent = finalizeEvent({
    kind: 1059,
    content: encryptedSeal,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400), // Rastgele timestamp
    tags: [["p", targetPubkey]], // Zarfa sadece alıcı pubkey yazılır
  }, ephemeralSecretKey);

  return giftWrapEvent;
}
