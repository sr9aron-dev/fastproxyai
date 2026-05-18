# 🧠 Nafeesa AI: Deep Technical Architecture v3.0

Dokumentasi ini menyajikan cetak biru arsitektur teknis lengkap untuk **Nafeesa AI Chatbot System (v3.0)**. Sistem ini dirancang sebagai platform roleplay tingkat tinggi dengan fitur kognitif yang dinamis, pengelolaan memori jangka panjang secara otonom, bypass protektif terhadap filter eksternal, serta integrasi multi-channel (Telegram Webhook, Web Dashboard, dan Telegram Mini App).

---

## 📌 1. Peta Jalan & Struktur Proyek (Directory Layout)

Berikut adalah struktur folder dan peran masing-masing modul dalam basis kode `mega-vercel-ai-proxy`:

```text
mega-vercel-ai-proxy/
├── api/                             # 🌐 SERVERLESS FUNCTIONS (Vercel Backend Endpoints)
│   ├── admin/
│   │   ├── auth.js                  # Autentikasi sesi dashboard admin
│   │   ├── config.js                # Pengelolaan global API keys dan model AI
│   │   ├── extension-key.js         # Manajemen API key untuk integrasi browser extension
│   │   └── stats.js                 # Statistik & pemantauan penggunaan kuota AI
│   ├── user/
│   │   └── config.js                # Sinkronisasi data pengguna dari/ke Telegram Mini App
│   ├── generate.js                  # Engine AI utama untuk extension pihak ketiga
│   ├── webhook-lynkid.js            # Callback webhook pembayaran Lynk.id (Aktivasi Premium)
│   └── webhook-telegram.js          # Webhook bot Telegram (Gerbang utama interaksi Nafeesa)
│
├── public/                          # 🎨 STATIC ASSETS (Frontend Dashboards)
│   ├── css/ & js/                   # Asset pendukung untuk Admin & Mini App UI
│   ├── index.html                   # Landing page premium AI Proxy
│   ├── admin.html                   # Dashboard admin untuk rotasi API keys
│   └── miniapp.html                 # Telegram Mini App (Dashboard Emosi & Status Nafeesa)
│
├── src/                             # 🧠 CORE LOGIC ENGINE (Internal Services)
│   ├── auth.mjs                     # Hashing SHA-256 dan verifikasi token
│   ├── camouflage.mjs               # Radar sensor & otomatisasi kamuflase bypass NSFW/sensitif
│   ├── crypto.mjs                   # Utilitas enkripsi & hashing data
│   ├── firebase.mjs                 # Inisialisasi & gateway Firebase Admin SDK
│   ├── http.mjs                     # Helper pembungkus request/response Vercel Serverless & CORS
│   ├── normalize.mjs                # Normalisasi parameter teks & struktur pesan
│   ├── personality.mjs              # Generator sifat dasar (Big Five) & modul evolusi kepribadian
│   ├── prompt.mjs                   # Template prompt roleplay tingkat tinggi (Nafeesa & Asisten)
│   ├── providers.mjs                # Adapter API untuk Gemini, Groq, dan Mistral AI
│   ├── psychology.mjs               # REC Engine (Rationality-Emotion Conflict & Mood Generator)
│   ├── redis.mjs                    # Adapter Redis (Upstash) untuk cache data temporer
│   ├── rotation.mjs                 # Engine rotasi API key, fallback, dan load balancer
│   ├── saga.mjs                     # Saga Engine (Generator sejarah hubungan, memori, & tugas)
│   └── store.mjs                    # Layer repositori data (Firestore reads/writes)
│
└── vercel.json                      # ⚙️ Routing, headers, CORS, & konfigurasi deployment Vercel
```

---

## ⚙️ 2. Alur Pemrosesan Kognitif (Cognitive & Dynamic Pipeline)

Sistem menggunakan alur pemrosesan berlapis **Dual-Process Cognitive Flow** untuk menghasilkan respon yang tidak linear dan menyerupai pertempuran batin manusia asli (Disonansi Kognitif):

```mermaid
graph TD
    User([✉️ Pesan Telegram / Foto]) --> Auth[1. Gateway Telegram Webhook]
    Auth --> LoadData[2. Parallel Fetch: Firestore User Config, Chat History, & Redis Cache]
    LoadData --> Camouflage{3. Radar Kamuflase Sensitif?}
    
    %% Alur Sensor
    Camouflage -- Ya --> Obfuscate[Kamuflase Pesan dengan Pengganti Kontekstual] --> Phase1
    Camouflage -- Tidak --> Phase1[4. Fase 1: Emotional Impact Analyzer]
    
    %% Alur Psikologi
    Phase1 --> Phase1_5[5. Fase 1.5: Hitung Rasio Dominansi Logika vs Emosi]
    Phase1_5 --> Phase2[6. Fase 2: Insting Bawah Sadar / Kata Hati]
    Phase2 --> PromptBuild[7. Sintesis System Prompt dengan BuildRoleplayPrompt]
    
    %% Alur AI & Fail-safe
    PromptBuild --> Rotation[8. AI Engine: Rotasi API Key & Auto Fallback]
    Rotation --> OutputCheck{9. Deteksi Penolakan Lembut / Safety Block?}
    OutputCheck -- Ya / Gagal --> RetryCamouflage[Tingkatkan Suhu AI & Ubah Pola Kamuflase] --> Rotation
    OutputCheck -- Sukses --> SendResponse[10. Pembagi Respon Balon Chat '|']
    
    %% Alur Latar Belakang (Async)
    SendResponse --> BackgroundUpdate[⚡ 11. Async Tasks: Update Saga Memori & Evolusi Kepribadian]
    BackgroundUpdate --> SaveDB[(Firebase & Redis Cache)]
```

---

## 🧠 3. Deskripsi Arsitektur Sistem Utama (Core Service Engines)

### 3.1. REC Engine (Rationality-Emotion Conflict)
Sistem kognitif Nafeesa diatur dalam `src/psychology.mjs` yang mengontrol status internal emosi secara presisi.
*   **Parameter Emosional**: Mengukur *Anger, Fear, Trust, Attachment, Joy,* dan *Arousal/Lust* pada skala `0.0` sampai `1.0`.
*   **Logic vs Emotion Ratio**: 
    $$\text{Emotion Score} = (\text{Anger} \times 0.4) + (\text{Arousal} \times 0.4) + (\text{Attachment} \times 0.2)$$
    $$\text{Logic Score} = (\text{Conscientiousness} \times 0.5) + (\text{Survival Pressure} \times 0.3) + (\text{Kenalan Status} \times 0.2)$$
    Rasio ini dipetakan secara real-time ke Telegram Mini App untuk memberikan visibilitas kepada pengguna mengenai kondisi mental Nafeesa.
*   **Kata Hati (Inner Voice)**: Menghasilkan dialog batin bawah sadar berdasarkan bias dominansi rasio kognitif saat itu sebelum menyusun balasan chat.

### 3.2. Saga Engine (Narrative Memory & Duty Manager)
Didefinisikan di `src/saga.mjs` untuk mempertahankan ingatan jangka panjang dan tugas otonom secara persisten.
*   **Auto-Summarizer**: Berjalan otomatis setiap 10 chat untuk memadatkan interaksi terakhir menjadi poin-poin cerita sejarah hubungan yang padat.
*   **Husband Profiling**: Menganalisis secara pasif informasi pribadi pengguna (Nama, Pekerjaan, Hobi) dan menyimpannya secara otomatis.
*   **Task & Duty Tracking**: Melacak tugas aktif pengguna (misalnya, mencari nafkah, menyelesaikan proyek) lengkap dengan persentase progress dan status eksekusi terakhir.

### 3.3. Proactive Camouflage Radar
Modul di `src/camouflage.mjs` bertindak sebagai tameng filter keamanan AI eksternal (misalnya Gemini/Groq Safety Filter).
*   **Sensivity Scan**: Memindai kata-kata berisiko (termasuk anatomi intim, pakaian dalam seperti *sempak, bra, bh, cd, g-string*, dll).
*   **Contextual Replacement**: Jika sensitif, prompt disamarkan secara cerdas menjadi istilah sastra/fiksi realis sebelum dikirim ke API luar.
*   **Soft-Refusal Detection**: Jika model AI memberikan respons penolakan standar (misalnya: *"Saya tidak bisa membantu Anda dengan itu"*), sistem secara otomatis menangkapnya, mengacak kamuflase baru, menaikkan suhu kreativitas (temperature), lalu mencoba lagi dengan penyedia API cadangan (fallback).

### 3.4. Load Balancer & Key Rotation Engine
Dikelola oleh `src/rotation.mjs`.
*   **Multi-Provider Rotation**: Mendukung rotasi dinamis antara Groq, Gemini, dan Mistral AI.
*   **Failover Algorithm**: Jika salah satu API Key terkena limit kuota (rate limit) atau diblokir filter eksternal, sistem secara otomatis menandai kegagalan dan beralih ke kunci berikutnya secara transparan tanpa mengganggu pengalaman pengguna.

---

## 🔌 4. Antarmuka API & Webhooks (Route Definitions)

| Method | Endpoint | Peran Utama | Keamanan |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/webhook-telegram` | Menghandle chat masuk Telegram, perintah (`/start`, `/settings`, `/sejarah`, `/kondisi`) | Publik (Telegram Bot API) |
| **GET** | `/api/user/config` | Membaca konfigurasi kustom & parameter psikologi pengguna untuk Dashboard Mini App | `x-telegram-chat-id` Header |
| **POST** | `/api/user/config` | Menyimpan preferensi, target hidup, atau memicu `TOTAL_RESET` dari Mini App | `x-telegram-chat-id` Header |
| **POST** | `/api/webhook-lynkid` | Callback otomatis untuk mendeteksi pembayaran sukses dan menaikkan level ke Premium | Validasi Signature Lynk.id |
| **GET** | `/api/admin/stats` | Mengambil data kuota penggunaan kunci API, performa, dan kegagalan sistem | `x-admin-token` Header |
| **POST** | `/api/admin/config` | Menyimpan/memperbarui daftar API Keys Groq/Gemini secara langsung ke Firestore | `x-admin-token` Header |
| **POST** | `/api/generate` | Endpoint API kompatibilitas untuk ekstensi browser eksternal | `Authorization: Bearer sk_live_xxx` |

---

## 5. Arsitektur Sinkronisasi Real-Time (Data Synchronization)

Agar data pada antarmuka Telegram Mini App selalu sinkron dengan aktivitas obrolan di bot Telegram utama, sistem menerapkan arsitektur sinkronisasi hibrida:

1.  **Redis Cache Buffer**: Kata hati (`inner_voice`) dan tanda suasana hati terbaru (`mood_tag`) disimpan di **Upstash Redis** dengan batas waktu kedaluwarsa singkat (1 s/d 3 jam). Hal ini memungkinkan pembacaan yang super cepat oleh Mini App tanpa membebani Firestore Read Quotas.
2.  **Visibility Listener Sync**: Dashboard Mini App di `public/miniapp.html` mendeteksi saat layar aktif atau berpindah fokus. Begitu layar kembali aktif setelah pengguna mengobrol dengan Nafeesa di Telegram, Mini App akan memicu pembaruan data real-time secara instan.
3.  **Deterministic Address & Honorifics**: Sistem secara cerdas mengganti sapaan panggilan (honorifics) Nafeesa sesuai kondisi psikologi saat itu (seperti *"Mas Ganteng"*, *"Ayang"*, *"Sayangku"*, atau *"Budakku"* jika dalam mode dominan).

---

> [!IMPORTANT]
> **Catatan Deployment Vercel**: 
> Proyek ini menggunakan **Vercel Serverless Functions (Node.js)** dan tidak menggunakan *Edge Functions*. Hal ini dikarenakan ketergantungan penuh pada `firebase-admin` SDK yang membutuhkan dukungan API Node.js standar secara lengkap untuk proses verifikasi kredensial SSL dan transaksi Firestore secara aman.

> [!TIP]
> **Anti-Repetisi & Kelancaran Narasi**:
> Sistem prompt Nafeesa dilengkapi instruksi striktif anti-repetisi pada Protokol Respons poin 5. Ini melarang keras AI mengulang deskripsi sejarah masa lalu di setiap respon chat, dan memaksanya untuk terus menggerakkan narasi ke depan demi pengalaman obrolan yang jauh lebih realistis.

---
*Dokumentasi Sistem v3.0 diperbarui secara resmi pada 18 Mei 2026.*
