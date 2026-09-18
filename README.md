# Nostr Second Brain (MVP) 🧠

> Veri mülkiyetini tam olarak kullanıcıya devreden, **Offline-First** mimaride ve **Nostr Protokolü** üzerinde çalışan merkezsiz kişisel bilgi yönetim / ikinci beyin uygulaması.

---

## 🌟 Öne Çıkan Özellikler

- 🔓 **Sıfır Lock-in (Tam Veri Mülkiyeti):** Notlarınız merkezi bir sunucuda kilitli kalmaz. Verileriniz Nostr event'leri olarak sizin tarafınızdan imzalanır ve seçtiğiniz relay'lerde saklanır.
- ⚡ **Offline-First Mimari:** IndexedDB katmanı sayesinde sayfa açılışlarında relay yanıtı beklenmez, veriler milisaniyeler içinde yerel önbellekten (`@nostr-dev-kit/ndk-cache-dexie`) ekrana getirilir. Ağ bağlantısı olmasa dahi not yazılabilir.
- 📁 **Yerel Klasör Otomatik Senkronizasyonu (Local File Sync):** Web File System Access API (`showDirectoryPicker`) ile bilgisayarınızdaki bir klasörü seçebilir, yazdığınız veya güncellediğiniz notların yerel diskteki `.md` dosyalarına YAML Frontmatter ile anında otomatik kaydedilmesini sağlayabilirsiniz.
- 🔗 **NIP-54 Wiki & Wikilink Desteği:** Notlar içinde `[[Not Başlığı]]` veya `[[slug|Görünen İsim]]` formatında bağlantılar oluşturulabilir.
- 🕸️ **Obsidian Tarzı İnteraktif 2D/3D Graph View (`react-force-graph`):** Notlar arasındaki bağlantılar otomatik ayrıştırılarak sürükleyip bırakılabilir, yakınlaştırılabilir, 2D ve 3D modları arasında geçiş yapılabilir interaktif ağ haritası oluşturulur.
- 🎯 **Akıllı Ağ Filtreleme (Kendi İmzaladığınız Notlar Öncelikli):** Relay'lerde çok sayıda nokta ve kalabalık olduğunda varsayılan olarak yalnızca sizin imzaladığınız notlar ve bunlarla ilişkili doğrudan bağlantılar gösterilir. İstenildiğinde tek tıkla tüm ağ görüntülenebilir.
- 🔐 **NIP-49 Güvenli Kasalı Kimlik Yönetimi:** Private key (`nsec`), NIP-49 standardı kullanılarak kullanıcı parolasıyla şifrelenir (`ncryptsec`) ve sadece yerel depolamada saklanır. Ayrıca NIP-07 destekli eklentiler (Alby, nos2x vb.) veya misafir modunda geçici (ephemeral) key kullanımı desteklenir.
- 🕵️ **Gizli Notlar & Npub Alıcı Yönetimi (NIP-44 & NIP-59):** Özel notlar NIP-44 ile şifrelenip NIP-59 Gift Wrap (kind: 1059) zarfına sarılarak relay'lere güvenle iletilir. Ayarlar bölümünden ekleyeceğiniz `npub` adreslerine sahip alıcılar için ayrı şifreli zarflar oluşturularak belirlediğiniz kişilerin de gizli notlarınızı okuyabilmesi sağlanır.

---

## 🔒 Gizli Not Alıcı Yönetimi (Npub Okuyucu Listesi)

Nostr Second Brain, NIP-59 Gift Wrap mimarisi ile gizli/özel notlarınızı sadece kendinize değil, belirlediğiniz arkadaşlarınız veya ekip üyelerinizle de güvenli şekilde paylaşmanıza olanak tanır.

### Nasıl Kullanılır?
1. **Npub Ekleme:** **Ayarlar (⚙️)** bölümüne gidin. **"🔒 Gizli Not Okuyucu Alıcıları (Npub Yönetimi)"** alanındaki metin kutusuna erişim vermek istediğiniz kişinin `npub1...` adresini girin ve **"+ Alıcı Ekle"** butonuna tıklayın.
2. **Npub Doğrulama ve Depolama:** Girilen npub adresi format ve Bech32 doğrulamalarından geçirilir. Doğrulanan alıcılar listede görünür ve istenildiğinde ❌ butonu ile silinebilir.
3. **Çoklu Alıcı Şifreleme (Multi-Recipient Gift Wrap):** Düzenleyicide **"🔒 NIP-44/59 Gizli Not (Gift Wrap)"** seçeneği işaretlenip not kaydedildiğinde, uygulama hem sizin için hem de Ayarlar'da ekli tüm alıcı npub adresleri için ayrı ayrı şifrelenmiş NIP-59 Gift Wrap zarfları (kind: 1059) oluşturup relay'lere yayınlar.
4. **Güvenli Erişim:** İlgili `npub` adresinin sahibi kendi Nostr anahtarlarıyla uygulamaya giriş yaptığında şifreli zarfı çözer ve gizli not içeriğini okuyabilir. Üçüncü şahıslar veya relay sunucuları içeriği kesinlikle göremez.

---

## 📁 Yerel Klasör Senkronizasyonu (Local Directory File Sync)

Nostr Second Brain, notlarınızı sadece Nostr relay'lerinde ve IndexedDB önbelleğinde tutmakla kalmaz; doğrudan bilgisayarınızdaki yerel bir klasörle de çift yönlü / anlık olarak senkronize edebilir.

### Nasıl Çalışır?
1. **Klasör Seçimi:** **Ayarlar (⚙️)** sekmesine giderek **"📁 Senkronizasyon Klasörü Seç"** butonuna tıklayın ve bilgisayarınızda (örneğin Obsidian kasanızın yer aldığı veya notlarınızı saklamak istediğiniz) bir klasör seçin.
2. **Otomatik Yazma (`.md` + YAML Frontmatter):** Editörde her **"Kaydet & İmzala"** butonuna bastığınızda `LocalFileSyncService` modülü ilgili notu seçilen klasörde `not-slug.md` dosyası olarak oluşturur veya günceller.
3. **YAML Frontmatter Yapısı:** Yerel diske kaydedilen `.md` dosyaları diğer Markdown / Obsidian araçlarıyla %100 uyumludur:
   ```markdown
   ---
   title: "nostr-rehberi"
   pubkey: "npub1..."
   created_at: 1710000000
   ---

   # Nostr Rehberi
   Not içeriğiniz bu alanda yer alır. [[Diğer Not]] referansı verebilirsiniz.
   ```
4. **Dosya Yükleme & Aktarma (Import/Export):** Sol menüdeki **"📂 MD Yükle"** butonunu kullanarak bilgisayarınızdaki mevcut `.md` dosyalarını uygulamaya aktarabilir, düzenleyip Nostr üzerinde imzalayabilirsiniz.

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
- **Henüz Oluşturulmamış Reference Notları (Ghost Nodes):** Eğer referans verdiğiniz not henüz oluşturulmadıysa, grafik haritasında kesikli çizgili ve uyarı simgeli turuncu bir "Oluşturulmadı" düğümü olarak görünür. Üzerine tıklayarak doğrudan yeni not alanına geçebilirsiniz.
- **İnteraktif 2D & 3D Ağ Haritası Kontrolleri:**
  - **2D / 3D Mod Geçişi:** Sağ üstteki `2D` / `3D` butonları ile grafik modunu anında değiştirebilirsiniz.
  - **Düğüm Sürükleme (Drag & Drop):** Düğümleri fare ile tutarak istediğiniz konuma taşıyabilirsiniz.
  - **Süzme & Arama:** Arama çubuğuna not adı yazarak ağ üzerindeki ilgili düğümleri anlık olarak vurgulayabilirsiniz.
  - **Yakınlaştırma & Sığdırma:** `➕`, `➖` ve `🔍 Sığdır` butonları ile grafiğe odaklanabilirsiniz.
  - **Not Seçimi:** Herhangi bir düğüme tıkladığınızda o not otomatik olarak editörde açılır.

---

## 🛠️ Kullanılan NIP'ler & Standartlar

| NIP | Başlık | Kullanım Amacı |
| :--- | :--- | :--- |
| **NIP-54** | Wiki Articles | `kind: 30818` (Addressable Event) ile [[wikilink]] not yapısı |
| **NIP-49** | Private Key Encryption | `nsec` anahtarını parola ile `ncryptsec` formatında şifreleyerek güvenli yerel depolama |
| **NIP-44** | Encrypted Payloads | Not içeriğini ve seal paketlerini uçtan uca şifreleme |
| **NIP-59** | Gift Wrap | Ephemeral key ile gizli notları (Rumor -> Seal -> Gift Wrap) alıcılar için zarflama |
| **NIP-07** | Browser Extension Signer | `window.nostr` üzerinden tarayıcı eklentisi ile güvenli imzalama |

---

## 📁 Dizin Yapısı

```text
nostr-second-brain/
├── src/
│   ├── main.tsx             # React giriş noktası
│   ├── App.tsx              # Ana uygulama bileşeni (State, Offline Sync, Formlar)
│   ├── App.css              # Uygulama CSS stilleri ve tema değişkenleri
│   ├── nostr.ts            # NDK, NIP-49 oturumu, relay yönetimi ve Dexie IndexedDB cache yapılandırması
│   ├── components/
│   │   ├── KeyLoginForm.tsx # NIP-49 Parola ile giriş ve anahtar kasası formu
│   │   ├── MarkdownToolbar.tsx # Editör formatlama araç çubuğu
│   │   ├── RelayStatusIndicator.tsx # Bağlı relay durumu ve canlı istatistik göstergesi
│   │   ├── SettingsView.tsx # NIP-49 Kasa, Relay ve Npub alıcı yönetim ekranı
│   │   ├── SimpleGraphView.tsx # react-force-graph ile Obsidian tarzı 2D/3D interaktif ağ haritası
│   │   ├── VersionHistoryModal.tsx # Not versiyon geçmişi ve geri yükleme penceresi
│   │   └── WikiContent.tsx  # Metin içindeki [[Wikilink]] parser ve buton render motoru
│   └── utils/
│       ├── crypto.ts        # NIP-44 ve NIP-59 Gift Wrap şifreleme fonksiyonları
│       ├── exportUtils.ts   # Markdown (.md) ve JSON dışa aktarma fonksiyonları
│       ├── fileSync.ts      # Browser File System Access API ile yerel .md klasör senkronizasyonu
│       ├── graphBuilder.ts  # Not haritası ve bağlantı (Nodes/Links) oluşturucu
│       ├── keyStore.ts      # NIP-49 (ncryptsec) şifreleme ve parola doğrulama yönetimi
│       ├── recipientStore.ts # Npub adres doğrulama, saklama ve alıcı pubkey yönetimi
│       ├── sampleNote.ts    # Varsayılan başlangıç notu içeriği
│       ├── unwrap.ts        # Gift Wrap (Kind 1059) ve Seal (Kind 13) zarf açma ve doğrulama fonksiyonları
│       └── wikilink.ts      # NIP-54 Regex, Türkçe uyumlu slugify ve bağlantı ayrıştırıcı
├── Dockerfile              # Docker görsel (image) yapılandırması
├── docker-compose.yml      # Docker Compose servis yapılandırması
├── .dockerignore           # Docker derleme harici tutulan dosyalar
├── index.html              # HTML şablonu
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔑 Kimlik Yönetimi & Misafir Modu (Ephemeral Key)

Uygulama 3 farklı kimlik doğrulama yöntemini destekler:
1. **NIP-49 Kasalı Oturum (Önerilen):** `nsec` anahtarınız en az 8 karakterli parola ile scrypt + XChaCha20-Poly1305 algoritması kullanılarak `ncryptsec` formatında şifrelenir ve yerel depolamada tutulur.
2. **NIP-07 Eklentileri:** Alby, nos2x vb. tarayıcı eklentileri üzerinden secret key sayfaya verilmeden güvenli imzalama yapılır.
3. **Misafir Modu (Ephemeral Key):** Kasa kurulmamışsa ve NIP-07 eklentisi yoksa uygulama bellekte geçici bir key oluşturur. Üst bantta uyarı verilir ve tek tıkla Ayarlar sekmesinden bu key kalıcı NIP-49 kasasına yükseltilebilir.

---

## 🔐 Güvenlik Mimarisi Özeti

```text
[Kullanıcı nsec] + [Parola]
        │
        ▼ (NIP-49: Scrypt + XChaCha20-Poly1305)
  "ncryptsec1..." (Güvenli Metin)
        │
        ▼ (localStorage / IndexedDB)
   [Yerel Depolama]
```

---

## 🔄 Veri Akış Şeması

```text
[Açık Not]   ──> kind: 30818 ──> [Relay] (Yazar, İçerik, Tarih HERKESE AÇIK)

[Gizli Not]  ──> Rumor (k:30818)
                     │
                     ▼ (NIP-44 Şifreleme)
                 Seal (k:13)
                     │
                     ▼ (Ephemeral Key + Fake Timestamp + NIP-44)
                 Gift Wrap (k:1059) ──> [Relay] (Yazar ve Ayarlar'da tanımlı Npub alıcılarının her biri için ayrı zarf yayınlanır)
```

---

## 🐳 Docker ile Çalıştırma

Uygulamayı Docker kapsayıcısı (container) içerisinde çalıştırmak için aşağıdaki yöntemlerden birini kullanabilirsiniz:

### Docker Compose ile (Önerilen)

```bash
docker compose up -d
```
Uygulamaya tarayıcınızdan `http://localhost:8080` adresinden erişebilirsiniz.

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
