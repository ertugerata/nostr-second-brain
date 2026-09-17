import { describe, it, expect } from "vitest";
import { generateSecretKey, getPublicKey, finalizeEvent, nip44 } from "nostr-tools";
import { unwrapGift } from "./unwrap";
import { createGiftWrap, encryptContent, decryptContent } from "./crypto";
import { slugify } from "./wikilink";
import { validateAndEvaluatePassphrase } from "./keyStore";

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
