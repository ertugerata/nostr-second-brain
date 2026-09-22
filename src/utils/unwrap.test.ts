import { describe, it, expect, beforeEach } from "vitest";
import { generateSecretKey, getPublicKey, finalizeEvent, nip44, nip19 } from "nostr-tools";
import { unwrapGift } from "./unwrap";
import { createGiftWrap, encryptContent, decryptContent } from "./crypto";
import { slugify } from "./wikilink";
import { validateAndEvaluatePassphrase } from "./keyStore";
import {
  validateNpub,
  addAllowedNpub,
  removeAllowedNpub,
  getAllowedNpubs,
  getAllowedRecipientPubkeys,
  getAllowedRecipients,
  importRecipientsFromTxt,
} from "./recipientStore";

// Mock localStorage for node environment in vitest
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("unwrapGift & Security Tests", () => {
  it("encrypts and decrypts content using NIP-44 (encryptContent / decryptContent)", () => {
    const senderSk = generateSecretKey();
    const recipientSk = generateSecretKey();
    const recipientPk = getPublicKey(recipientSk);
    const senderPk = getPublicKey(senderSk);

    // Self-encryption / decryption
    const selfEncrypted = encryptContent("Self secret note", senderSk);
    const selfDecrypted = decryptContent(selfEncrypted, senderSk);
    expect(selfDecrypted).toBe("Self secret note");

    // Peer-to-peer encryption / decryption
    const p2pEncrypted = encryptContent("Secret for peer", senderSk, recipientPk);
    const p2pDecrypted = decryptContent(p2pEncrypted, recipientSk, senderPk);
    expect(p2pDecrypted).toBe("Secret for peer");
  });

  it("unwraps a valid Gift Wrap event successfully", () => {
    const userSecretKey = generateSecretKey();
    const giftWrap = createGiftWrap("Test Secret Content", userSecretKey, [["d", "secret-slug"]]);

    const rumor = unwrapGift(giftWrap, userSecretKey);
    expect(rumor).not.toBeNull();
    expect(rumor.content).toBe("Test Secret Content");
    expect(rumor.pubkey).toBe(getPublicKey(userSecretKey));
  });

  it("unwraps Gift Wrap created for specified recipient pubkey", () => {
    const senderSecretKey = generateSecretKey();
    const recipientSecretKey = generateSecretKey();
    const recipientPubkey = getPublicKey(recipientSecretKey);
    const eveSecretKey = generateSecretKey();

    const giftWrap = createGiftWrap(
      "Özel Paylaşılan Not İçeriği",
      senderSecretKey,
      [["d", "shared-private-note"]],
      recipientPubkey
    );

    // Step 1 check
    const sealJson = decryptContent(giftWrap.content, recipientSecretKey, giftWrap.pubkey);
    const sealEvent = JSON.parse(sealJson);
    expect(sealEvent.kind).toBe(13);

    // Step 2 check
    const rumorJson = decryptContent(sealEvent.content, recipientSecretKey, sealEvent.pubkey);
    const rumorFromSeal = JSON.parse(rumorJson);
    expect(rumorFromSeal.content).toBe("Özel Paylaşılan Not İçeriği");

    // Full unwrap check
    const rumor = unwrapGift(giftWrap, recipientSecretKey);
    expect(rumor).not.toBeNull();
    expect(rumor.content).toBe("Özel Paylaşılan Not İçeriği");
    expect(rumor.pubkey).toBe(getPublicKey(senderSecretKey));

    // Eve attempt check
    const eveAttempt = unwrapGift(giftWrap, eveSecretKey);
    expect(eveAttempt).toBeNull();
  });

  it("returns null when rumor.pubkey !== sealEvent.pubkey (Spoofing Protection)", () => {
    const userSecretKey = generateSecretKey();
    const attackerSecretKey = generateSecretKey();
    const userPubkey = getPublicKey(userSecretKey);
    const victimPubkey = getPublicKey(generateSecretKey());

    // Attacker creates a seal signed by attacker, but containing a rumor with a victim's pubkey
    const spoofedRumor = {
      kind: 30818,
      content: "Fake message from victim",
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", "spoofed"]],
      pubkey: victimPubkey, // Spoofed pubkey!
    };

    const sealConversationKey = nip44.v2.utils.getConversationKey(attackerSecretKey, userPubkey);
    const encryptedRumor = nip44.v2.encrypt(JSON.stringify(spoofedRumor), sealConversationKey);

    const sealEvent = finalizeEvent(
      {
        kind: 13,
        content: encryptedRumor,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      },
      attackerSecretKey
    );

    const ephemeralSecretKey = generateSecretKey();
    const wrapConversationKey = nip44.v2.utils.getConversationKey(ephemeralSecretKey, userPubkey);
    const encryptedSeal = nip44.v2.encrypt(JSON.stringify(sealEvent), wrapConversationKey);

    const giftWrapEvent = finalizeEvent(
      {
        kind: 1059,
        content: encryptedSeal,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", userPubkey]],
      },
      ephemeralSecretKey
    );

    const result = unwrapGift(giftWrapEvent, userSecretKey);
    expect(result).toBeNull();
  });

  it("slugify preserves Turkish characters", () => {
    expect(slugify("Öğrenme Notları")).toBe("öğrenme-notları");
    expect(slugify("Şiir & Sanat")).toBe("şiir-sanat");
  });

  it("validateAndEvaluatePassphrase rejects passphrases shorter than 8 chars", () => {
    expect(validateAndEvaluatePassphrase("1234").isValid).toBe(false);
    expect(validateAndEvaluatePassphrase("StrongP@ss123").isValid).toBe(true);
  });
});

describe("recipientStore Npub Management Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("validateNpub correctly validates valid npubs and rejects invalid strings", () => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const validNpub = nip19.npubEncode(pk);

    const resValid = validateNpub(validNpub);
    expect(resValid.valid).toBe(true);
    expect(resValid.hexPubkey).toBe(pk);

    const resInvalidFormat = validateNpub("invalid12345");
    expect(resInvalidFormat.valid).toBe(false);

    const resEmpty = validateNpub("   ");
    expect(resEmpty.valid).toBe(false);
  });

  it("addAllowedNpub, getAllowedNpubs, removeAllowedNpub, and getAllowedRecipientPubkeys work as expected", () => {
    const sk1 = generateSecretKey();
    const pk1 = getPublicKey(sk1);
    const npub1 = nip19.npubEncode(pk1);

    const sk2 = generateSecretKey();
    const pk2 = getPublicKey(sk2);
    const npub2 = nip19.npubEncode(pk2);

    expect(getAllowedNpubs()).toEqual([]);

    const addRes1 = addAllowedNpub(npub1);
    expect(addRes1.success).toBe(true);
    expect(addRes1.hexPubkey).toBe(pk1);

    expect(getAllowedNpubs()).toEqual([npub1]);

    // Mükerrer ekleme engellenmeli
    const duplicateAdd = addAllowedNpub(npub1);
    expect(duplicateAdd.success).toBe(false);

    // İkinci npub ekle
    addAllowedNpub(npub2);
    expect(getAllowedNpubs()).toEqual([npub1, npub2]);

    expect(getAllowedRecipientPubkeys()).toEqual([pk1, pk2]);

    // Silme
    const removeRes = removeAllowedNpub(npub1);
    expect(removeRes).toBe(true);
    expect(getAllowedNpubs()).toEqual([npub2]);
    expect(getAllowedRecipientPubkeys()).toEqual([pk2]);
  });

  it("handles expiration dates and TXT import/export for allowed recipient npubs", () => {
    const sk1 = generateSecretKey();
    const pk1 = getPublicKey(sk1);
    const npub1 = nip19.npubEncode(pk1);

    const sk2 = generateSecretKey();
    const pk2 = getPublicKey(sk2);
    const npub2 = nip19.npubEncode(pk2);

    // Ekleme: default 30 days
    addAllowedNpub(npub1, 30);
    // Ekleme: süresi dolmuş (negative duration)
    addAllowedNpub(npub2, -1);

    // Active npubs should only include non-expired (npub1)
    expect(getAllowedNpubs()).toEqual([npub1]);
    expect(getAllowedRecipientPubkeys()).toEqual([pk1]);

    // But getAllowedRecipients includes both items with expiration details
    const allRecipients = getAllowedRecipients();
    expect(allRecipients.length).toBe(2);

    // TXT import testing
    const sk3 = generateSecretKey();
    const pk3 = getPublicKey(sk3);
    const npub3 = nip19.npubEncode(pk3);

    const txtData = `# Comment line\n${npub3} | Süresiz\n`;
    const importRes = importRecipientsFromTxt(txtData);
    expect(importRes.addedCount).toBe(1);
    expect(getAllowedNpubs()).toContain(npub3);
  });
});
