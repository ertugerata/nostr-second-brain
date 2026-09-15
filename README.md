# Nostr Second Brain (MVP) 🧠

> Veri mülkiyetini tam olarak kullanıcıya devreden, **Offline-First** mimaride ve **Nostr Protokolü** üzerinde çalışan merkezsiz kişisel bilgi yönetim / ikinci beyin uygulaması.

---

## 🌟 Öne Çıkan Özellikler

- 🔓 **Sıfır Lock-in (Tam Veri Mülkiyeti):** Notlarınız merkezi bir sunucuda kilitli kalmaz. Verileriniz Nostr event'leri olarak sizin tarafınızdan imzalanır ve seçtiğiniz relay'lerde saklanır.
- ⚡ **Offline-First Mimari:** IndexedDB katmanı sayesinde sayfa açılışlarında relay yanıtı beklenmez, veriler milisaniyeler içinde yerel önbellekten (`@nostr-dev-kit/ndk-cache-dexie`) ekrana getirilir. Ağ bağlantısı olmasa dahi not yazılabilir.
- 🔗 **NIP-54 Wiki & Wikilink Desteği:** Notlar içinde `[[Not Başlığı]]` veya `[[slug|Görünen İsim]]` formatında bağlantılar oluşturulabilir.
- 🕸️ **Dinamik Graph View:** Notlar arasındaki bağlantılar otomatik ayrıştırılarak notlar arası ilişki ağ haritası (Nodes & Edges) çıkarılır.
- 🔑 **Güvenli Kimlik Yönetimi:** NIP-07 destekli tarayıcı eklentileri (Alby, nos2x vb.) ile private key bilgisi asla uygulamaya verilmeden güvenle imzalama yapılır. Eklenti olmaması durumunda ephemereal key desteği sunar.

---

## 🛠️ Kullanılan NIP'ler & Standartlar

| NIP | Başlık | Kullanım Amacı |
| :--- | :--- | :--- |
| **NIP-54** | Wiki Articles | `kind: 30818` (Addressable Event) ile [[wikilink]] not yapısı |
| **NIP-07** | Browser Extension Signer | `window.nostr` üzerinden tarayıcı eklentisi ile güvenli imzalama |

---

## 📁 Dizin Yapısı

```text
nostr-second-brain/
├── src/
│   ├── main.tsx             # React giriş noktası
│   ├── App.tsx              # Ana uygulama bileşeni (State, Offline Sync, Formlar)
│   ├── nostr.ts            # NDK ve Dexie IndexedDB cache yapılandırması
│   ├── components/
│   │   ├── WikiContent.tsx  # Metin içindeki [[Wikilink]] parser ve buton render motoru
│   │   └── SimpleGraphView.tsx # Notlar arası ilişki grafiği (Graph View) görselleştiricisi
│   └── utils/
│       ├── wikilink.ts      # NIP-54 Regex ve Slug dönüştürücü
│       └── graphBuilder.ts  # Not haritası ve bağlantı (Nodes/Edges) oluşturucu
├── package.json
├── tsconfig.json
└── vite.config.ts