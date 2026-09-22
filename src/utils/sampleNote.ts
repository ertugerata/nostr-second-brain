import { NoteItem } from "./exportUtils";

export const SAMPLE_NOTE_SLUG = "nostr-brain-rehberi";

export const SAMPLE_NOTE_CONTENT = `# 🧠 Nostr Brain Rehberi ve Özellikler

**Nostr Brain**, merkeziyetsiz Nostr protokolü üzerinde çalışan, ikincil beyin (Second Brain), kişisel bilgi yönetimi ve şifreli not alma uygulamasıdır.

---

## 🚀 Öne Çıkan Özellikler ve Kullanım Rehberi

### 1. 📝 Markdown, [[Wikilink]] ve 📎 Asset Medya Desteği
- **Çift Köşeli Parantez**: \`[[Not Başlığı]]\` veya \`[[slug|Görünen Ad]]\` şeklinde yazarak notlarınız arasında bağlantı kurabilirsiniz.
- **📎 Asset & Medya Eklentileri**: Editör araç çubuğundaki **📎** butonu ile JPG, PNG veya PDF (8MB'a kadar) dosyalarını ekleyebilirsiniz. Dosyalar \`![Açıklama](asset:<id>)\` formatında eklenerak AES-256-GCM zarf şifreleme ile relay'lere yüklenir ve otomatik gösterilir.

### 2. 🕸️ 2D ve 3D İnteraktif Ağ Haritası (Graph View)
- **Tüm Notlar & Relay Görünümü**: Ağ haritası üzerinde kendi notlarınızın yanı sıra relay'lerden gelen diğer kullanıcıların notlarını da inceleyebilirsiniz.
- **2D / 3D Mod**: Tek tıkla 2D veya 3D kuvvet yönlendirmeli (force-directed) görünüme geçiş yapın.
- **Görünüm Filtreleme**: *"Tüm Notlar (Relay dahil)"*, *"Benimki & Bağlantıları"* veya *"Yalnızca Benim Notlarım"* modları arasında seçim yapın.
- **Ağ İçi Arama**: Arama çubuğuna not başlığı, içerik veya \`npub1...\` adresi yazarak ilgili düğümleri anında vurgulayın.

### 3. 🔍 Npub ve Metin ile Not Arama
- **Sol Not Listesi**: Sol menüdeki arama kutusuna başlık, içerik veya \`npub1...\` adresi yazarak tüm notlarda ve diğer kullanıcıların notlarında arama yapın.
- **Yazar İdentiteleri**: Relay'lerden çekilen notların yanında yazarın \`npub\` rozeti yer alır.

### 4. 🔒 NIP-59 / NIP-44 Gizli Notlar & Multi-Recipient Gift Wrap
- **Uçtan Uca Şifreleme**: Gizli notlar NIP-59 Gift Wrap (kind: 1059) standardı ve geçici (ephemeral) anahtarlar kullanılarak şifrelenir.
- **Alıcı Yönetimi**: Ayarlar sayfasından izin verilen \`npub\` alıcı listesi ekleyerek gizli notlarınızı seçilen kişilerle şifreli olarak paylaşabilirsiniz.

### 5. 📁 Yerel Disk ve Asset Senkronizasyonu
- **File System Access API & Logseq Stili**: Notlarınızı bilgisayarınızdaki yerel bir klasörle \`.md\` dosyaları ve yüklenen görselleri \`assets/\` alt klasörüne otomatik senkronize edebilirsiniz.
- **Gizli Not Tercihi**: Ayarlar bölümünden gizli notların ve asset'lerin yerel diske düz metin kaydedilip kaydedilmeyeceğini (opt-in) kontrol edebilirsiniz.

### 6. ⚡ Offline-First & Otomatik Relay Bağlantısı
- **Yerel Önbellek (IndexedDB)**: Veriler yerel veritabanında saklanır; sayfa açılışında relay yanıtı beklenmeden anında yüklenir.
- **Auto Reconnect**: Sekme tekrar öne geldiğinde veya internet geldiğinde kopan relay bağlantıları otomatik olarak taranıp yeniden başlatılır.

---

## 📝 Kullanım Örnekleri

### Özellik Kontrol Listesi
- [x] Markdown, [[Wikilink]] ve 📎 AES-GCM şifreli Asset medya eklentileri
- [x] 2D / 3D İnteraktif Ağ Haritası ve Relay notları
- [x] \`npub1...\` adresine, başlığa veya içeriğe göre arama
- [x] NIP-59 Gift Wrap gizli notlar ve alıcı paylaşımı
- [x] NIP-49 şifreli kasa, yerel disk ve \`assets/\` klasör senkronizasyonu
- [x] IndexedDB önbelleği ile Offline-First çalışma mimarisi

### Kod Bloğu Örneği
\`\`\`typescript
import { nip19 } from "nostr-tools";

const note = {
  title: "Nostr Brain",
  protocol: "Nostr NIP-54 & NIP-59",
  searchByNpub: (npub: string) => nip19.decode(npub),
};
console.log("Nostr Brain Kullanıma Hazır!", note);
\`\`\`

### Nostr Standartları Tablosu
| Özellik | NIP / Kind | Açıklama |
| :--- | :--- | :--- |
| Temel Protokol | NIP-01 | Event yapısı, imzalar ve relay iletişimi |
| Wiki Notları | NIP-54 | Wiki formatı ve \`[[wikilink]]\` referansları (\`kind: 30818\`) |
| Gizli Kasa | NIP-49 | \`ncryptsec\` parolalı gizli anahtar saklama |
| Şifreli Notlar | NIP-44 / NIP-59 | Gift Wrap zarf şifreleme (\`kind: 1059\`) |
| Asset Blob | Kind 31736 *(Özel)* | AES-256-GCM ile şifrelenmiş medya / dosya verisi |
| Asset Key Rumor | Kind 31737 *(Özel)* | NIP-59 Gift Wrap ile şifrelenmiş asset anahtarı |
| Not Silme | NIP-09 | Public notlar için silme bildirimi (\`kind: 5\`) |

### İlham Veren Alıntı
> "Merkeziyetsiz ağlarda özgürce yazın, bilgilerinizi interaktif ağ haritasında birleştirin."

---

*İlgili Bağlantılar*: [[Diğer Not]], [[Ayarlar Ve Güvenlik]]
`;

export function getDefaultSampleNote(): NoteItem {
  return {
    id: "sample-note-001",
    slug: SAMPLE_NOTE_SLUG,
    content: SAMPLE_NOTE_CONTENT,
    createdAt: Math.floor(Date.now() / 1000),
    pubkey: "0000000000000000000000000000000000000000000000000000000000000000",
  };
}
