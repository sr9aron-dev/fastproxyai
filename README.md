# AI Proxy V2 (Vercel Edition)

Backend canggih untuk Smart Keyword AI, dioptimalkan untuk Vercel dan menggunakan Firebase Firestore sebagai database utama.

## Fitur Utama

- **Vercel Native**: Menggunakan Serverless Functions di folder `/api` untuk performa maksimal.
- **Unified Storage**: Konfigurasi dan data user terpusat di **Firebase Firestore**.
- **Premium Admin UI**: Dashboard modern dengan desain Glassmorphism dan Dark Mode.
- **Intelligent Rotation**: Rotasi otomatis API Key Groq dan Gemini dengan fallback cerdas.
- **Extension Compatible**: Mendukung request dari browser extension dengan format response lama (`legacyResult`).
- **Lynkid Webhook**: Integrasi otomatis pembayaran Lynkid untuk aktivasi langganan.

## Struktur Proyek

```text
/
├── api/
│   ├── admin/
│   │   ├── config.js      # Endpoint manajemen config
│   │   └── extension-key.js # Endpoint manajemen key ekstensi
│   ├── generate.js        # Engine AI utama
│   └── webhook-lynkid.js  # Handler webhook Lynkid
├── public/
│   ├── index.html         # Landing page premium
│   ├── admin.html         # Dashboard Admin UI
│   ├── css/admin.css      # Styling dashboard
│   └── js/admin.js        # Logika dashboard
├── src/
│   ├── firebase.mjs       # Inisialisasi Firebase Admin
│   ├── store.mjs          # Layer akses data Firestore
│   ├── providers/         # Logika AI providers (Gemini/Groq)
│   └── ...                # Utilities (crypto, prompt, etc)
└── vercel.json            # Konfigurasi routing Vercel
```

## Persiapan Environment

Set variabel berikut di Vercel Dashboard:

```env
ADMIN_TOKEN=rahasia-token-admin-anda
FIREBASE_SERVICE_ACCOUNT={...json_kridensial_firebase...}
ALLOWED_ORIGIN=*
```

## Cara Penggunaan Admin UI

1. Buka URL: `https://domain-anda.vercel.app/admin`
2. Masukkan `ADMIN_TOKEN`.
3. Klik **Initialize Session**.
4. Kelola API Keys, model, dan urutan rotasi di tab **Provider Keys**.
5. Buat token baru untuk ekstensi di bagian **Extension Access**.

## Endpoint Ekstensi

**POST** `/api/generate` (atau `/.netlify/functions/generate` untuk kompatibilitas balik)

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
  "settings": {
    "keywordCount": 49
  }
}
```

## Lisensi & Keamanan

- Jangan membagikan `ADMIN_TOKEN` atau URL Admin ke publik.
- Pastikan Firestore Security Rules dikonfigurasi dengan benar (meskipun backend menggunakan Admin SDK).
- Selalu pantau penggunaan kuota AI Anda di dashboard provider masing-masing.
