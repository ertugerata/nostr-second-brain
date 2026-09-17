# TODO List & Development Roadmap

## 📦 Faz 1: Temel Çekirdek ve Offline Önbellek (Tamamlandı)
- [x] React + TypeScript + Vite proje altyapısının kurulması
- [x] NDK (`@nostr-dev-kit/ndk`) ve `nostr-tools` entegrasyonu
- [x] Dexie tabanlı IndexedDB (`ndk-cache-dexie`) ile Offline-First mimarinin kurulması
- [x] NIP-07 (Browser Extension) imzalama desteği
- [x] Canlı Relay Bağlantı Durumu ve WebSocket takip göstergesi (`RelayStatusIndicator.tsx`)

## 🔗 Faz 2: NIP-54 Wiki, Editör ve İlişki Grafiği (Tamamlandı)
- [x] NIP-54 `kind: 30818` (Addressable Event) yapısının kurgulanması
- [x] Metin içi `[[wikilink]]` parser (`wikilink.ts`) ve butonlaştırılmış render bileşeni (`WikiContent.tsx`)
- [x] GitHub tarzı Markdown editör araç çubuğu (`MarkdownToolbar.tsx`) ve toggle edilebilir Önizleme ekranı
- [x] SVG tabanlı Notlar Arası Bağlantı Grafiği (`SimpleGraphView.tsx` ve `graphBuilder.ts`)
- [x] Sadece Benim Notlarım (Pubkey Filtreleme) ve Tarihe Göre Sıralama (En Yeniden En Eskiye)
- [x] Not Revizyon/Versiyon Geçmişi Modalı (`VersionHistoryModal.tsx`)

## 🔐 Faz 3: Şifreleme ve Kasa Güvenliği (Tamamlandı)
- [x] NIP-49 `ncryptsec` Scrypt + XChaCha20-Poly1305 parola korumalı kasa (`keyStore.ts` & `KeyLoginForm.tsx`)
- [x] NIP-44 v2 şifreleme fonksiyonları (`crypto.ts`)
- [x] NIP-59 Gift Wrap `kind: 1059` zarflama altyapısı (`unwrap.ts`)

## 📁 Faz 4: Self-Hosted Relay ve Yerel Klasör Senkronizasyonu (Tamamlandı)
- [x] **Özel Relay Kurulum Dokümantasyonu ve UI Ayarları:**
  - [x] `SettingsView.tsx` içerisine tek tıkla yerel private relay (`ws://localhost:7777`) ekleme düğmesi ve NIP-65 yönetimi
- [x] **Yerel Klasöre Otomatik Yazma (Local Directory File Sync):**
  - [x] File System Access API (`showDirectoryPicker`) entegrasyonunun `App.tsx` kayıt akışına bağlanması
  - [x] Notların yerel klasördeki `.md` dosyalarına YAML Frontmatter ile otomatik aktarılması
- [x] **Yerel Dizin İçeri Dışarı Aktarım (Import / Export):**
  - [x] Bilgisayardan `.md` dosyası yükleme ve dışarı aktarma modülü

## 🚀 Faz 5: Masaüstü Paketleme & İleri Seviye Özellikler (Backlog)
- [ ] **Tauri v2 Entegrasyonu:** Mimarinin Rust tabanlı Tauri v2 ile yerel uygulama (macOS, Linux, Windows) olarak derlenmesi
- [ ] **D3.js / React-Force-Graph Entegrasyonu:** SVG Graph View'in 2D/3D sürüklenebilir interaktif Obsidian görünümüne dönüştürülmesi