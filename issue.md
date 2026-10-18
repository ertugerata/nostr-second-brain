# nostr-second-brain — Önerilen GitHub Issues

Aşağıdaki maddeler doğrudan GitHub'da "New Issue" olarak açılacak şekilde formatlanmıştır. Her biri ayrı bir issue'dur; başlık satırını issue başlığı, geri kalanını issue açıklaması olarak kullanabilirsin.

---

## Issue 1: [BUG][CRITICAL] "Gizli Not" (NIP-44/59) özelliği UI'a bağlı değil — notlar şifresiz yayınlanıyor

**Labels:** `bug`, `security`, `priority:critical`, `privacy`

### Açıklama
Editördeki "🔒 NIP-44/59 Gizli Not (Gift Wrap)" onay kutusu işaretlendiğinde, `App.tsx` → `handleSaveNote` fonksiyonu notu **şifrelemeden**, sadece `["private", "true"]` tag'i ekleyerek normal `kind: 30818` event'i olarak açık relay'lere yayınlıyor.

`src/utils/crypto.ts` (`createGiftWrap`, `encryptContent`, `decryptContent`) ve `src/utils/unwrap.ts` (`unwrapGift`) dosyaları yazılmış olmasına rağmen **hiçbir yerden çağrılmıyor**. Ayrıca ana subscription filtresi (`nostrService.ndk.subscribe`) yalnızca `kinds: [30818, 5]` dinliyor; `kind: 1059` (Gift Wrap) veya `kind: 13` (Seal) hiç dinlenmiyor.

### Etki
Kullanıcı notunu "gizli" sanıp kaydediyor ama içerik herkese açık relay'lerde düz metin olarak duruyor. Bu, README'de vaat edilen temel bir gizlilik garantisinin ihlalidir.

### Beklenen Davranış
`isPrivate` işaretliyken not, `createGiftWrap` ile sarmalanıp `kind: 1059` olarak yayınlanmalı; subscription'a `kind: 1059` eklenip gelen event'ler `unwrapGift` ile çözülüp editöre/nota yansıtılmalı.

### Geçici Çözüm Önerisi
Özellik tamamlanana kadar checkbox'ı UI'dan kaldırın veya yanına "Yakinda" / "Deneysel — henüz aktif değil" uyarısı ekleyin, README'deki ilgili bölümü de buna göre güncelleyin.

### Kabul Kriterleri
- [x] `isPrivate=true` ile kaydedilen not relay'lere `kind: 1059` olarak gidiyor
- [x] Gönderen tarafın kendi client'ı notu tekrar açıp çözebiliyor
- [x] Ağ trafiği izlendiğinde (örn. relay tarafında) not içeriği okunamıyor
- [x] README'deki "Gizli Notlar" bölümü gerçek davranışla uyumlu

---

## Issue 2: [FIXED] `unwrapGift` seal ↔ rumor pubkey eşleşmesi zaten kontrol ediliyor

**Labels:** `enhancement`, `priority:low`

### Açıklama
`src/utils/unwrap.ts` içinde Gift Wrap açıldıktan sonra, çözülen `sealEvent.pubkey` ile içindeki `rumor.pubkey` alanının eşleştiği kontrol ediliyor (satır 15-18). NIP-59 spesifikasyonu bu kontrolü sahte gönderici (spoofing) saldırılarına karşı önerir, ve bu kod zaten bu kontrolü uyguluyor.

```ts
if (rumor.pubkey !== sealEvent.pubkey) {
  console.warn("Pubkey uyuşmazlığı, olası spoofing girişimi");
  return null;
}
```

### Etki
Kontrol zaten kodda mevcut olduğundan, ek bir düzeltilme gerekmiyor.

### Kabul Kriterleri
- [ ] Kontrol zaten kodda mevcut (bu issue kapatılabilir)

---

## Issue 3: [SECURITY] `getSecretKey()` fallback'i şifrelenmemiş bir private key'i localStorage'a yazıyor

**Labels:** `bug`, `security`, `priority:high`

### Açıklama
`src/nostr.ts` → `getSecretKey()` fonksiyonu, eğer signer'dan doğrudan private key erişilemiyorsa (örn. NIP-07 eklentisi kullanılıyorsa), `nostr_local_secret_key` anahtarıyla localStorage'a **düz metin** rastgele bir secret key üretip yazıyor.

### Etki
- NIP-49 ile "her şey şifreli saklanır" iddiasıyla çelişiyor.
- Bu üretilen anahtarın kullanıcının gerçek NIP-07 kimliğiyle hiçbir ilgisi yok; `SettingsView` bunu "Mevcut Secret Key" olarak gösterdiğinde kullanıcı yanlışlıkla bunu gerçek nsec'iymiş gibi kopyalayıp kullanabilir.

### Önerilen Çözüm
- NIP-07 kullanılıyorsa `getSecretKey()` çağrısını engelleyip UI'da "Secret key NIP-07 eklentisinde saklanıyor, buradan görüntülenemez" mesajı göster.
- Fallback rastgele key üretimini tamamen kaldır ya da en azından NIP-49 ile şifrele.

### Kabul Kriterleri
- [x] NIP-07 oturumunda `SettingsView` sahte bir nsec göstermiyor
- [x] localStorage'da düz metin private key oluşmuyor

---

## Issue 4: [BUG] `slugify()` Türkçe karakterleri siliyor

**Labels:** `bug`, `i18n`, `priority:high`

### Açıklama
`src/utils/wikilink.ts` → `slugify()` fonksiyonunda kullanılan `text.replace(/[^\w\-]+/g, "")` regex'i yalnızca ASCII `\w` karakterlerini koruyor. Türkçe karakterler (ğ, ü, ş, ı, ö, ç, İ) slug'dan tamamen siliniyor.

### Tekrar Üretme Adımları
1. `[[Öğrenme Notları]]` şeklinde bir wikilink içeren not oluştur.
2. Notu kaydet, Graph View'a geç.
3. Node başlığının/slug'ının beklenmedik şekilde kısaldığını gözlemle (örn. "renme-notlar" gibi).

### Önerilen Çözüm
Unicode farkında bir slugify fonksiyonuna geçin:
```ts
export function slugify(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "");
}
```

### Kabul Kriterleri
- [x] Türkçe karakter içeren başlıklar slug'da korunuyor
- [x] Wikilink hedefleri ve graph node id'leri tutarlı kalıyor

---

## Issue 5: [BUG] `handleExportCurrentNote` slug'ı slugify etmeden `notes` map'inde arıyor

**Labels:** `bug`, `priority:medium`

### Açıklama
`src/App.tsx` içinde `handleExportCurrentNote`, `notes.get(slug)` çağrısını `slugify(slug)` uygulamadan yapıyor. Oysa `notes` map'inin anahtarları her zaman slugify edilmiş halde tutuluyor (bkz. `handleSaveNote`, satır 385 civarındaki `currentSlugVersions` hesaplaması).

### Etki
Kayıtlı bir not dışa aktarılmak istendiğinde `notes.get(slug)` `undefined` dönebiliyor; bu da dışa aktarılan `.md` dosyasının `id`, `createdAt`, `pubkey` alanlarının boş/varsayılan değerlerle gitmesine neden oluyor.

### Önerilen Çözüm
```ts
const noteSlug = slugify(slug);
exportNoteAsMarkdown({
  id: notes.get(noteSlug)?.id || "",
  slug: noteSlug,
  content,
  createdAt: notes.get(noteSlug)?.createdAt || Math.floor(Date.now() / 1000),
  pubkey: notes.get(noteSlug)?.pubkey || "",
});
```

### Kabul Kriterleri
- [x] Büyük harf veya boşluk içeren başlıklarla kaydedilmiş notlar doğru metadata ile dışa aktarılıyor

---

## Issue 6: [CHORE] `npm run lint` çalışmıyor — eslint kurulu/konfigüre değil

**Labels:** `chore`, `tooling`, `priority:medium`

### Açıklama
`package.json` içinde `"lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"` tanımlı, ancak:
- `devDependencies` içinde `eslint` paketi yok.
- Proje `.eslintrc*` veya `eslint.config.js` dosyası bulunmuyor.

### Etki
`npm run lint` komutu doğrudan hata verir; CI'a eklenirse build kırılır.

### Önerilen Çözüm
Ya gerçek bir eslint kurulumu (uygun bir TypeScript/React config ile) ekleyin ya da script'i `package.json`'dan kaldırın.

### Kabul Kriterleri
- [x] `npm run lint` hatasız çalışıyor veya script kaldırılmış oluyor

---

## Issue 7: [ENHANCEMENT] Parola gücü kontrolü form'lar arasında tutarsız

**Labels:** `enhancement`, `security`, `priority:medium`

### Açıklama
`SettingsView.tsx` içinde parola en az 4 karakter olmalı kontrolü var, ama `KeyLoginForm.tsx` → `handleSetup` fonksiyonunda **hiçbir uzunluk/güç kontrolü yok**. Ayrıca 4 karakter, NIP-49 (scrypt tabanlı) şifreleme için pratikte çok zayıf bir eşik.

### Önerilen Çözüm
- Ortak bir `validatePassphrase()` yardımcı fonksiyonu yazıp her iki formda da kullanın.
- Minimum uzunluğu en az 8 karaktere çıkarın, isteğe bağlı olarak bir parola gücü göstergesi (zxcvbn vb.) ekleyin.

### Kabul Kriterleri
- [x] Her iki formda da aynı minimum parola kuralı uygulanıyor
- [x] Kullanıcıya parola gücü hakkında görsel geri bildirim var

---

## Issue 8: [ENHANCEMENT] Relay listesi sabit kodlanmış, kullanıcı tarafından yönetilemiyor

**Labels:** `enhancement`, `priority:medium`

### Açıklama
`src/nostr.ts` içindeki `DEFAULT_RELAYS` sabit bir dizi olarak tanımlı. `RelayStatusIndicator` bağlantı durumunu gösteriyor ama kullanıcının relay ekleme/çıkarma imkanı hiçbir yerde (Ayarlar dahil) yok.

### Önerilen Çözüm
`SettingsView`'a bir "Relay Yönetimi" bölümü ekleyin: kullanıcı relay URL'si ekleyip çıkarabilsin, tercihler localStorage'da saklansın ve `NostrService` başlatılırken bu liste kullanılsın.

### Kabul Kriterleri
- [x] Kullanıcı Ayarlar'dan relay ekleyip kaldırabiliyor
- [x] Tercihler sayfa yenilemesinde korunuyor

---

## Issue 9: [ENHANCEMENT] Abonelikte sayfalama / `since` filtresi yok — 200 event limiti sonrası eski notlar hiç çekilmiyor

**Labels:** `enhancement`, `priority:medium`

### Açıklama
`App.tsx` içindeki ana subscription `{ kinds: [30818, 5], limit: 200 }` ile sabit; `since` parametresi veya "daha fazla yükle" mekanizması yok. Kullanıcının/ağın 200'den fazla ilgili event'i varsa en eskiler hiçbir zaman görüntülenmiyor.

### Önerilen Çözüm
- İlk yüklemede en yeni 200 event'i çek, ardından sayfa altına "Daha Fazla Yükle" butonu ekleyip `until` parametresiyle geçmişe doğru sayfalama yapın.

### Kabul Kriterleri
- [x] Kullanıcı 200 event limitinin ötesindeki notlara erişebiliyor

---

## Issue 10: [DOCS] README dizin yapısı gerçek proje yapısıyla senkron değil

**Labels:** `documentation`, `priority:low`

### Açıklama
README'deki "📁 Dizin Yapısı" bölümünde şu dosyalar hiç listelenmemiş, ancak gerçekte mevcut ve önemli işlevler barındırıyor:
- `src/components/MarkdownToolbar.tsx`
- `src/components/SettingsView.tsx`
- `src/components/VersionHistoryModal.tsx`
- `src/components/RelayStatusIndicator.tsx`
- `src/utils/exportUtils.ts`
- `src/utils/sampleNote.ts`

### Önerilen Çözüm
Dizin ağacını gerçek `src/` yapısıyla güncelleyin; ideal olarak bir script ile (örn. `tree` çıktısından) otomatik senkron tutulmasını sağlayın.

### Kabul Kriterleri
- [x] README'deki dizin ağacı `src/` altındaki tüm aktif dosyaları yansıtıyor

---

## Issue 11: [DOCS][UX] Ephemeral key ("misafir modu") davranışı kullanıcıya hiç açıklanmıyor

**Labels:** `documentation`, `ux`, `priority:low`

### Açıklama
`src/nostr.ts` → `connect()` içinde, NIP-07 eklentisi yoksa ve kullanıcı henüz NIP-49 kasa kurmamışsa, `NDKPrivateKeySigner.generate()` ile **her oturumda/sayfa yenilemesinde yeni bir rastgele private key** üretiliyor. Bu key kalıcı olarak saklanmıyor.

Bu davranış kasıtlı bir "misafir modu" gibi görünüyor (kullanıcı kasa kurmadan hemen not yazmaya başlayabiliyor), ancak:
- README'de bu davranıştan hiç bahsedilmiyor.
- Uygulama arayüzünde de kullanıcıya bu konuda herhangi bir uyarı/bilgilendirme gösterilmiyor.

### Etki
Kullanıcı misafir modda not yazıp kaydediyor, sayfayı yeniliyor veya tarayıcıyı kapatıp açıyor; yeni oturumda farklı bir pubkey ile başlıyor ve önceki notları artık "🌐 Diğer" (başkasına ait) sekmesinde görünüyor ya da relay'den gelmemişse tamamen kayboluyor. Bu, veri kaybı izlenimi yaratabilecek kafa karıştırıcı bir UX sorunu.

### Önerilen Çözüm
- Uygulama ilk açıldığında ve kasa kurulmamışken üst bar'a kalıcı bir banner ekleyin: *"Misafir Modu: Notlarınız yalnızca bu tarayıcı oturumunaözeldir ve kalıcı değildir. Kalıcı hale getirmek için Ayarlar'dan bir Secret Key tanımlayın."*
- README'ye "Kimlik Yönetimi" bölümüne bu davranışı açıkça belgeleyen bir paragraf ekleyin.
- İsteğe bağlı: misafir modda üretilen ephemeral key'i, kullanıcı isterse tek tıkla NIP-49 kasasına "yükseltebileceği" bir kısayol sunun (üretilen key'i sıfırdan yeni bir nsec yerine mevcut ephemeral key'i şifreleyerek kaydetme).

### Kabul Kriterleri
- [x] Misafir modda çalışırken kullanıcıya görünür bir uyarı gösteriliyor
- [x] README bu davranışı açıkça belgeliyor
- [x] (Opsiyel) Ephemeral key'i kalıcı kasaya yükseltme akışı mevcut

---

## Issue 12: [BUG][PRIVACY][CRITICAL] Gizli (Gift Wrap) notlarda NIP-09 silme işlemi relay tarafından geçersiz — "silinen" not aslında relay'lerde kalıcı olarak duruyor

**Labels:** `bug`, `privacy`, `security`, `priority:critical`

### Açıklama
Bir not "🔒 Gizli Not" olarak kaydedildiğinde `src/utils/crypto.ts` → `createGiftWrap()`, `kind: 1059` zarfını kullanıcının gerçek anahtarıyla değil, her kayıtta yeni üretilen ve hiçbir yerde saklanmayan bir ephemeral (geçici) anahtarla imzalıyor.

Kullanıcı bu notu daha sonra silmek istediğinde `src/App.tsx` → `handleDeleteNote`, `src/nostr.ts` → `deleteEvent()` üzerinden bir NIP-09 (`kind: 5`) silme isteğini kullanıcının gerçek signer'ıyla imzalayıp yayınlıyor. NIP-09 spesifikasyonuna göre relay'ler bir silme isteğini yalnızca imzalayan pubkey, hedef event'in pubkey'iyle aynıysa kabul eder. Gizli notlarda hedef event'in (`kind: 1059`) pubkey alanı ephemeral bir anahtara ait olduğundan, kullanıcının gerçek anahtarıyla gönderdiği silme isteği bu koşulu hiçbir zaman sağlamaz ve uyumlu relay'ler tarafından görmezden gelinir/reddedilir.

Ayrıca yerel disk senkronizasyonu açıkken gizli notların şifrelenmemiş düz metin içeriği yerel diske otomatik yazılıyordu.

### Önerilen Çözüm
- Silme akışını gizli notlar için farklı ele alın: UI ve onay diyaloglarında gizli notların NIP-59 tasarımı nedeniyle relay'lerden NIP-09 ile silinemeyeceğini, silme işleminin yalnızca yerel görünümü güncelleyeceğini açıkça belirtin.
- Yerel disk senkronizasyonunda gizli notların diske yazılmasını varsayılan olarak kapalı (opt-in) hale getirin ve kullanıcıya açık gizlilik uyarısı ekleyin.
- README dokümantasyonunu güncelleyin.

### Kabul Kriterleri
- [x] Gizli not silindiğinde kullanıcıya, relay'lerdeki kopyaların gerçekten silinip silinemeyeceği doğru şekilde bildiriliyor (yanıltıcı "silindi" mesajı yok)
- [x] README ve/veya UI, Gift Wrap notların NIP-09 ile silinemeyeceğini net bir şekilde belgeliyor
- [x] Yerel disk senkronizasyonu, gizli notları yazmadan önce kullanıcıyı bilgilendiriyor veya bu davranış opt-in hale getiriliyor

---

## Issue 13: [ENHANCEMENT] Nostr Relays & NDK Bağlantı Yönetimi

**Labels:** `enhancement`, `networking`, `priority:medium`

### Açıklama
Dinamic relay havuzu yönetimi, NIP-65 relay listesi yayınlama (`kind: 10002`), ve canlı WebSocket bağlantı durum göstergesi entegrasyonu.

### Kabul Kriterleri
- [x] Dinamik relay ekleme/çıkarma fonksiyonları sorunsuz çalışıyor ve `localStorage` seviyesinde saklanıyor
- [x] NIP-65 Relay List Metadata (`kind: 10002`) standardına uygun şekilde relay tercihleri yayınlanabiliyor
- [x] Canlı relay bağlantı durum göstergesi (`RelayStatusIndicator.tsx`) aktif WebSocket bağlantı durumunu gösteriyor

---

## Issue 14: [BUG] NIP-54 Wikilink Ayrıştırma (Parser) Uyumsuzluğu

**Labels:** `bug`, `i18n`, `priority:high`

### Açıklama
NIP-54 `[[wikilink]]` referanslarının Türkçe karakterler (ğ, ü, ş, ı, ö, ç, İ) ve özel karakterler ile slugify ve regex ayrıştırıcı uyumluluğunun sağlanması.

### Kabul Kriterleri
- [x] Türkçe karakterli `[[wikilink]]` bağlantıları doğru şekilde ayrıştırılıyor
- [x] Slug dönüştürme işleminde Unicode/Türkçe karakter kaybı yaşanmıyor
- [x] `WikiContent.tsx` içerik motoru tıklanabilir wikilink düğmelerini doğru yönlendiriyor

---

## Issue 15: [BUG] `handleSaveNote` gizli not kaydedilirken `ensureAssetKeysForRecipients` çağrısı yanlış sırayla

**Labels:** `bug`, `priority:medium`

### Açıklama
`src/App.tsx` → `handleSaveNote` fonksiyonunda, `isPrivate && userSecretKey` bloğu içindeki `ensureAssetKeysForRecipients(content, userSecretKey)` çağrısı, recipients'lar için asset anahtarlarının önceden oluşturulmasını amaçlıyor. Ancak bu fonksiyon çağrılmadan önce `getAllowedRecipientPubkeys()` çağrısı yapılıyor ve daha sonra `createGiftWrap(content, userSecretKey, tags, targetPk)` ile targetPubkey'lar gönderiliyor. `ensureAssetKeysForRecipients` fonksiyonu `src/utils/assets.ts` içinde tanımlı ve recipients'ın public key'lerini kullanarak asset anahtarları oluşturuyor, ancak bu işlem `createGiftWrap`'dan önce ya da sonra yapılarak anahtar dağılımına etkisi farklı olabiliyor.

### Etki
Recipient'lar notu açabildiğinde asset anahtarını çözebilmek için gereken ek veri eksik olabiliyor veya yanlıs olarak çözümlenebiliyor.

### Önerilen Çözüm
`ensureAssetKeysForRecipients` çağrısını `createGiftWrap` çağrısının hemen önüne veya sonuna taşıyıp, recipient'ların key'lerinin doğru oluşturulduğunu ve `createGiftWrap` ile tutarlı beingirildiğini doğrula.

### Kabul Kriterleri
- [x] Recipient'lar notu açabildiğinde asset anahtarını sorunsuzça çözebiliyor
- [x] Anahtar oluşturma sıralamısı tutarlı ve tahmin edilebilir

---

## Issue 16: [BUG] `createGiftWrap` her çağrısıyla yeni ephemeral key üretiliyor — NIP-09 silmeyi imkansız yapıyor

**Labels:** `bug`, `privacy`, `priority:critical`

### Açıklama
`src/utils/crypto.ts` → `createGiftWrap()` fonksiyonu (satır 58), her çağrıldığında `const ephemeralSecretKey = generateSecretKey();` ile tamamen yeni ve bağımsız bir ephemeral key üretiliyor. Bu key hiçbir yerde kalıcı olarak saklanmıyor; sadece o anki gift wrap eventsine embedded olarak gönderiliyor.

Bu durum NIP-09 (kind: 5) silme işleminin tamamen imkansız hale getiriyor: her not farklı bir ephemeral key ile imzalı farklı bir seal event'e sahip olur, bu yüzden kullanıcının gerçek signer'ıyla imzalanan NIP-09 deletion event'i, hedef event'in pubkey'i ile ephemeral key'in pubkey'i eşleşmediği için relay'ler tarafından reddedilir.

### Etki
Kullanıcılar "gizli" notlarını silmeye çalıştıklarında, relay'ler silme isteğini reddeder ve kullanıcıya yanlış olarak "silindi" bildirimi yapılırken, notlar gerçekten relay'lerde kalıcı olarak kalır.

### Önerilen Çözüm
- `createGiftWrap` içinde ephemeral key generation'ı kaldır ya da key'leri paylaşılır/hierarşik olarak yapılandırın.
- Veya silme işlemi için kullanıcıya explicit bir uyarı gösterin: "Bu not relay'lerden NIP-09 ile silinemez, sadece yerel görünümü güncelleyecektir."

### Kabul Kriterleri
- [x] `createGiftWrap` her çağrısıyla yeni ephemeral key üretmiyor veya key yönetimi değiştirildi
- [x] Kullanıcıya NIP-09 silme kısıtlaması explicit olarak bildiriliyor

---

## Issue 17: [BUG] Yerel disk senkronizasyonu gizli notları şifresiz yazar

**Labels:** `bug`, `privacy`, `priority:critical`

### Açıklama
`src/utils/fileSync.ts` → `saveNoteToLocalDisk` fonksiyonu (satır 77-84), YAML frontmatter ile birlikte içeriyi şifresiz olarak diske yazıyor:
```ts
const fileContent = `---
title: "${slug}"
pubkey: "${pubkey}"
created_at: ${createdAt}
is_private: ${isPrivate}
---
${content}`;
```
Varsayılan olarak `isSyncPrivateNotesEnabled()` `false` döndürsede, `handleSaveNote` fonksiyonunda (App.tsx:373-379) `LocalFileSyncService.saveNoteToLocalDisk(...)` her zaman çağrılıyor. `isPrivate` bayrağı kontrol edilse de, `isSyncPrivateNotesEnabled()` `true` yapıldığında gizli notların şifresiz içeriği diske yazılıyor.

### Etki
Kullanıcının "yerel disk senkronizasyonu" ayarını değiştirebileceği halde, gizli notların içerisi şifresiz olarak diske kaydedilebiliyor. Kullanıcı bu risksizliğini bilmeden "Enable local sync" seçeneğini seçerse, tüm gizli notları açık metin olarak kaybedebiliyor.

### Önerilen Çözüm
- `saveNoteToLocalDisk` içinde `isPrivate === true` olduğunda içeriyi şifrele (ya da en azından uyarı verin).
- Veya `isPrivate && !isSyncPrivateNotesEnabled()` durumunda varsayılan davranışı koruyun ve `isSyncPrivateNotesEnabled()` `true` yapıldığında kullanıcıya "Gizli notlar şifrelenmeden diske kaydedilecek" uyarısı gösterin.
- `isSyncPrivateNotesEnabled()` `true` yapıldığında sadece metadata (slug, pubkey, created_at, is_private) diske kaydedilsin, içerik değil.

### Kabul Kriterleri
- [x] Gizli notlar `isSyncPrivateNotesEnabled()` `true` olsa bile şifresiz diske yazılmuyor
- [x] Kullanıcıya gizlilik riski uyarılıyor
- [x] İsteğe bağlı: şifrelenmiş notlar için opt-in içerik kaydetme

---

## Issue 18: [BUG] `handleIncomingEvent` kind 1059 event'lerinde `getSecretKey()` return early caused note loss

**Labels:** `bug`, `priority:high`

### Açıklama
`src/App.tsx` → `handleIncomingEvent` fonksiyonu (satır 132-141), gelen `kind: 1059` event'inde `nostrService.getSecretKey()` çağrısı `null` ise `return;` ile işlemi erken bitiriyor. Ancak kullanıcı NIP-07 ile oturum açmışsa `getSecretKey()` `null` döndürür ve note hiçbir şekilde cache'e/notes state'e yansıtılmaz.

Bu durum, NIP-07 signer kullanıcıları için gelen gizli notların (kind: 1059) görüntülenmesini engelliyor.

### Etki
NIP-07 ile giriş yapan kullanıcılar, relay'lerden gelen gizli notları ever görmüyor; app içinde "boş" veya "ilgili event yok" gibi bir görüntü görüyor.

### Önerilen Çözüm
- `getSecretKey()` `null` döndürürse, event'i tamamen yok sayma yerine, sadece `isPrivate` bayrağını `false` olarak işle ya da kullanıcıya "Gizli not (NIP-07 ile şifrelı, anahtar bulunamadı)" uyarısı gösterin.

### Kabul Kriterleri
- [x] NIP-07 kullanıcıları gizli notları relay'lerden görebiliyor
- [x] Event'ler kaybolmadan, uygun bir uyarı ile işleniyor

---

## Issue 19: [BUG] `deleteEvent` NIP-09 event'i signer'dan key alınamadığında imzalanmıyor

**Labels:** `bug`, `priority:high`

### Açıklama
`src/nostr.ts` → `deleteEvent` fonksiyonu (satır 359-392), `this.ndk.signer` varsayımıyla çalışıyor. Ancak `isNip07Signer()` true ise `getSecretKey()` `null` döndürür ve `deleteEvent` fonksiyonunda `this.ndk.signer.user()` çağrısı `null` result verir, bu da `["a", "30818:${user.pubkey}:${noteSlug}"]` tag'ının eklenmemesine ve dolayısıyla NIP-09 event'inin eksiksiz imzalanmayıp yayınlanmayışına sebep oluyor.

### Etki
NIP-07 ile oturum açmış kullanıcılar, notları NIP-09 ile silemediği; deletion event'i yayınlanmadan ya da eksik tag'larla yayınlandığı için relay'ler tarafından kabul edilmemiyor.

### Önerilen Çözüm
- `deleteEvent` fonksiyonuna `isNip07Signer()` kontrolü ekleyip, NIP-07 senaryosunda "NIP-09 silme, NIP-59 tasarım gereği relay'lerde desteklenmiyor" uyarısı gösterin.

### Kabul Kriterleri
- [x] NIP-07 kullanıcıları için NIP-09 deletion uyarısı gösteriliyor
- [x] Deletion event'i doğru imzalanıyor veya kullanıcı uyarılıyor

---

## Issue 20: [BUG] `handleLoadMoreNotes` subscription `until` parametresi eski notları etkiliyor

**Labels:** `bug`, `priority:medium`

### Açıklama
`src/App.tsx` → `handleLoadMoreNotes` fonksiyonu (satır 183-213), `until: oldestTimestamp - 1` parametresiyle `kinds: [30818, 5, 1059]` subscription'ı yapılıyor. Ancak `oldestTimestamp` hesaplaması `allNotes.values().map(n => n.createdAt).reduce(...)` ile yapılıyor ve eğer `notes` map'i boşsa veya tek elemanlısa `Math.min` `Infinity` döndüğünden `until` parametresi geçersizになる (positive large number) ve hiçbir event çekilmiyor.

### Etki
"Eski notlar yükle" butonuna basarak daha önce çekilmiş older notlar tekrar çekilemiyor veya baştan başlıyor.

### Önerilen Çözüm
- `oldestTimestamp` hesaplamasında `notes.size > 1` kontrolü ekleyin ya da `Infinity` durumunda `0` veya `Math.floor(Date.now() / 1000)` değerini kullanın.

### Kabul Kriterleri
- [x] "Eski notlar yükle" butonu çalışıp daha eski notları çekiyor
- [x] `until` parametresi boş notes map'i için güvenli bir değer atıyor