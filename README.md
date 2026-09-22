# Nostr Second Brain (MVP) 🧠

> Veri mülkiyetini tam olarak kullanıcıya devreden, **Offline-First** mimaride ve **Nostr Protokolü** üzerinde çalışan merkezsiz kişisel bilgi yönetim / ikinci beyin uygulaması.

---

## 🌟 Öne Çıkan Özellikler

- 🔓 **Sıfır Lock-in (Tam Veri Mülkiyeti):** Notlarınız merkezi bir sunucuda kilitli kalmaz. Verileriniz Nostr event'leri olarak sizin tarafınızdan imzalanır ve seçtiğiniz relay'lerde saklanır.
- ⚡ **Offline-First Mimari ve Depolama:** Veriler varsayılan olarak `IndexedDB` (`@nostr-dev-kit/ndk-cache-dexie`) üzerinde saklanır. Sayfa açılışlarında relay yanıtı beklenmez, veriler milisaniyeler içinde yerel önbellekten ekrana getirilir. Ağ bağlantısı olmasa dahi not yazılabilir ve düzenlenebilir.
- 📁 **Yerel Klasör Otomatik Senkronizasyonu (Local File Sync):** Web File System Access API (`showDirectoryPicker`) veya Tauri masaüstü ortamında seçtiğiniz bir klasör ile notlar `.md` (YAML Frontmatter ile) ve eklenen medya/dosyalar `assets/` alt klasörü (Logseq stili) olarak çift yönlü / anlık eşitlenir.
- 📎 **AES-256-GCM Zarf Şifreli Asset/Medya Eklentileri:** Editördeki 📎 butonu ile JPG, PNG, PDF (8MB'a kadar) dosyaları `asset:<id>` söz dizimiyle notlara eklenebilir. Asset'ler AES-256-GCM zarf şifreleme ve NIP-59 anahtar dağıtımı ile korunur; ilgili gizli notun alıcı listesiyle aynı gizlilik garantisine sahiptir.
- 🔗 **NIP-54 Wiki & Wikilink Desteği:** Notlar içinde `[[Not Başlığı]]` veya `[[slug|Görünen İsim]]` formatında bağlantılar oluşturulabilir.
- 🕸️ **Obsidian Tarzı İnteraktif 2D/3D Graph View (`react-force-graph`):** Notlar arasındaki bağlantılar otomatik ayrıştırılarak sürükleyip bırakılabilir, yakınlaştırılabilir, 2D ve 3D modları arasında geçiş yapılabilir interaktif ağ haritası oluşturulur.
- 🔍 **Gelişmiş Arama & Filtreleme (Sidebar & Graph View):** Sol menüde ve Graph View haritasında notlar başlık/slug, metin içeriği, pubkey (hex) ve Bech32 formatındaki `npub1...` Nostr adreslerine göre anlık olarak filtrelenebilir.
- 🌐 **Otomatik Relay Bağlantı & Normalizasyon:** `normalizeRelayUrl` ile URL'ler (`wss://`, trailing slash, küçük harf) standartlaştırılır ve yinelenen relay'ler temizlenir. `setupAutoReconnect` sayesinde sekme tekrar aktif olduğunda (`visibilitychange`) veya internet bağlantısı geri geldiğinde (`online`) kopan relay bağlantıları otomatik olarak taranıp yeniden bağlanılır.
- 🔐 **NIP-49 Güvenli Kasalı Kimlik Yönetimi:** Private key (`nsec1...` veya 64 karakterli Hex formatı), NIP-49 standardı kullanılarak parola ile şifrelenir (`ncryptsec`). Kasa oluşturma hem ilk giriş ekranında (`KeyLoginForm`) hem de Ayarlar (`SettingsView`) sekmesinden yapılabilir. Ayrıca NIP-07 destekli eklentiler (Alby, nos2x) veya misafir modunda geçici (ephemeral) key kullanımı desteklenir.
- 🕵️ **Gizli Notlar & Npub Alıcı Yönetimi (NIP-44 & NIP-59):** Özel notlar NIP-44 ile şifrelenip NIP-59 Gift Wrap (kind: 1059) zarfına sarılarak relay'lere güvenle iletilir. Ayarlar bölümünden ekleyeceğiniz `npub` adreslerine sahip alıcılar için ayrı şifreli zarflar oluşturularak belirlediğiniz kişilerin de gizli notlarınızı okuyabilmesi sağlanır.

---

## 📎 Asset (JPG / PNG / PDF) Eklentileri & Şifreleme Mimarisi

Nostr Second Brain, notlarınıza görsel ve belge eklemenizi sağlayan gelişmiş ve uçtan uca şifreli bir Asset sistemine sahiptir.

### 1. Kullanım ve Söz Dizimi
- **Dosya Yükleme:** Editör araç çubuğundaki **📎 (Dosya Ekle)** butonuna tıklayarak 8MB'a kadar JPG, PNG veya PDF dosyası seçebilirsiniz.
- **Markdown Söz Dizimi:** Yüklenen dosya içeriğe `![Açıklama](asset:<asset-id>)` veya `[Belge](asset:<asset-id>)` şeklinde eklenir.
- **Görüntüleme:** `AssetView.tsx` bileşeni `asset:<id>` referanslarını yakalar, şifresini çözer ve önbellekten (`IndexedDB`) veya relay'lerden okuyarak ekranda gösterir / indirilebilir yapar.

### 2. Şifreleme ve Gizlilik Garantisi
Asset'ler, notun gizlilik seviyesine bağlı olarak tam koruma sağlar:
1. **AES-256-GCM Zarf Şifreleme:** Yüklenen dosya istemci tarafında rastgele üretilen simetrik bir AES-256-GCM anahtarı ile şifrelenir ve `kind: 31736` (Asset Blob) event'i olarak relay'e yayınlanır.
2. **NIP-59 Anahtar Dağıtımı (`kind: 31737` Asset Key Rumor):** Şifre çözme anahtarı, nota erişim yetkisi olan alıcılar (yazarın kendisi ve Ayarlar'da tanımlı tüm `npub` alıcıları) için NIP-59 Gift Wrap (`kind: 1059`) zarfları içerisinde `kind: 31737` özel rumor event'i olarak iletilir.
3. **Gizlilik Garantisi:** İlgili gizli nota erişim yetkisi olmayan üçüncü şahıslar veya relay sunucuları, `kind: 31736` verisine ulaşsalar dahi simetrik AES anahtarına sahip olamadıkları için dosya içeriğini kesinlikle çözemezler.

---

## 🔒 Gizli Not Alıcı Yönetimi (Npub Okuyucu Listesi)

Nostr Second Brain, NIP-59 Gift Wrap mimarisi ile gizli/özel notlarınızı sadece kendinize değil, belirlediğiniz arkadaşlarınız veya ekip üyelerinizle de güvenli şekilde paylaşmanıza olanak tanır.

### Nasıl Kullanılır?
1. **Npub Ekleme:** **Ayarlar (⚙️)** bölümüne gidin. **"🔒 Gizli Not Okuyucu Alıcıları (Npub Yönetimi)"** alanındaki metin kutusuna erişim vermek istediğiniz kişinin `npub1...` adresini girin ve **"+ Alıcı Ekle"** butonuna tıklayın.
2. **Npub Doğrulama ve Depolama:** Girilen npub adresi format ve Bech32 doğrulamalarından geçirilir. Doğrulanan alıcılar listede görünür ve istenildiğinde ❌ butonu ile silinebilir.
3. **Çoklu Alıcı Şifreleme (Multi-Recipient Gift Wrap):** Düzenleyicide **"🔒 NIP-44/59 Gizli Not (Gift Wrap)"** seçeneği işaretlenip not kaydedildiğinde, uygulama hem sizin için hem de Ayarlar'da ekli tüm alıcı npub adresleri için ayrı ayrı şifrelenmiş NIP-59 Gift Wrap zarfları (`kind: 1059`) oluşturup relay'lere yayınlar.
4. **Güvenli Erişim:** İlgili `npub` adresinin sahibi kendi Nostr anahtarlarıyla uygulamaya giriş yaptığında şifreli zarfı çözer ve gizli not içeriğini okuyabilir. Üçüncü şahıslar veya relay sunucuları içeriği kesinlikle göremez.
5. **⚠️ NIP-59 Silme (Deletion) Davranışı ve Relay Sınırlaması:** NIP-59 Gift Wrap (`kind: 1059`) zarfları üst veri ve gönderici gizliliği için her oluşturulduğunda rastgele üretilen geçici (ephemeral) bir anahtarla imzalanır. NIP-09 silme protokolüne göre relay'ler bir silme isteğini yalnızca imzalayan pubkey hedef event'in pubkey'iyle uyuşuyorsa işleme alır. Bu nedenle gizli notlar NIP-09 (`kind: 5`) ile relay'lerden silinemez; uygulamada yapılan silme işlemi notu yalnızca yerel görünümünüzden ve önbelleğinizden kaldırır. Public (açık) notlar ise NIP-09 (`kind: 5`) event'i ile relay'lerden silinir.

---

## ⚡ Çevrimdışı (Offline-First) Yapı & Depolama Mimarisi

Uygulama internet bağlantısı kesildiğinde veya relay'lere ulaşılamadığında dahi kesintisiz çalışacak şekilde tasarlanmıştır.

- **Yerel Önbellek (IndexedDB & Dexie):** Tüm notlar, versiyon geçmişi ve asset dosyaları yerel veritabanında (`IndexedDB` / `@nostr-dev-kit/ndk-cache-dexie`) saklanır.
- **Anında Yükleme:** Uygulama açıldığında veriler relay ağ sorguları beklenmeden IndexedDB'den yüklenir.
- **Çevrimdışı Not Yazma:** Bağlantı yokken oluşturulan veya düzenlenen notlar yerelde saklanır ve bağlantı kurulduğunda relay'lere senkronize edilir.

---

## 📁 Yerel Klasör Senkronizasyonu (Local Directory File Sync)

Nostr Second Brain, notlarınızı ve asset dosyalarınızı sadece Nostr relay'lerinde ve IndexedDB önbelleğinde tutmakla kalmaz; doğrudan bilgisayarınızdaki yerel bir klasörle de çift yönlü / anlık olarak senkronize edebilir.

### Nasıl Çalışır?
1. **Klasör Seçimi:** **Ayarlar (⚙️)** sekmesine giderek **"📁 Senkronizasyon Klasörü Seç"** butonuna tıklayın ve bilgisayarınızda (örneğin Obsidian kasanızın yer aldığı veya notlarınızı saklamak istediğiniz) bir klasör seçin.
2. **Otomatik Yazma (`.md` + YAML Frontmatter):** Editörde her **"Kaydet & İmzala"** butonuna bastığınızda `LocalFileSyncService` modülü ilgili notu seçilen klasörde `not-slug.md` dosyası olarak oluşturur veya günceller.
3. **Logseq Stili Asset Senkronizasyonu:** Yüklenen görseller ve belgeler senkronizasyon klasörünün altındaki `assets/` dizinine otomatik olarak kaydedilir (örn. `assets/asset-id.png`).
4. **YAML Frontmatter Yapısı:** Yerel diske kaydedilen `.md` dosyaları diğer Markdown / Obsidian araçlarıyla %100 uyumludur:
   ```markdown
   ---
   title: "nostr-rehberi"
   pubkey: "npub1..."
   created_at: 1710000000
   ---

   # Nostr Rehberi
   Not içeriğiniz bu alanda yer alır. [[Diğer Not]] referansı verebilirsiniz.
   ![Görsel](asset:123456)
   ```
5. **Dosya Yükleme & Aktarma (Import/Export):** Sol menüdeki **"📂 MD Yükle"** butonunu kullanarak bilgisayarınızdaki mevcut `.md` dosyalarını uygulamaya aktarabilir, düzenleyip Nostr üzerinde imzalayabilirsiniz.
6. **🔒 Gizli Notlar ve Asset'ler için Diske Senkronizasyon (Opt-in):** Yerel diske yazılan `.md` ve `assets/` dosyaları şifrelenmemiş düz metindir. Bu nedenle gizli/şifreli (Gift Wrap) notların ve gizli asset'lerin yerel diske senkronizasyonu varsayılan olarak kapalıdır (opt-in). İsterseniz **Ayarlar** menüsünden *"Gizli (Gift Wrap) Notları Yerel Diske Senkronize Et"* seçeneğini işaretleyerek bu davranışı aktifleştirebilirsiniz.

---

## 🔗 Notlar Arasında Link Verme & Grafik Görünümü (Graph View)

Obsidian tarzı ağ haritasında notlarınızı birbirine bağlamak ve ilişkilerini görselleştirmek son derece kolaydır.

### 1. Wikilink Kullanarak Notları Bağlama
Not yazarken veya düzenlerken metin içerisinde iki köşeli parantez `[[...]]` kullanarak diğer notlara referans verebilirsiniz:

- **Doğrudan Not Başlığı/Slug Bağlantısı:**
  ```markdown
  Bu konuda daha fazla bilgi için [[Nostr Protokolü]] notuna bakabilirsiniz.
  ```
- **Özel Etiketli / Görünen İsimli Bağlantı (`[[slug|Görünen Ad]]`):**
  ```markdown
  Ayrıca [[nostr-rehberi|Nostr Rehberimizi]] inceleyebilirsiniz.
  ```

### 2. Grafik Görünümünde (Graph View) Nasıl Görünür?
- **Otomatik Düğüm (Node) ve Bağlantı (Edge) Oluşturma:** Notu kaydettiğinizde sistem içerikteki tüm `[[wikilink]]` bağlantılarını tarar ve ağ haritasında kaynak not ile hedef not arasına yönlü/yönsüz bir çizgi ekler.
- **Akıllı Filtreleme Seçenekleri:**
  - **`✍️ Benimki & Bağlantıları` (Varsayılan):** Yalnızca kendi imzaladığınız notlar ve doğrudan bağlı referanslar gösterilir (kalabalık ağ karmaşasını önler).
  - **`👤 Yalnızca Benim Notlarım`:** Sadece sizin imzaladığınız notlar listelenir.
  - **`🌐 Tüm Notlar (Relay dahil)`:** Relay'lerden çekilen tüm kullanıcı notları ve bağlantıları haritada görüntülenir.
- **Arama Çubuğu:** Başlık, içerik veya `npub1...` adresi yazarak grafik üzerindeki düğümleri süzebilirsiniz.
- **Henüz Oluşturulmamış Reference Notları (Ghost Nodes):** Eğer referans verdiğiniz not henüz oluşturulmadıysa, grafik haritasında kesikli çizgili ve uyarı simgeli turuncu bir "Oluşturulmadı" düğümü olarak görünür. Üzerine tıklayarak doğrudan yeni not alanına geçebilirsiniz.
- **İnteraktif 2D & 3D Ağ Haritası Kontrolleri:**
  - **2D / 3D Mod Geçişi:** Sağ üstteki `2D` / `3D` butonları ile grafik modunu anında değiştirebilirsiniz.
  - **Düğüm Sürükleme (Drag & Drop):** Düğümleri fare ile tutarak istediğiniz konuma taşıyabilirsiniz.
  - **Yakınlaştırma & Sığdırma:** `➕`, `➖` ve `🔍 Sığdır` butonları ile grafiğe odaklanabilirsiniz.
  - **Not Seçimi:** Herhangi bir düğüme tıkladığınızda o not otomatik olarak editörde açılır.

---

## 🛠️ Kullanılan NIP'ler & Standartlar

| NIP / Kind | Başlık | Kullanım Amacı |
| :--- | :--- | :--- |
| **NIP-01** | Basic Protocol | Temel Nostr event yapısı, dijital imzalar ve relay iletişim kuralları |
| **NIP-04 / NIP-44** | Encrypted Payloads | Not içeriği, mesajlar ve seal paketleri için modern uçtan uca şifreleme |
| **NIP-07** | Browser Extension Signer | `window.nostr` arabirimi ile tarayıcı eklentileri (Alby, nos2x) üzerinden imzalama |
| **NIP-09** | Event Deletion | `kind: 5` ile public (açık) notların relay'lerden silinmesi |
| **NIP-49** | Private Key Encryption | `nsec` veya hex anahtarını parola ile `ncryptsec` formatında şifreleyerek kasada saklama |
| **NIP-54** | Wiki Articles | `kind: 30818` (Addressable Event) ile `d` tag'li [[wikilink]] not yapısı |
| **NIP-59** | Gift Wrap | Ephemeral key ile gizli notları (Rumor `k:14` -> Seal `k:13` -> Gift Wrap `k:1059`) alıcılar için zarflama |
| **Kind 31736** *(Özel)* | Asset Blob | AES-256-GCM ile şifrelenmiş binary asset/medya verisi *(Resmi bir NIP'e ait değildir)* |
| **Kind 31737** *(Özel)* | Asset Key Rumor | NIP-59 Gift Wrap ile şifrelenmiş asset anahtar dağıtım rumor event'i *(Resmi bir NIP'e ait değildir)* |

---

## 🔑 Kimlik Yönetimi, Güvenlik Notu & Kalıcı Kasa

Uygulama 3 farklı kimlik doğrulama yöntemini destekler:

1. **NIP-49 Kasalı Oturum (Giriş & Ayarlar'dan Oluşturulabilir):**
   - Private key (`nsec1...` veya 64 karakterli hex formatı) kullanıcı parolası ile scrypt + XChaCha20-Poly1305 algoritmaları kullanılarak `ncryptsec` formatında şifrelenir.
   - **Esnek Kurulum:** Kasa sadece giriş ekranında (`KeyLoginForm`) değil, oturum açıldıktan sonra **Ayarlar (⚙️)** sekmesinden de hem `nsec1...` hem 64 karakterli hex key girilerek oluşturulabilir.
2. **NIP-07 Tarayıcı Eklentileri:** Alby, nos2x vb. tarayıcı eklentileri üzerinden secret key sayfaya verilmeden güvenli imzalama yapılır.
3. **Misafir Modu (Ephemeral Key):** Kasa kurulmamışsa ve NIP-07 eklentisi yoksa uygulama bellekte geçici bir key oluşturur. Üst bantta uyarı verilir ve tek tıkla Ayarlar sekmesinden bu key kalıcı NIP-49 kasasına yükseltilebilir.

### 🛡️ Tarayıcı vs. Masaüstü (Tauri) Güvenlik Karşılaştırması

| Ortam | Anahtar Depolama | Güvenlik Mimarisi & Farklar |
| :--- | :--- | :--- |
| **Tarayıcı (Web)** | `localStorage` (`ncryptsec` şifreli) | Şifrelenmiş anahtar tarayıcı depolamasında tutulur. Eklenti / XSS risklerine karşı izolasyon tarayıcı sandbox'ı ile sınırlıdır. NIP-07 kullanımı anahtarın sayfaya hiç sızmamasını sağlar. |
| **Masaüstü (Tauri)** | Yerel Kasa / İzole Çalışma Ortamı | Web eklentileri veya tarayıcı içi script müdahalelerine karşı tam işletim sistemi seviyesinde izolasyon sağlar. Doğrudan yerel dosya sistemine güvenli erişim imkanı sunar. |

---

## 📡 Relay Konfigürasyonu, Normalizasyon & `strfry.conf`

Uygulama Nostr relay ağlarıyla kesintisiz ve hatasız iletişim kurmak üzere gelişmiş bir bağlantı yönetim modülüne sahiptir.

### 1. `strfry.conf` Dosyası Ne Amaçla Kullanılır?
Proje kök dizinindeki `strfry.conf` dosyası, C++ ile geliştirilmiş yüksek performanslı **strfry Nostr relay** sunucusunun yapılandırma dosyasıdır.
- **Geliştirme & Yerel Test:** `docker-compose.yml` ile yerel ortamda port `7777` üzerinde çalışan kişisel/özel bir Nostr relay'i ayağa kaldırmak için kullanılır.
- **Sunucu Dağıtımı (Production):** Kendi özel relay sunucusunu kurmak isteyen kullanıcılar için yapılandırma şablonu sağlar.

### 2. Relay URL Normalizasyonu (`normalizeRelayUrl`)
Girilen veya varsayılan relay adresleri şu adımlardan geçerek standartlaştırılır:
- Eksik protokoller otomatik olarak `wss://` biçimine çevrilir.
- Adres küçük harfe dönüştürülür ve sondaki bölü işaretleri (`/`) temizlenir.
- `localStorage` (`nostr_user_relays`), NDK havuzu ve Ayarlar arayüzünde mükerrer kayıtlar engellenir.

### 3. Otomatik Yeniden Bağlanma (`setupAutoReconnect`)
Ağ koptuğunda veya tarayıcı sekmesi arka plana atıldığında relay bağlantıları kesilebilir. `NostrService` modülü:
- Sekme tekrar öne geldiğinde (`visibilitychange`) veya internet erişimi sağlandığında (`online`) kopan relay'leri otomatik tespit eder.
- Periyodik kontrol mekanizması ile arka planda kesilen relay bağlantılarını yeniden başlatır.

---

## 📁 Dizin Yapısı

```text
nostr-second-brain/
├── .github/
│   └── workflows/
│       └── tauri-build.yml  # Linux, Windows ve Android otomatik CI/CD derleme iş akışı
├── packages/                # Derlenen platform paketleri (.deb, .AppImage, .msi, .exe, .apk)
├── scripts/
│   └── copy-packages.mjs    # Derlenen paketleri packages/ dizinine kopyalama betiği
├── src-tauri/               # Tauri v2 masaüstü ve mobil yerel (native) Rust yapılandırması
├── src/
│   ├── main.tsx             # React giriş noktası
│   ├── App.tsx              # Ana uygulama bileşeni (State, Sidebar arama, Offline Sync, Formlar)
│   ├── App.css              # Uygulama CSS stilleri ve tema değişkenleri
│   ├── nostr.ts            # NDK, NIP-49 oturumu, relay yönetimi, Dexie IndexedDB önbelleği ve auto-reconnect
│   ├── nostr.test.ts        # Nostr servis birim testleri
│   ├── components/
│   │   ├── AssetView.tsx    # asset:<id> medya şifre çözme ve işleme bileşeni
│   │   ├── KeyLoginForm.tsx # NIP-49 Parola ile giriş ve anahtar kasası formu
│   │   ├── MarkdownToolbar.tsx # Editör formatlama ve 📎 asset yükleme araç çubuğu
│   │   ├── RelayStatusIndicator.tsx # Bağlı relay durumu ve canlı istatistik göstergesi
│   │   ├── SettingsView.tsx # NIP-49 Kasa, Relay ve Npub alıcı yönetim ekranı
│   │   ├── SimpleGraphView.tsx # react-force-graph ile Obsidian tarzı 2D/3D interaktif ağ haritası
│   │   ├── VersionHistoryModal.tsx # Not versiyon geçmişi ve geri yükleme penceresi
│   │   └── WikiContent.tsx  # Metin içindeki [[Wikilink]] parser ve buton render motoru
│   └── utils/
│       ├── assets.ts        # Asset AES-256-GCM şifreleme, kind 31736/31737 event üretimi ve IndexedDB önbelleği
│       ├── assets.test.ts   # Asset modülü birim testleri
│       ├── crypto.ts        # NIP-44 ve NIP-59 Gift Wrap şifreleme fonksiyonları
│       ├── exportUtils.ts   # Markdown (.md) ve JSON dışa aktarma fonksiyonları
│       ├── fileSync.ts      # Browser File System Access API & Tauri ile yerel .md ve assets/ klasör senkronizasyonu
│       ├── fileSync.test.ts # Yerel dosya senkronizasyonu birim testleri
│       ├── graphBuilder.ts  # Not haritası ve bağlantı (Nodes/Links) oluşturucu
│       ├── graphBuilder.test.ts # Graph builder birim testleri
│       ├── keyStore.ts      # NIP-49 (ncryptsec) şifreleme ve parola doğrulama yönetimi
│       ├── npubSearch.test.ts # npub arama ve çözümleme testleri
│       ├── recipientStore.ts # Npub adres doğrulama, saklama ve alıcı pubkey yönetimi
│       ├── sampleNote.ts    # Varsayılan başlangıç notu içeriği
│       ├── testSetup.localStorage.ts # Test ortamı localStorage mock kurulumu
│       ├── unwrap.ts        # Gift Wrap (Kind 1059) ve Seal (Kind 13) zarf açma ve doğrulama fonksiyonları
│       ├── unwrap.test.ts   # Zarf açma fonksiyonları birim testleri
│       └── wikilink.ts      # NIP-54 Regex, Türkçe uyumlu slugify ve bağlantı ayrıştırıcı
├── Dockerfile              # Docker görsel (image) yapılandırması
├── docker-compose.yml      # Docker Compose servis yapılandırması
├── strfry.conf             # Yerel/Sunucu strfry Nostr relay yapılandırması
├── index.html              # HTML şablonu
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔐 Güvenlik Mimarisi Özeti

```text
[Kullanıcı nsec / Hex Key] + [Parola]
        │
        ▼ (NIP-49: Scrypt + XChaCha20-Poly1305)
  "ncryptsec1..." (Güvenli Şifreli Metin)
        │
        ▼ (localStorage / IndexedDB / Tauri Kasa)
   [Korumalı Depolama]
```

---

## 🔄 Veri Akış Şeması

```text
1. AÇIK NOT (PUBLIC NOTE)
[Açık Not] ──> kind: 30818 ──> [Relay] (Yazar, İçerik, Tarih HERKESE AÇIK)

2. GİZLİ NOT (PRIVATE NOTE - NIP-59 GIFT WRAP)
[Gizli Not] ──> Rumor (k:30818)
                    │
                    ▼ (NIP-44 Şifreleme)
                Seal (k:13)
                    │
                    ▼ (Ephemeral Key + Fake Timestamp + NIP-44)
                Gift Wrap (k:1059) ──> [Relay] (Yazar ve Ayarlar'da tanımlı her bir Npub alıcısına ayrı zarf)

3. ASSET / DOSYA EKLENTİSİ AKIŞI (AES-256-GCM + NIP-59 KEY DISTRIBUTION)
[Dosya (JPG/PNG/PDF)]
        │
        ▼ (AES-256-GCM Simetrik Şifreleme)
[Asset Blob (k:31736)] ───────────────────────────────────────────────────────────> [Relay]
        │
        ├─► Simetrik AES Anahtarı
        │        │
        │        ▼ (NIP-59 Gift Wrap Dağıtımı)
        └─► Asset Key Rumor (k:31737) ──> Seal (k:13) ──> Gift Wrap (k:1059) ──> [Relay]
                                                                                (Sadece Alıcılar Çözebilir)
```

---

## 🖥️ Masaüstü ve Mobil Uygulaması (Tauri v2 - Linux, Windows & Android)

Nostr Second Brain, **Tauri v2** altyapısı sayesinde **Linux**, **Windows** ve **Android** platformlarında yerel (native) bir uygulama olarak derlenebilir ve çalıştırılabilir.

### 🚀 Geliştirme Modunda Çalıştırma

Masaüstü uygulamasını geliştirme ortamında çalıştırmak için:

```bash
npm run tauri:dev
```

### 📦 Masaüstü ve Mobil Paketlerini Derleme (Production Build)

Uygulamanın çalıştırılabilir masaüstü ve mobil paketlerini derlemek için:

#### 1. Masaüstü Derleme (Linux & Windows)
```bash
npm run tauri:build
```
Derleme tamamlandığında paketler `src-tauri/target/release/bundle/` dizininde üretilir:
- **Linux:** `.deb`, `.AppImage`
- **Windows:** `.msi`, `.exe` (NSIS Installer)

#### 2. Android APK Derleme
```bash
npm run tauri:android:init
npm run tauri:android:build
```
Derleme tamamlandığında `.apk` paketleri üretilir.

#### 3. Paketleri `packages/` Dizinine Toplama
Tüm platformlar için üretilen paketleri kök dizindeki `packages/` klasörü altına toplamak için:
```bash
npm run package:copy
```

`packages/` klasörü şu çıktıları barındırır:
- `*.deb` (Debian/Ubuntu)
- `*.AppImage` (Linux Portable)
- `*.msi` (Windows Installer)
- `*.exe` (Windows NSIS Setup)
- `*.apk` (Android Paket)

---

## 🐳 Docker ile Çalıştırma

Uygulamayı Docker kapsayıcısı (container) içerisinde çalıştırmak için aşağıdaki yöntemlerden birini kullanabilirsiniz:

### Docker Compose ile (Önerilen)

`docker-compose.yml` hem uygulamayı hem de yerel `strfry` relay'ini başlatır:

```bash
docker compose up -d
```
Uygulamaya tarayıcınızdan `http://localhost:8080` adresinden erişebilirsiniz. Yerel relay ise `ws://localhost:7777` adresinde aktif olur.

### Docker CLI ile

1. **Docker İmajını Derleyin:**
   ```bash
   docker build -t nostr-second-brain .
   ```

2. **Konteyneri Çalıştırın:**
   ```bash
   docker run -d -p 8080:80 --name nostr-second-brain-app nostr-second-brain
   ```

Tarayıcınızda `http://localhost:8080` adresine gidin.
