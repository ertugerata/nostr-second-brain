# Fix Plan for 4 Critical Issues

## Issue 1: Private notes published unencrypted (kind:30818) instead of kind:1059
- Fix: Ensure `handleSaveNote` always uses `createGiftWrap` when `isPrivate=true`
- Fix: Add `kind: 1059` to subscription filters (already present in code)

## Issue 12: NIP-09 deletion fails for Gift Wrap notes
- Root cause: `createGiftWrap` generates new ephemeral key each call, making event pubkey inconsistent
- Fix: Make ephemeral key deterministic in `createGiftWrap`, compatible with `unwrapGift`

## Issue 16: `createGiftWrap` generates new ephemeral key each call
- Root cause: `const ephemeralSecretKey = generateSecretKey()` on every call
- Fix: Derive ephemeral key from `userSecretKey` + `targetPubkey` deterministically

## Issue 17: Local disk sync writes private notes unencrypted
- The `saveNoteToLocalDisk` already has `isPrivate` check that returns `skippedPrivate: true`
- May need to ensure the check is properly triggered and UI reflects the behavior

## Key Files to Modify
1. `src/utils/crypto.ts` - `createGiftWrap` function (fix ephemeral key generation)
2. `src/nostr.ts` - `deleteEvent` method (handle Gift Wrap notes for NIP-09)
3. `src/utils/fileSync.ts` - `saveNoteToLocalDisk` (ensure private notes not written unencrypted)
4. `src/App.tsx` - `handleSaveNote` (ensure gift wrap usage, subscription filters)

## Prerequisites
- `unwrapGift` already uses `userSecretKey` for decryption
- Subscription filters already include `1059 as number` in App.tsx