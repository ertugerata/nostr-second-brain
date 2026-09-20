import { NoteItem } from "./exportUtils";

export const SAMPLE_NOTE_SLUG = "nostr-brain-rehberi";

export const SAMPLE_NOTE_CONTENT = `# 🧠 Nostr Brain Rehberi ve Özellikler

**Nostr Brain**, merkeziyetsiz Nostr protokolü üzerinde çalışan, ikincil beyin (Second Brain), kişisel bilgi yönetimi ve şifreli not alma uygulamasıdır.

---

## 🚀 Öne Çıkan Özellikler ve Kullanım Rehberi

### 1. 📝 Markdown ve [[Wikilink]] Desteği
- **Çift Köşeli Parantez**: \`[[Not Başlığı]]\` şeklinde yazarak notlarınız arasında bağlantı kurabilirsiniz.
- **Zengin Biçimlendirme**: Kod blokları, listeler, tablolar ve alıntılar desteklenir.

### 2. 🕸️ 2D ve 3D İnteraktif Ağ Haritası (Graph View)
- **Tüm Notlar & Relay Görünümü**: Ağ haritası üzerinde kendi notlarınızın yanı sıra relay'lerden gelen diğer kullanıcıların notlarını da inceleyebilirsiniz.
- **2D / 3D Mod**: Tek tıkla 2D veya 3D kuvvet yönlendirmeli (force-directed) görünüme geçiş yapın.
- **Görünüm Filtreleme**: *"Tüm Notlar (Relay dahil)"*, *"Benimki & Bağlantıları"* veya *"Yalnızca Benim Notlarım"* modları arasında seçim yapın.
- **Ağ İçi Arama**: Arama çubuğuna not başlığı veya \`npub1...\` adresi yazarak ilgili düğümleri anında vurgulayın.

### 3. 🔍 Npub ve Metin ile Not Arama
- **Sol Not Listesi**: Sol menüdeki arama kutusuna başlık, içerik veya \`npub1...\` adresi yazarak tüm notlarda ve diğer kullanıcıların notlarında arama yapın.
- **Yazar İdentiteleri**: Relay'lerden çekilen notların yanında yazarın \`npub\` rozeti yer alır.

### 4. 🔒 NIP-59 / NIP-44 Gizli Notlar (Gift Wrap)
- **Uçtan Uca Şifreleme**: Gizli notlar NIP-59 Gift Wrap (kind: 1059) standartı ve geçici (ephemeral) anahtarlar kullanılarak şifrelenir.
- **Alıcı Yönetimi**: Ayarlar sayfasından izin verilen \`npub\` alıcı listesi ekleyerek gizli notlarınızı seçilen kişilerle şifreli olarak paylaşabilirsiniz.

### 5. 📁 Yerel Disk Senkronizasyonu
- **File System Access API**: Notlarınızı bilgisayarınızdaki yerel bir klasörle \`.md\` dosyaları olarak doğrudan senkronize edebilirsiniz.
- **Gizli Not Tercihi**: Ayarlar bölümünden gizli notların yerel diske düz metin kaydedilip kaydedilmeyeceğini kontrol edebilirsiniz.

### 6. 📜 Versiyon Geçmişi ve NIP-09 Silme
- **Geçmiş Takibi**: Düzenlediğiniz notların tüm versiyon geçmişini inceleyebilir ve eski sürümlere dönebilirsiniz.
- **NIP-09 Silme**: Not silindiğinde Nostr ağına NIP-09 silme duyurusu yayınlanır.

---

## 📝 Kullanım Örnekleri

### Özellik Kontrol Listesi
- [x] Markdown ve [[Wikilink]] desteği
- [x] 2D / 3D İnteraktif Ağ Haritası ve Relay notları
- [x] \`npub1...\` adresine göre not arama
- [x] NIP-59 Gift Wrap gizli notlar ve alıcı paylaşımı
- [x] NIP-49 şifreli kasa ve yerel disk senkronizasyonu

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
| Özellik | NIP Standartı | Açıklama |
| :--- | :--- | :--- |
| Wiki Notları | NIP-54 | Wiki formatı ve \`[[wikilink]]\` referansları |
| Gizli Kasa | NIP-49 | \`ncryptsec\` parolalı gizli anahtar saklama |
| Gizli Notlar | NIP-44 / NIP-59 | Gift Wrap zarf şifreleme (kind 1059) |
| Not Silme | NIP-09 | Etkinlik silme bildirimleri (kind 5) |

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
