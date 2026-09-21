# Nostr Second Brain Packages 📦

Bu dizin, Tauri v2 ile Linux, Windows ve Android platformları için derlenen kurulum paketlerini ve çalıştırılabilir dosyaları içerir.

## 📂 Paket Listesi

| Platform | Format | Dosya Deseni / Yolu | Açıklama |
| :--- | :--- | :--- | :--- |
| **Linux** | `.deb` | `packages/*.deb` | Debian / Ubuntu Kurulum Paketi |
| **Linux** | `.AppImage` | `packages/*.AppImage` | Taşınabilir (Portable) Linux Çalıştırılabilir Dosyası |
| **Windows** | `.msi` | `packages/*.msi` | Windows Installer Paketi |
| **Windows** | `.exe` | `packages/*.exe` | Windows NSIS Kurulum Dosyası |
| **Android** | `.apk` | `packages/*.apk` | Android Uygulama Paketi (APK) |

## 🛠️ Paketleri Yerel Olarak Kopyalama / Toplama

Masaüstü veya mobil build işlemlerinden sonra oluşan paketleri bu dizine kopyalamak için:

```bash
npm run package:copy
```
