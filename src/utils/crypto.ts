import { nip44, generateSecretKey, getPublicKey, finalizeEvent, NDKEvent } from "nostr-tools";

// Not İçeriğini NIP-44 ile Kendi Pubkey'inize Şifreleme
export async function encryptContent(content: string, secretKey: Uint8Array): Promise<string> {
  const pubkey = getPublicKey(secretKey);
  const conversationKey = nip44.v2.utils.getConversationKey(secretKey, pubkey);
  return nip44.v2.encrypt(content, conversationKey);
}

// Şifreli İçeriği Çözme
export async function decryptContent(ciphertext: string, secretKey: Uint8Array, senderPubkey: string): Promise<string> {
  const conversationKey = nip44.v2.utils.getConversationKey(secretKey, senderPubkey);
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

// NIP-59 Gift Wrap Zarfı Oluşturma (kind: 1059)
export function createGiftWrap(
  innerEventContent: string,
  userSecretKey: Uint8Array
): any {
  const userPubkey = getPublicKey(userSecretKey);

  // 1. İç Olay (Rumor - Unsigned Event): Gerçek not içeriği
  const rumor = {
    kind: 30818, // NIP-54 Private Wiki Notu
    content: innerEventContent,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["private", "true"]],
    pubkey: userPubkey,
  };

  // 2. Mühürleme (Seal - kind: 13): Rumor'u kullanıcının kendi anahtarıyla şifreler
  const sealConversationKey = nip44.v2.utils.getConversationKey(userSecretKey, userPubkey);
  const encryptedRumor = nip44.v2.encrypt(JSON.stringify(rumor), sealConversationKey);

  const sealEvent = finalizeEvent({
    kind: 13,
    content: encryptedRumor,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 1000), // Metadata karmaşası için rastgele geçmiş tarih
    tags: [],
  }, userSecretKey);

  // 3. Gift Wrap (kind: 1059): Ephemeral (geçici) key ile zarflama
  const ephemeralSecretKey = generateSecretKey();
  const wrapConversationKey = nip44.v2.utils.getConversationKey(ephemeralSecretKey, userPubkey);
  const encryptedSeal = nip44.v2.encrypt(JSON.stringify(sealEvent), wrapConversationKey);

  const giftWrapEvent = finalizeEvent({
    kind: 1059,
    content: encryptedSeal,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400), // Rastgele timestamp
    tags: [["p", userPubkey]], // Zarfa sadece alıcı pubkey yazılır
  }, ephemeralSecretKey);

  return giftWrapEvent;
}