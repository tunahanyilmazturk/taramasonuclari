# HanTech OSGB Yönetim Sistemi

Mobil sağlık taraması operasyonlarını **tekliften rapora** yöneten istemci-taraflı platform. Firmalara fiyat teklifi hazırlayın, taramaları planlayın, laboratuvar PDF raporlarını **AI ile otomatik okutup** referans aralıklarına göre analiz edin ve Excel çıktısı üretin.

> Not: Tüm veriler tarayıcının `localStorage`'ında saklanır; backend yoktur.

## Kurulum

**Gereksinim:** Node.js >= 20.19

1. Bağımlılıkları yükleyin:
   ```
   npm install
   ```
2. `.env.example` dosyasını `.env.local` olarak kopyalayıp `GEMINI_API_KEY` değerini girin
   ([ücretsiz anahtar](https://aistudio.google.com/apikey))
3. Geliştirme sunucusunu başlatın:
   ```
   npm run dev
   ```
   → http://localhost:3000

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Vite geliştirme sunucusu (port 3000) |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Build önizleme |
| `npm run typecheck` | TypeScript tip kontrolü |

## Demo Giriş

| Kullanıcı | Şifre | Rol |
|---|---|---|
| `admin` | `123` | Süper Admin |
| `doktor` | `123` | İşyeri Hekimi |
| `personel` | `123` | Sağlık Personeli |

Giriş ekranından "Örnek Firma & Tarama Verilerini Yükle" ile demo verisi oluşturulabilir.

## Teknolojiler

- React 19 + TypeScript 7 + Vite 8
- `@google/genai` (Gemini) — PDF metni → yapılandırılmış sonuç
- PDF.js (CDN) — PDF metin çıkarımı
- ExcelJS (CDN) — stillendirilmiş Excel raporu
- Tailwind CSS (CDN) + lucide-react
