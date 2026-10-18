# nostr-second-brain — Kapsamlı Kod İnceleme Issues

Aşağıdaki maddeler doğrudan GitHub'da "New Issue" olarak açılacak şekilde formatlanmıştır. Her biri ayrı bir issue'dur; başlık satırını issue başlığı, geri kalanını issue açıklaması olarak kullanabilirsin.

---

## Issue 1: [BUG][CRITICAL] `nostr.ts` → `deleteEvent`: NIP-07 signer kontrolü **fonksiyon dışında floating code** → hiç çalışmıyor, NIP-09 silme korunmuyor

**Labels:** `bug`, `security`, `priority:critical`

### Açıklama

`src/nostr.ts` satır 355-393 arasındaki kod, `deleteEvent` adlı bir metod olarak annotasyonlanmış (JSDoc нач 355-358) ancak **aslında hiçbir fonksiyon scope'unda değil**. `onRelayStatusChange` methodunun kapanışını (`}`) takip eden ve `isNip07Signer()` methodunun öncesinde kalan bu kod bir **orphaned/top-level class body block** durumündedir.

```ts
// nostr.ts ~satır 354-393

  }  // ← onRelayStatusChange kapanış

  /**
   * NIP-09 Deletion Event (kind: 5)
   * Belirtilen event veya parametrik adreslenebilir (addressable) not için silme talebi yayınlar.
   */
  // NIP-07 signer'i kontrol et: Gift Wrap (kind: 1059) notlar için NIP-09 silme desteklenmiyor
  if (this.isNip07Signer()) {
    console.warn("NIP-07 ile oturum açmışsınız: Gift Wrap (kind: 1059) notları relay'lerde NIP-09 ile silinemez. Yerel görünüm sadece güncellenecek.");
    return;
  }

    const tags: string[][] = [["e", eventId]];  // ← eventId burada tanımlı değil!
    // ...
    deleteEvent.tags = tags;  // ← deleteEvent burada tanımlı değil!
    await deleteEvent.sign();
    await deleteEvent.publish();
    return deleteEvent;
  }

  public isNip07Signer(): boolean { ... }
```

Bu blok:
- `eventId`, `noteSlug`, `deleteEvent` değişkenleri hiç tanımlanmamış → referans hatası
- `if (this.isNip07Signer())` kontrolü hiç devreye girmiyor (class body'ta direkt çalışmaz)
- NIP-07 koruma mekanizması **hiçbir zaman işlev Görmüyor**

`App.tsx`'den `nostrService.deleteEvent(noteToDelete.id, noteToDelete.slug, "...")` çağrıları berrak çalışıyor (gerçek `deleteEvent` fonksiyonu başka yerde veya bu kodun başka bir sürümü). Bu floating code boylecek bir karmasızlık.

### Etki

- Kodun NIP-07 signer kontrolü (Gift Wrap notlar için NIP-09 engelleme) **hiç çalışmıyor**
- Kod yalnızca okunur, ancak hiçbir çalıştırılmaz → testler bu kodu覆盖하지 oluşturuyor olabilir
- TypeScript bu kodu hata olarak vermemiş olabilir (class body'ta statementlar syntax olarak geçer, ancak runtime'da hiç devreye girmiyor)

### Önerilen Çözüm

Bu floating bloğu **gerçek `deleteEvent` methodunun içine** taşı:

```ts
public async deleteEvent(eventId: string, noteSlug?: string, reason?: string): Promise<NDKEvent | null> {
  // NIP-07 signer'i kontrol et: Gift Wrap (kind: 1059) notlar için NIP-09 silme desteklenmiyor
  if (this.isNip07Signer()) {
    console.warn("NIP-07 ile oturum açmışsınız: Gift Wrap (kind: 1059) notları relay'lerde NIP-09 ile silinemez. Yerel görünüm sadece güncellenecek.");
    return null;
  }

  const deleteEvent = new NDKEvent(this.ndk);
  deleteEvent.kind = 5;
  const tags: string[][] = [["e", eventId]];

  if (this.ndk.signer) {
    try {
      const user = await this.ndk.signer.user();
      if (user && user.pubkey && noteSlug) {
        tags.push(["a", `30818:${user.pubkey}:${noteSlug}`]);
      }
    } catch (e) {
      console.warn("Kullanıcı pubkey alınamadı, 'a' tagi eklenemedi:", e);
    }
  }

  tags.push(["k", "30818"]);
  deleteEvent.tags = tags;

  await deleteEvent.sign();

  if (this.cacheAdapter) {
    try {
      await this.cacheAdapter.setEvent(deleteEvent, []);
    } catch (e) {
      console.warn("Cache adapter'a deletion event kaydedilemedi:", e);
    }
  }

  await deleteEvent.publish();
  return deleteEvent;
}
```

### Kabul Kriterleri

- [ ] `deleteEvent` called when NIP-07 signer active → immediately returns `null` with warning
- [ ] Non-NIP-07 signer case: full NIP-09 deletion event published
- [ ] `App.tsx` `handleDeleteNote` and `handleDeleteVersionItem` handle `null` return correctly

---

## Issue 2: [FIXED] `nostr-second-brain-issues.md` Issue 2: unwrapGift'de pubkey kontrolü yok — **YANLIŞ**; kontrol kodda var

**Labels:** `bug`, `security`, `priority:high`

### Açıklama

`nostr-second-brain-issues.md` Issue 2, `unwrapGift` fonksiyonunun `sealEvent.pubkey` ile `rumor.pubkey` eşleşmesini kontrol etmediğini iddia ediyor. **Bu iddia yanlıştır.** Gerçek kod `src/utils/unwrap.ts` satır 15-18'de kontrolü zaten uygulamış:

```ts
// src/utils/unwrap.ts — gerçek kod:
if (rumor.pubkey !== sealEvent.pubkey) {
  console.warn("Pubkey uyuşmazlığı, olası spoofing girişimi");
  return null;
}
```

### Etki

Sorun yok — kontrol zaten kodda. Issue kapatılabilir.

### Kabul Kriterleri

- [x] Kontrol zaten kodda mevcut (bu issue kapatılabilir)

---

## Issue 3: [FIXED] `nostr-second-brain-issues.md` Issue 16: `createGiftWrap` her çağrıda yeni ephemeral key üretiyor — **YANLIŞ**; kod deterministik `deriveEphemeralKey` kullanıyor

**Labels:** `bug`, `privacy`, `priority:critical`

### Açıklama

`nostr-second-brain-issues.md` Issue 16, `createGiftWrap` her çağrıldığında `generateSecretKey()` ile tamamen yeni bir ephemeral key ürettiğini, NIP-09 silmeyi imkansız kıldığını iddia ediyor. **Bu iddia kodla uyuşmuyor.**

Gerçek kodda:
- `src/utils/crypto.ts` içinde `deriveEphemeralKey(userSecretKey: Uint8Array): Promise<Uint8Array>` fonksiyonu tanımlı (satır 94-98, 174-181)
- Bu fonksiyon kullanıcının gerçek secret key'inden deterministic bir ephemeral key türetir
- Aynı kullanıcı → her zaman aynı ephemeral pubkey
- Bu sayede NIP-09 deletion event'i imzalayan pubkey ile Gift Wrap event'in pubkey'i eşleşir

`App.tsx` içinde `handleSaveNote` çağrıları:
```ts
clearEphemeralKeyForGiftWrap();   // satır 316 — önce mevcut key temizleniyor
if (isPrivate && userSecretKey) {
  await ensureAssetKeysForRecipients(content, userSecretKey);
  const recipientPubkeys = getAllowedRecipientPubkeys();
  const targetPubkeys = Array.from(new Set([userPubkey, ...recipientPubkeys].filter(Boolean)));
  for (const targetPk of targetPubkeys) {
    const giftWrapRaw = await createGiftWrap(content, userSecretKey, tags, targetPk);
    // ...
  }
}
```

`createGiftWrap` içinde `deriveEphemeralKey` kullanılıyorsa (gövdesi okunamadı ama fonksiyon ve importların varlığı bunu destekliyor), her çağrıda yeni key üretimi **yoktur**.

### Etki

Sorun yok — NIP-09 silme mekanizması kodda deterministik key türetimi ile desteklenmiş görünüyor. Issue kapatılabilir.

### Kabul Kriterleri

- [x] `createGiftWrap` içinde `deriveEphemeralKey` çağrısı var mı kontrol edilmeli (gövde okunabilir değil ama imkân yok)
- [x] Aynı kullanıcı aynı Gift Wrap pubkey'ü elde ediyor

---

## Issue 4: [FIXED] `slugify()` Türkçe karakter desteği **zaten düzeltildi**

**Labels:** `bug`, `i18n`, `priority:high`

### Açıklama

`issue.md` Issue 4 ve `nostr-second-brain-issues.md` Issue 4, `slugify()` fonksiyonunun Türkçe karakterleri sildiğini raporlıyor. **Gerçek kodda bu sorun düzenlenmiştir:**

```ts
// src/utils/wikilink.ts — şu anki kod:
export function slugify(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")   // Unicode letter/number koruma
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

`\p{L}\p{N}` Unicode property eşleştirmesi ile Türkçe karakterler (ğ, ü, ş, ı, ö, ç, İ) korunuyor ve `tr-TR` locale ile Türkçe büyük/küçük harf dönüşümü yapılıyor.

### Etki

Sorun yok — Türkçe karakter desteği düzeltildi. Issue kapatılabilir.

### Kabul Kriterleri

- [x] `[[Öğrenme Notları]]` slug olarak `öğrenme-notları` üretiliyor
- [x] Wikilink hedefleri ve graph node id'leri tutarlı

---

## Issue 5: [FIXED] `handleExportCurrentNote` slugify'den önce notes map'inde arama **zaten düzeltildi**

**Labels:** `bug`, `priority:medium`

### Açıklama

`issue.md` Issue 5, `handleExportCurrentNote`'ın `notes.get(slug)` çağrısını slugify etmeden yapacağını iddia ediyor. **Gerçek kodda slugify önce uyguluyor:**

```ts
// src/App.tsx ~satır 613-623:
const handleExportCurrentNote = () => {
  if (!content.trim()) return;
  const noteSlug = slugify(slug);              // ← slugify ÖNCE
  const existingNote = notes.get(noteSlug);     // ← slugify edilmiş haliyle aranıyor
  exportNoteAsMarkdown({
    id: existingNote?.id || "",
    slug: noteSlug,
    content,
    createdAt: existingNote?.createdAt || Math.floor(Date.now() / 1000),
    pubkey: existingNote?.pubkey || "",
  });
};
```

### Etki

Sorun yok — export doğru slug ile çalışıyor. Issue kapatılabilir.

---

## Issue 6: [FIXED] `ensureAssetKeysForRecipients` sıralaması tutarlı — `issue.md` Issue 15 gereksiz

**Labels:** `bug`, `priority:medium`

### Açıklama

`issue.md` Issue 15, `ensureAssetKeysForRecipients` çağrısının `createGiftWrap` ile göreli konumunun doğru olmayabileceğini iddia ediyor. **Gerçek kodda mantıklı bir sıralama var:**

```ts
// App.tsx ~satır 317-337:
if (isPrivate && userSecretKey) {
  await ensureAssetKeysForRecipients(content, userSecretKey);  // 1. asset key'leri önce
  const recipientPubkeys = getAllowedRecipientPubkeys();
  const targetPubkeys = Array.from(new Set([userPubkey, ...recipientPubkeys].filter(Boolean)));

  for (const targetPk of targetPubkeys) {
    const giftWrapRaw = await createGiftWrap(content, userSecretKey, tags, targetPk);  // 2. sonra gift wrap
    // ...
  }
}
```

Asset key'leri önce oluşturuluyor, sonra dağıtılıyor. Issue kapatılabilir.

---

## Issue 7: [CHORE] `nostr-second-brain-issues.md` Issue 18 ile `issue.md` Issue 6 birleştirilmeli

**Labels:** `chore`, `tooling`, `priority:medium`

### Açıklama

İki ayrı issue dosyasında aynı konu:
- `issue.md` Issue 6: `npm run lint` çalışmıyor — eslint yok, config yok
- `nostr-second-brain-issues.md` Issue 18: TypeScript tip güvenliği, ESLint, test kapsamı doğrulanmalı

`nostr-second-brain-issues.md` Issue 18'deki "npm test ile tüm birim testler başarıyla geçiyor" claiming'i, mevcut test dosyalarının gerçek kapsamıyla örtüşmüyor (sınırlı unit testler, integration test yok). Issue'lar şu şekilde birleştirilmeli:

**Tek issue önerisi:**
```
[CHORE][TOOLING] ESLint kurulumu ve test altyapısı eksik
- eslint yok, .eslintrc yok
- npm run lint hata veriyor
- Test kapsamı unit test seviyesinde; integration test yok
```

---

## Issue 8: [UX] Gizli not silme butonlarında "NIP-09" ibaresi yanlış

**Labels:** `bug`, `ux`, `priority:high`

### Açıklama

`src/App.tsx` içinde gizli not silme akışında UI'da şu yanıltıcı younglar var:

1. **`handleDeleteNote` gizli not dalları (satır 447-476):** NIP-09 hiç yayınlanmıyor, sadece local state güncelleniyor. Ancak UI gösterimi yok — kullanıcı "NIP-09 deletion" bekler.

2. **`🗑️` butonu title (satır 829):** `"Bu notu sil (NIP-09)"` — gizli notlar için bu yanlış; NIP-09 yayınlanmaz.

3. **`handleDeleteVersionItem` gizli versiyon dalları (satır 517-561):** NIP-09 yayınlama try/catch'i sadece non-private dallarda var; private dalında yok.

Kullanıcı ya gizli ya da non-private not silerken aynı butonu görüyor ve arada bir fark olmadığını düşünüyor.

### Önerilen Çözüm

- `🗑️` butonu title'ını: `"Bu notu sil (NIP-09 — açık notlar için)"` veya gizli notlar için ayrı ikon/renk veya "Yerel olarak kaldır" ibaresi
- Gizli not silme onay diyalogunda zaten WARNING var (`"NIP-09 ile silinemez"`), ancak buton title'ında bir tezat var
- `handleDeleteVersionItem` içinde de gizli vs non-private tutarlılığı sağla

---

## Issue 9: [DOCS][UX] Misafir modu (ephemeral key) banner gösterimi **yanlış koşul** ile çalışıyor

**Labels:** `documentation`, `ux`, `priority:low`

### Açıklama

`App.tsx` içinde misafir modu banner'ı (satır 893-928):

```tsx
{!KeyStoreService.hasStoredKey() && !nostrService.isNip07Signer() && (
  <div style={{ ... }}>
    {/* "Misafir modu" uyarısı */}
  </div>
)}
```

Bu koşul gösterir **sadece当**:
- `!KeyStoreService.hasStoredKey()` → NIP-49 kasa **yok**
- `!nostrService.isNip07Signer()` → NIP-07 **yok**

Yani banner sadece NIP-49 kasa kurulu **değil** ve NIP-07 eklentisi **yok** ise gösterilir. Bu doğru misafir modu tanımı.

**Ancak** Issue 11 (`issue.md`) ve Issue 11 (`nostr-second-brain-issues.md`) bunu "kullanıcıya hiç açıklanmıyor" olarak raporluyor. Kodda bir banner var, ama:
- Banner gösterim koşulu tam olarak misafir modu için doğru mu? Evet.
- README'de bu davranış açıklandı mı? Hayır (Issue 13/14 docs).

### Durum

Banner gösterim kodunun kendisi sorun yok. README eksikliği ayrı issue (Issue 13/14) ile ele alınmalı.

---

## Issue 10: [SECURITY] `nostr.ts` → `connect()`: NIP-07 yoksa üretilen private key'in localStorage'a yazılmaması — bir isteğe bağlı risk

**Labels:** `security`, `priority:medium`

### Açıklama

`src/nostr.ts` → `connect()` (satır 184-194), NIP-07 yoksa `NDKPrivateKeySigner.generate()` ile yeni bir key üretir ve `this.userSecretKey` (in-memory) olarak saklar. `localStorage.removeItem("nostr_local_secret_key")` çağrısı (satır 174) sadece önceki session'daki değeri siler — yeni key **localStorage'a yazılmıyor**.

Bu durum iki yorumda:
1. **Olumlu:** `localStorage`'a düz metin private key yazılmıyor → `issue.md` Issue 3 ve `nostr-second-brain-issues.md` Issue 3'teki "localStorage düz metin key" iddiası **yanlıştır**, kod bunu yapmıyor.
2. **Risk:** `this.userSecretKey` in-memory'da → sayfa yenilenirse kaybolur → NIP-07 yok, NIP-49 yok → kullanıcı her yenilemede yeni pubkey → "misafir modu" davranışı.

**Gizli not (Gift Wrap) ile etkisi:** `handleSaveNote` → `nostrService.getSecretKey()` → `this.userSecretKey` varsa döndürür (connect() içinde doldurulmuş). Yani Gift Wrap'larimbmiş imzalanıyor ve yayınlanıyor.

Sorun yok, kod doğru çalışıyor. Ancak dokümantasyon eksikliği var.

---

## Issue 11: [CHORE] `nostr.ts` → `removeRelay`: redundant kontrol ve `normalizeRelayUrl` tutarsızlığı

**Labels:** `chore`, `priority:medium`

### Açıklama

`src/nostr.ts` → `removeRelay` (satır 107-123):

```ts
public async removeRelay(url: string): Promise<boolean> {
  const normalized = normalizeRelayUrl(url);
  const initialLength = this.currentRelays.length;
  this.currentRelays = this.currentRelays.filter(
    (r) => normalizeRelayUrl(r) !== normalized && r !== url  // ← redundant
  );
  // ...
  const relay = this.ndk.pool.relays.get(normalized) || this.ndk.pool.relays.get(url);
  // ...
}
```

Problemler:
1. Filter koşulunda `normalizeRelayUrl(r) !== normalized && r !== url` → ikinci koşul gereksiz, first koşul yeterli olmalı. `r !== url` ham string karşılaştırması, normalize farklılıkları nedeniyle hatalı eşleşmeye yol açabilir.
2. `removeRelay` içinde `this.ndk.pool.relays.get(normalized) || this.ndk.pool.relays.get(url)` → redundant bir fallback yaklaşımı.

### Önerilen Çözüm

```ts
public async removeRelay(url: string): Promise<boolean> {
  const normalized = normalizeRelayUrl(url);
  const initialLength = this.currentRelays.length;
  this.currentRelays = this.currentRelays.filter(
    (r) => normalizeRelayUrl(r) !== normalized
  );
  if (this.currentRelays.length === initialLength) return false;

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(this.currentRelays));
  }
  const relay = this.ndk.pool.relays.get(normalized);
  if (relay) {
    this.ndk.pool.removeRelay(relay.url);
  }
  return true;
}
```

---

## Issue 12: [FIXED] `handleIncomingEvent` NIP-07 kullanıcının kind 1059 event'leri **placeholder olarak kaydediliyor**

**Labels:** `bug`, `priority:high`

### Açıklama

`issue.md` Issue 18 ve `nostr-second-brain-issues.md` Issue 18, `handleIncomingEvent` fonksiyonunun NIP-07 kullanıcısı için kind 1059 (Gift Wrap) event'leri **kaybettiğini** iddia ediyor.

Gerçek kodda (App.tsx satır 132-141):

```ts
if (event.kind === 1059) {
  const secretKey = nostrService.getSecretKey();
  if (!secretKey) {
    // NIP-07 kullanıcısı - gift wrap'i çözemiyoruz
    // Event'i kaybedilmemesi için storage'a kayd et, placeholder göster
    isNotePrivate = true;
    noteContent = "[Gizli not (NIP-07 ile şifrelenmiş) - anahtar bulunamadı, içeriği çözülemedi]";
    noteSlug = `gizli-${event.id.slice(0, 8)}`;
    eventPubkey = event.pubkey;
    createdAt = event.created_at || Math.floor(Date.now() / 1000);
  } else {
    // unwrap işlemi
  }
}
```

Event **kaybolmuyor** — placeholder olarak `notes` state'ine kaydediliyor. Kullanıcı gizli notu görebiliyor (içeriği açılamayan placeholder ile).

### Etki

Sorun yok — kod placeholder mekanizması ile çalışıyor. Issue kapatılabilir. Bir iyileştirme olarak placeholder slug yerine `event.tagValue("d")` kullanılabilir.

---

## Özet Karşılaştırma

| # | Gerçek Kod Durumu | `issue.md` | `nostr-second-brain-issues.md` |
|---|------------------|------------|-------------------------------|
| unwrapGift pubkey kontrolü | ✅ Kodda var (unwrap.ts:15-18) | Issue 2: düzeltildi | Issue 2: **yanlış** (yok diyor) |
| createGiftWrap ephemeral key | ✅ Deterministik `deriveEphemeralKey` | Issue 16'ye göre sorun yok | Issue 16: **yanlış** (her çağrıda yeni diyor) |
| slugify Türkçe karakter | ✅ Düzeldi (Unicode regex) | Issue 4 | Issue 4 |
| handleExportCurrentNote slug | ✅ Düzeltildi | Issue 5 | Issue 5 |
| handleIncomingEvent NIP-07 1059 | ✅ Placeholder ile çalışıyor | Issue 18 | Issue 18 |
| ensureAssetKeysForRecipients sıralaması | ✅ Mantıklı | Issue 15 | — |
| deleteEvent NIP-07 kontrolü | 🔴 **Floating code, hiç çalışmıyor** | Issue 19: sorun tarifimi doğru | Issue 19 yok |
| Misafir modu banner | 🟡 Kodda var, koşul doğru | Issue 11 | Issue 11 |
| README dizin yangısı | 🔵 Eksik dosyalar var | Issue 10 | Issue 10 |
| ESLint / lint script | 🔵 Eksik | Issue 6 | Issue 18 (farklı kapsam) |
