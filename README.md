# Smart Keyword AI Proxy

AKUN NETLIFY : megageta7@gmail.com

Proyek ini adalah backend kecil untuk mengganti bagian Firebase/backend lama. Ekstensi tetap menjalankan UI, setting, queue, dan auto-fill. Netlify hanya menyimpan provider API key dan meneruskan request generate ke Groq/Gemini lewat satu API key internal untuk ekstensi.

## Fitur

- Admin UI untuk memasukkan banyak Groq API key dan Gemini API key.
- Rotasi key otomatis.
- Jika satu key gagal/rate limit, proxy mencoba key berikutnya.
- Fallback antar provider sesuai urutan yang dipilih.
- Generate satu API key internal yang dimasukkan ke ekstensi.
- Provider awal:
  - Groq: `meta-llama/llama-4-scout-17b-16e-instruct`
  - Gemini: `gemini-2.5-flash`

## Struktur

```text
public/
  index.html
  app.js
  style.css
netlify/functions/
  admin-config.mjs
  admin-extension-key.mjs
  generate.mjs
  health.mjs
src/
  auth.mjs
  crypto.mjs
  http.mjs
  normalize.mjs
  prompt.mjs
  providers.mjs
  rotation.mjs
  store.mjs
```

## Environment Variables

Set di Netlify dashboard:

```env
ADMIN_TOKEN=isi-token-admin-panjang-random
ALLOWED_ORIGIN=*
MAX_BASE64_LENGTH=6000000
```

`ADMIN_TOKEN` dipakai untuk membuka dan menyimpan config dari admin UI. Jangan masukkan provider API key ke env. Provider keys dimasukkan lewat UI dan disimpan di Netlify Blobs.

Untuk development lokal, project sudah mendukung fallback file lokal:

```env
LOCAL_FILE_STORE=1
```

Dengan mode ini config disimpan ke:

```text
.data/config.json
```

Saat deploy Netlify, jangan set `LOCAL_FILE_STORE=1` agar storage kembali memakai Netlify Blobs.

Untuk production setelah extension ID stabil, ganti:

```env
ALLOWED_ORIGIN=chrome-extension://<extension-id>
```

## Install Lokal

```bash
cd netlify-ai-proxy
npm install
npm run dev
```

Buka URL dari `netlify dev`, biasanya:

```text
http://localhost:8888
```

## Deploy

```bash
cd netlify-ai-proxy
npm install
npm run deploy:prod
```

Atau upload repo/folder ini ke Netlify dan set build settings:

```text
Publish directory: public
Functions directory: netlify/functions
```

## Cara Pakai Admin UI

1. Buka root site Netlify.
2. Masukkan `ADMIN_TOKEN`.
3. Klik `Load config`.
4. Paste Groq keys, satu per baris.
5. Paste Gemini keys, satu per baris.
6. Pilih provider order.
7. Klik `Simpan provider keys`.
8. Isi label extension key.
9. Klik `Generate API key ekstensi`.
10. Salin token `sk_live_...`.

Token extension hanya ditampilkan sekali. Kalau hilang, buat token baru.

## Endpoint untuk Ekstensi

```text
POST https://<site>.netlify.app/.netlify/functions/generate
```

Header:

```http
Authorization: Bearer sk_live_xxx
Content-Type: application/json
```

Body:

```json
{
  "image": {
    "mime": "image/jpeg",
    "base64": "..."
  },
  "context": {
    "existingTitle": "optional",
    "existingKeywords": []
  },
  "settings": {
    "keywordCount": 49,
    "singleWordKeywords": false,
    "nicheKeywords": false
  }
}
```

Response:

```json
{
  "ok": true,
  "provider": "groq",
  "model": "meta-llama/llama-4-scout-17b-16e-instruct",
  "result": {
    "title": "Example Adobe Stock title",
    "keywords": ["example", "stock"],
    "category": "business",
    "peopleOrProperty": false,
    "fileTypeFlag": false
  },
  "legacyResult": "Example Adobe Stock title&&example, stock&&business&&false&&false",
  "usage": {}
}
```

`legacyResult` sengaja dibuat kompatibel dengan format ekstensi lama:

```text
title&&keywords&&category&&peopleOrProperty&&fileTypeFlag
```

## Integrasi ke Ekstensi

Untuk tahap berikutnya, ekstensi perlu diganti pada bagian Firebase generate saja:

- Hapus alur upload Firebase Storage.
- Hapus pembuatan dokumen Firestore `profiles/{uid}/generates`.
- Saat auto mode trigger, ambil thumbnail/blob.
- Resize/compress lokal jika perlu.
- Convert ke base64.
- Kirim ke endpoint `/generate`.
- Ambil `legacyResult`.
- Panggil logic fill lama.

UI setting lama tetap bisa dipakai. Nilai setting dikirim dalam field `settings`.

## Catatan Keamanan

- Provider API key tidak boleh masuk ke bundle ekstensi.
- Admin UI dilindungi `ADMIN_TOKEN`, tetapi tetap jangan share URL admin ke publik.
- Netlify Blobs adalah storage sederhana. Untuk sistem multi-admin atau audit serius, gunakan database yang lebih kuat.
- Jangan log base64 image di production.
- Rotasi key di sini untuk failover dan distribusi traffic milik sendiri, bukan untuk bypass limit provider.

## Sumber API Netlify Blobs

Project memakai `@netlify/blobs` dengan `getStore`, `get`, dan `setJSON`, sesuai dokumentasi resmi Netlify Blobs.
#   f a t s p r o x y a i 
 
 #   f a t s p r o x y a i 
 
 "# fatsproxyai" 
"# fatsproxyai" 
