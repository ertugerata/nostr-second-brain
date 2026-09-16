import { NoteItem } from "./exportUtils";

export const SAMPLE_NOTE_SLUG = "nostr-brain-rehberi";

export const SAMPLE_NOTE_CONTENT = `# 🧠 Nostr Brain Rehberi ve Özellikler

**Nostr Brain**, merkeziyetsiz Nostr protokolü (NIP-54 ve NIP-49) üzerinde çalışan, ikincil beyin (Second Brain) ve not alma uygulamasıdır.

---

## 🚀 Öne Çıkan Özellikler

1. **Markdown Formatı Desteği**: Notlarınızı zengin biçimlendirme ile yazabilirsiniz.
2. **Wikilink Desteği**: [[Not Başlığı]] biçiminde diğer notlarınıza bağlantı verebilirsiniz.
3. **Grafik Görünümü (Graph View)**: Notlarınız arasındaki ilişkileri görsel bir ağ haritasında inceleyin.
4. **NIP-49 Kasa Parolası ve Şifreleme**: Secret Key'inizi (nsec) parolanız ile cihazınızda şifrelenmiş saklayın.
5. **Versiyon Geçmişi (History)**: Notlarınızın güncellenme sürümlerini inceleyin ve geçmişe dönün.
6. **İçe / Dışa Aktarma**: Bilgisayarınızdan .md dosyası yükleyin, notlarınızı .md veya .json olarak indirin.
7. **Koyu Tema (Dark Mode)**: Göz yormayan karanlık mod seçeneği.

---

## 📝 Markdown Örnekleri

### Liste Örneği
- [x] Markdown Desteği
- [x] NIP-49 Gizli Anahtar Yönetimi
- [x] Not Versiyon Takibi
- [ ] Yeni Relay Ekleme

### Kod Bloğu
\`\`\`typescript
const note = {
  title: "Nostr Brain",
  protocol: "Nostr NIP-54",
  encrypted: true
};
console.log("Hoş geldiniz!", note);
\`\`\`

### Tablo Örneği
| Özellik | NIP Standartı | Açıklama |
| :--- | :--- | :--- |
| Wiki Notları | NIP-54 | Wiki ve Wikilink formatı |
| Şifreli Saklama | NIP-49 | Ncryptsec kilitli kasa |
| Gizli Notlar | NIP-44 / NIP-59 | Gift Wrap şifreli mesajlar |

### Alıntı
> "Bilgi paylaştıkça çoğalır, merkeziyetsiz ağlarda özgürleşir."

---

*Referans Notlar*: [[Diğer Not]], [[Ayarlar Ve Güvenlik]]
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
