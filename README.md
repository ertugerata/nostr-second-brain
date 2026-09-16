# Nostr Second Brain (MVP) 🧠

> Veri mülkiyetini tam olarak kullanıcıya devreden, **Offline-First** mimaride ve **Nostr Protokolü** üzerinde çalışan merkezsiz kişisel bilgi yönetim / ikinci beyin uygulaması.

---

## 🌟 Öne Çıkan Özellikler

- 🔓 **Sıfır Lock-in (Tam Veri Mülkiyeti):** Notlarınız merkezi bir sunucuda kilitli kalmaz. Verileriniz Nostr event'leri olarak sizin tarafınızdan imzalanır ve seçtiğiniz relay'lerde saklanır.
- ⚡ **Offline-First Mimari:** IndexedDB katmanı sayesinde sayfa açılışlarında relay yanıtı beklenmez, veriler milisaniyeler içinde yerel önbellekten (`@nostr-dev-kit/ndk-cache-dexie`) ekrana getirilir. Ağ bağlantısı olmasa dahi not yazılabilir.
- 🔗 **NIP-54 Wiki & Wikilink Desteği:** Notlar içinde `[[Not Başlığı]]` veya `[[slug|Görünen İsim]]` formatında bağlantılar oluşturulabilir.
- 🕸️ **Dinamik Graph View:** Notlar arasındaki bağlantılar otomatik ayrıştırılarak notlar arası ilişki ağ haritası (Nodes & Edges) çıkarılır.
- 🔐 **NIP-49 Güvenli Kasalı Kimlik Yönetimi:** Private key (`nsec`), NIP-49 standardı kullanılarak kullanıcı parolasıyla şifrelenir (`ncryptsec`) ve sadece yerel depolamada saklanır. Ayrıca NIP-07 destekli eklentiler (Alby, nos2x vb.) veya ephemeral (geçici) key kullanımı desteklenir.
- 🕵️ **Gizli Notlar (NIP-44 & NIP-59):** Özel notlar NIP-44 ile şifrelenip NIP-59 Gift Wrap (kind: 1059) zarfına sarılarak relay'lere güvenle iletilir.

---

## 🛠️ Kullanılan NIP'ler & Standartlar

| NIP | Başlık | Kullanım Amacı |
| :--- | :--- | :--- |
| **NIP-54** | Wiki Articles | `kind: 30818` (Addressable Event) ile [[wikilink]] not yapısı |
| **NIP-49** | Private Key Encryption | `nsec` anahtarını parola ile `ncryptsec` formatında şifreleyerek güvenli yerel depolama |
| **NIP-44** | Encrypted Payloads | Not içeriğini ve seal paketlerini uçtan uca şifreleme |
| **NIP-59** | Gift Wrap | Ephemeral key ile gizli notları (Rumor -> Seal -> Gift Wrap) zarflama |
| **NIP-07** | Browser Extension Signer | `window.nostr` üzerinden tarayıcı eklentisi ile güvenli imzalama |

---

## 📁 Dizin Yapısı

```text
nostr-second-brain/
├── src/
│   ├── main.tsx             # React giriş noktası
│   ├── App.tsx              # Ana uygulama bileşeni (State, Offline Sync, Formlar)
│   ├── nostr.ts            # NDK, NIP-49 oturumu ve Dexie IndexedDB cache yapılandırması
│   ├── components/
│   │   ├── KeyLoginForm.tsx # NIP-49 Parola ile giriş ve anahtar kasası formu
│   │   ├── WikiContent.tsx  # Metin içindeki [[Wikilink]] parser ve buton render motoru
│   │   └── SimpleGraphView.tsx # Notlar arası ilişki grafiği (Graph View) görselleştiricisi
│   └── utils/
│       ├── keyStore.ts      # NIP-49 (ncryptsec) şifreleme ve localStorage kilit yönetimi
│       ├── wikilink.ts      # NIP-54 Regex ve Slug dönüştürücü
│       ├── graphBuilder.ts  # Not haritası ve bağlantı (Nodes/Edges) oluşturucu
│       ├── crypto.ts        # NIP-44 ve NIP-59 Gift Wrap şifreleme fonksiyonları
│       └── unwrap.ts        # Gift Wrap (Kind 1059) ve Seal (Kind 13) zarf açma fonksiyonları
├── Dockerfile              # Docker görsel (image) yapılandırması
├── docker-compose.yml      # Docker Compose servis yapılandırması
├── .dockerignore           # Docker derleme harici tutulan dosyalar
├── index.html              # HTML şablonu
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── nostr.ts
    ├── components/
    │   ├── KeyLoginForm.tsx
    │   ├── SimpleGraphView.tsx
    │   └── WikiContent.tsx
    └── utils/
        ├── crypto.ts
        ├── graphBuilder.ts
        ├── keyStore.ts
        ├── unwrap.ts
        └── wikilink.ts
```

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
                 Gift Wrap (k:1059) ──> [Relay] (Dışarıdan sadece rastgele key ve k:1059 görünür)
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
