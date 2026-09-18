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
Özellik tamamlanana kadar checkbox'ı UI'dan kaldırın veya yanına "Yakında" / "Deneysel — henüz aktif değil" uyarısı ekleyin, README'deki ilgili bölümü de buna göre güncelleyin.

### Kabul Kriterleri
- [x] `isPrivate=true` ile kaydedilen not relay'lere `kind: 1059` olarak gidiyor
- [x] Gönderen tarafın kendi client'ı notu tekrar açıp çözebiliyor
- [x] Ağ trafiği izlendiğinde (örn. relay tarafında) not içeriği okunamıyor
- [x] README'deki "Gizli Notlar" bölümü gerçek davranışla uyumlu

---

## Issue 2: [SECURITY] `unwrapGift` seal ↔ rumor pubkey eşleşmesini doğrulamıyor

**Labels:** `security`, `priority:high`

### Açıklama
`src/utils/unwrap.ts` içinde Gift Wrap zarfı açıldıktan sonra, çözülen `sealEvent.pubkey` ile içindeki `rumor.pubkey` alanının eşleştiği hiçbir yerde kontrol edilmiyor.

### Etki
NIP-59 spesifikasyonu bu kontrolü sahte gönderici (spoofing) saldırılarına karşı önerir. Kontrol olmadan, zarfı açan biri rumor içeriğindeki `pubkey` alanına güvenip yanlış bir yazara atıf yapabilir.

### Önerilen Çözüm
```ts
if (rumor.pubkey !== sealEvent.pubkey) {
  console.warn("Pubkey uyuşmazlığı, olası spoofing girişimi");
  return null;
}
```

### Kabul Kriterleri
- [x] `rumor.pubkey !== sealEvent.pubkey` durumunda `unwrapGift` `null` dönüyor
- [x] Birim testi ile spoofing senaryosu doğrulanıyor

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
    .replace(/[^\p{L}\p{N}\-]+/gu, "");
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
- Projede `.eslintrc*` veya `eslint.config.js` dosyası bulunmuyor.

### Etki
`npm run lint` komutu doğrudan hata verir; CI'a eklenirse build kırılır.

### Önerilen Çözüm
Ya gerçek bir eslint kurulumu (uygun bir TypeScript/React config ile) ekleyin ya da script'i şimdilik `package.json`'dan kaldırın.

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
- Uygulama ilk açıldığında ve kasa kurulmamışken üst bar'a kalıcı bir banner ekleyin: *"Misafir Modu: Notlarınız yalnızca bu tarayıcı oturumuna özeldir ve kalıcı değildir. Kalıcı hale getirmek için Ayarlar'dan bir Secret Key tanımlayın."*
- README'ye "Kimlik Yönetimi" bölümüne bu davranışı açıkça belgeleyen bir paragraf ekleyin.
- İsteğe bağlı: misafir modda üretilen ephemeral key'i, kullanıcı isterse tek tıkla NIP-49 kasasına "yükseltebileceği" bir kısayol sunun (üretilen key'i sıfırdan yeni bir nsec yerine mevcut ephemeral key'i şifreleyerek kaydetme).

### Kabul Kriterleri
- [x] Misafir modda çalışırken kullanıcıya görünür bir uyarı gösteriliyor
- [x] README bu davranışı açıkça belgeliyor
- [x] (Opsiyonel) Ephemeral key'i kalıcı kasaya yükseltme akışı mevcut

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
Dinamik relay havuzu yönetimi, NIP-65 relay listesi yayınlama (`kind: 10002`), ve canlı WebSocket bağlantı durum göstergesi entegrasyonu.

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

## Issue 15: [SECURITY] Anahtar Saklama Güvenliği (Key Store)

**Labels:** `security`, `privacy`, `priority:high`

### Açıklama
NIP-49 `ncryptsec` (Scrypt + XChaCha20-Poly1305) şifrelemesi ile secret key'lerin güvenli yerel depolanması ve parola doğrulama kuralları.

### Kabul Kriterleri
- [x] Minimum 8 karakterli parola doğrulama kuralı uygulanıyor
- [x] Parolalar `ncryptsec` formatında güvenli olarak şifreleniyor
- [x] Düz metin private key verisi yerel depolamaya yazılmıyor

---

## Issue 16: [ENHANCEMENT] IndexedDB ve Çevrimdışı (Offline) Senkronizasyon Tutarsızlığı

**Labels:** `enhancement`, `offline`, `priority:medium`

### Açıklama
`@nostr-dev-kit/ndk-cache-dexie` adapter'ı ile IndexedDB offline-first depolama ve yerel klasör (`.md`) senkronizasyonu yönetimi.

### Kabul Kriterleri
- [x] Sayfa açılışında veriler IndexedDB önbelleğinden milisaniyeler içinde çekiliyor
- [x] Sayfa yenilemelerinde veya çevrimdışı modda veriler korunuyor
- [x] Yerel klasör senkronizasyonu (`LocalFileSyncService`) opt-in gizlilik kontrolleri ile çalışıyor

---

## Issue 17: [CHORE] Dockerfile ve CI/CD Dağıtım Eksiklikleri

**Labels:** `chore`, `devops`, `priority:low`

### Açıklama
Çok aşamalı Docker (Multi-stage Node + Nginx) container imajının ve docker-compose servis yapılandırmasının oluşturulması.

### Kabul Kriterleri
- [x] Multi-stage Dockerfile başarıyla derleniyor
- [x] Docker Compose ile port 8080 üzerinden uygulama erişilebilir durumda

---

## Issue 18: [CHORE] TypeScript Tip Tanımlamaları ve Test Kapsamı

**Labels:** `chore`, `testing`, `priority:medium`

### Açıklama
TypeScript tip güvenliği (`tsc`), ESLint linter kuralları ve Vitest birim testlerinin kapsama alanının doğrulanması.

### Kabul Kriterleri
- [x] `npm run build` (`tsc && vite build`) hatasız derleniyor
- [x] `npm run lint` uyarısız ve hatasız tamamlanıyor
- [x] `npm test` ile tüm birim testler (unwrap, graphBuilder, fileSync) başarıyla geçiyor
